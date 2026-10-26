// Materiales de una orden de trabajo: reserva y consumo (equivalente a las reservas de SAP PP/MM).
//
//   El jefe reserva ──▶ queda apartado del disponible ──▶ el operario consume (baja el stock)
//                      └─ si no alcanza: se avisa a Abastecimiento para que compre
//
// Al cerrar la OT (entregada o cancelada) lo que no se usó se libera solo.
// El costo de lo consumido se suma al costo real de la OT.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuariosDeArea } from './notificaciones.js';
import * as ordenes from './ordenes.js';
import * as stock from './stock.js';

const CERRADAS = ['terminada', 'entregada', 'cancelada'];
const redondear = (n) => Math.round(Number(n) * 1000) / 1000;

/** La OT tiene que ser visible; además dice si el usuario la gestiona o trabaja en ella. */
async function contexto(usuario, otId) {
  const ot = await ordenes.obtener(usuario, otId); // 404 si no la ve
  const editar = await resolverPermiso(usuario, 'PROD', 'editar');
  const gestiona = editar.permitido && (editar.alcance === 'todo' || ot.area_id === usuario.area_id);
  const trabaja = Boolean(await queryOne(
    `SELECT 1 FROM tareas t JOIN tarea_asignaciones ta ON ta.tarea_id = t.id
     WHERE t.orden_trabajo_id = ? AND ta.empleado_id = ? LIMIT 1`, [otId, usuario.empleado_id ?? 0]));
  const abierta = !CERRADAS.includes(ot.estado);
  return { ot, puedeReservar: gestiona && abierta, puedeConsumir: (gestiona || trabaja) && abierta };
}

export async function listar(usuario, otId) {
  const { puedeReservar, puedeConsumir } = await contexto(usuario, otId);
  const filas = await query(`
    SELECT r.id, r.producto_id, r.cantidad, r.cantidad_consumida, r.estado, r.created_at,
           p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.unidad, p.costo_promedio,
           COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.producto_id = r.producto_id), 0) AS stock_total,
           COALESCE((SELECT SUM(o.cantidad - o.cantidad_consumida) FROM reservas_material o
                     WHERE o.producto_id = r.producto_id AND o.estado = 'activa' AND o.id <> r.id), 0) AS reservado_otras
    FROM reservas_material r JOIN productos p ON p.id = r.producto_id
    WHERE r.orden_trabajo_id = ? AND r.estado <> 'liberada'
    ORDER BY r.estado = 'consumida', p.nombre`, [otId]);
  const data = filas.map((r) => {
    const pendiente = redondear(r.cantidad - r.cantidad_consumida);
    // Lo que le toca a esta reserva del stock que no está apartado para otras OT.
    const alcance = Math.max(0, Number(r.stock_total) - Number(r.reservado_otras));
    const faltante = r.estado === 'activa' ? redondear(Math.max(0, pendiente - alcance)) : 0;
    return { ...r, pendiente, faltante };
  });
  return { data, meta: { puede_reservar: puedeReservar, puede_consumir: puedeConsumir } };
}

export async function reservar(usuario, otId, d, req) {
  const { ot, puedeReservar } = await contexto(usuario, otId);
  if (!puedeReservar) throw errores.prohibido(CERRADAS.includes(ot.estado) ? 'La orden de trabajo ya está cerrada' : 'Solo el jefe del área reserva material');

  const r = await transaccion(async (conn) => {
    const p = await stock.productoActivo(conn, d.producto_id);
    // Una sola reserva activa por producto: si ya hay, se suma.
    const [[existente]] = await conn.execute(
      "SELECT id FROM reservas_material WHERE orden_trabajo_id = ? AND producto_id = ? AND estado = 'activa' FOR UPDATE", [otId, d.producto_id]);
    const antes = await stock.disponibilidad(conn, d.producto_id, existente?.id);
    let id = existente?.id;
    if (id) await conn.execute('UPDATE reservas_material SET cantidad = cantidad + ? WHERE id = ?', [d.cantidad, id]);
    else {
      const [ins] = await conn.execute(
        'INSERT INTO reservas_material (orden_trabajo_id, producto_id, cantidad, creado_por) VALUES (?, ?, ?, ?)', [otId, d.producto_id, d.cantidad, usuario.id]);
      id = ins.insertId;
    }
    const [[res]] = await conn.execute('SELECT cantidad - cantidad_consumida AS pendiente FROM reservas_material WHERE id = ?', [id]);
    return { id, producto: p, faltante: redondear(Math.max(0, Number(res.pendiente) - antes.disponible)) };
  });

  await auditar(req, { accion: 'reservar_material', entidad: 'orden_trabajo', entidadId: otId, detalle: { producto: r.producto.codigo, cantidad: d.cantidad, faltante: r.faltante } });
  if (r.faltante > 0) {
    await notificar(await usuariosDeArea('ABA'), {
      tipo: 'material_faltante',
      titulo: `Falta material para ${ot.numero}`,
      mensaje: `Faltan ${r.faltante} ${r.producto.unidad} de ${r.producto.nombre} (${r.producto.codigo}).`,
      entidad: 'producto', entidadId: r.producto.id,
    });
  }
  const lista = await listar(usuario, otId);
  return { data: lista.data, meta: { ...lista.meta, faltante: r.faltante } };
}

export async function consumir(usuario, otId, reservaId, d, req) {
  const { ot, puedeConsumir } = await contexto(usuario, otId);
  if (!puedeConsumir) throw errores.prohibido(CERRADAS.includes(ot.estado) ? 'La orden de trabajo ya está cerrada' : 'Solo quien trabaja en la orden puede registrar consumos');
  if (d.tarea_id) {
    const t = await queryOne('SELECT id FROM tareas WHERE id = ? AND orden_trabajo_id = ?', [d.tarea_id, otId]);
    if (!t) throw errores.validacion([{ campo: 'body.tarea_id', mensaje: 'La operación no es de esta orden de trabajo' }]);
  }

  const costo = await transaccion(async (conn) => {
    const [[r]] = await conn.execute(
      'SELECT * FROM reservas_material WHERE id = ? AND orden_trabajo_id = ? FOR UPDATE', [reservaId, otId]);
    if (!r) throw errores.noEncontrado('La reserva no existe');
    if (r.estado !== 'activa') throw errores.conflicto('La reserva ya está cerrada');
    const pendiente = redondear(r.cantidad - r.cantidad_consumida);
    if (d.cantidad > pendiente) throw errores.negocio(`Quedan ${pendiente} reservados. Pedile al jefe que reserve más.`);

    const salida = await stock.sacar(conn, { productoId: r.producto_id, depositoId: d.deposito_id ?? null, cantidad: d.cantidad },
      { tipo: 'consumo_ot', refTipo: 'orden_trabajo', refId: otId, usuarioId: usuario.id, observacion: d.observacion ?? null });
    await conn.execute(
      `INSERT INTO consumos_material (orden_trabajo_id, tarea_id, reserva_id, producto_id, deposito_id, cantidad, costo_unitario, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [otId, d.tarea_id ?? null, r.id, r.producto_id, salida.depositoId, d.cantidad, salida.costoUnitario, usuario.id]);
    const completa = redondear(pendiente - d.cantidad) === 0;
    await conn.execute(
      `UPDATE reservas_material SET cantidad_consumida = cantidad_consumida + ?, estado = ? WHERE id = ?`,
      [d.cantidad, completa ? 'consumida' : 'activa', r.id]);
    const importe = Math.round(d.cantidad * salida.costoUnitario * 100) / 100;
    await conn.execute('UPDATE ordenes_trabajo SET costo_real = costo_real + ? WHERE id = ?', [importe, otId]);
    return importe;
  });

  await auditar(req, { accion: 'consumir_material', entidad: 'orden_trabajo', entidadId: otId, detalle: { reserva: reservaId, cantidad: d.cantidad, costo } });
  return listar(usuario, otId);
}

/** El jefe anula lo que quedaba reservado (lo consumido no se toca). */
export async function liberar(usuario, otId, reservaId, req) {
  const { puedeReservar } = await contexto(usuario, otId);
  if (!puedeReservar) throw errores.prohibido('Solo el jefe del área libera material');
  const r = await queryOne("SELECT id, cantidad_consumida FROM reservas_material WHERE id = ? AND orden_trabajo_id = ? AND estado = 'activa'", [reservaId, otId]);
  if (!r) throw errores.noEncontrado('La reserva no existe o ya está cerrada');
  // Si ya se usó algo, la reserva queda en lo consumido; si no, se libera entera.
  if (Number(r.cantidad_consumida) > 0) {
    await query("UPDATE reservas_material SET cantidad = cantidad_consumida, estado = 'consumida' WHERE id = ?", [reservaId]);
  } else {
    await query("UPDATE reservas_material SET estado = 'liberada' WHERE id = ?", [reservaId]);
  }
  await auditar(req, { accion: 'liberar_material', entidad: 'orden_trabajo', entidadId: otId, detalle: { reserva: reservaId } });
  return listar(usuario, otId);
}
