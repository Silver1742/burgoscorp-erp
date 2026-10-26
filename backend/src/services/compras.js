// Órdenes de compra (módulo COM, equivalente a SAP MM-PUR).
//
//   borrador ─▶ pendiente_aprobacion ─▶ aprobada ─▶ enviada ─▶ recibida_parcial ─▶ recibida
//      ▲               │ (rechazar)                     └────────────┴──────────────▲
//      └───────────────┘                         (se puede recibir desde aprobada)
//   cancelada: desde cualquier estado antes de recibir algo.
//
// Reglas:
//  - Los importes los calcula el servidor (cantidad × precio, IVA por ítem).
//  - La aprueba alguien distinto de quien la pidió (separación de funciones), salvo un admin.
//  - Al recibir, cada ítem con producto ingresa al depósito elegido y recalcula el costo promedio.
//    Si la compra era para una OT, se le avisa al responsable que llegó el material.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { siguienteNumero } from '../utils/secuencias.js';
import { hoy } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuariosDeArea } from './notificaciones.js';
import * as stock from './stock.js';

const ABIERTAS = ['borrador', 'pendiente_aprobacion', 'aprobada', 'enviada', 'recibida_parcial'];
const centavos = (n) => Math.round(n * 100) / 100;

const SELECT = `
  SELECT oc.*, p.razon_social AS proveedor_nombre, p.telefono AS proveedor_telefono, p.email AS proveedor_email,
         o.numero AS ot_numero, o.titulo AS ot_titulo,
         CONCAT(us.nombre, ' ', us.apellido) AS solicitado_por_nombre,
         CONCAT(ua.nombre, ' ', ua.apellido) AS aprobado_por_nombre,
         (SELECT COUNT(*) FROM orden_compra_items i WHERE i.orden_compra_id = oc.id) AS items_cantidad
  FROM ordenes_compra oc
  JOIN proveedores p ON p.id = oc.proveedor_id
  LEFT JOIN ordenes_trabajo o ON o.id = oc.orden_trabajo_id
  JOIN usuarios us ON us.id = oc.solicitado_por
  LEFT JOIN usuarios ua ON ua.id = oc.aprobado_por`;

export async function listar(f) {
  const where = ['1=1'];
  const params = [];
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(oc.numero LIKE ? OR p.razon_social LIKE ? OR o.numero LIKE ?)');
    params.push(patron, patron, patron);
  }
  if (f.estado) { where.push('oc.estado = ?'); params.push(f.estado); }
  if (f.proveedor_id) { where.push('oc.proveedor_id = ?'); params.push(f.proveedor_id); }
  if (f.orden_trabajo_id) { where.push('oc.orden_trabajo_id = ?'); params.push(f.orden_trabajo_id); }
  if (f.abiertas) {
    where.push(`oc.estado IN (${ABIERTAS.map(() => '?').join(', ')})`);
    params.push(...ABIERTAS);
  }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  // Primero lo que espera una acción: aprobar, enviar, recibir.
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY FIELD(oc.estado, 'pendiente_aprobacion','aprobada','enviada','recibida_parcial','borrador','recibida','cancelada'),
             oc.fecha_entrega_esperada IS NULL, oc.fecha_entrega_esperada, oc.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM ordenes_compra oc
    JOIN proveedores p ON p.id = oc.proveedor_id LEFT JOIN ordenes_trabajo o ON o.id = oc.orden_trabajo_id
    WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

/** Qué puede hacer el usuario con esta OC (la app arma los botones con esto; la API valida igual). */
async function acciones(usuario, oc) {
  const [editar, aprobar] = await Promise.all([resolverPermiso(usuario, 'COM', 'editar'), resolverPermiso(usuario, 'COM', 'aprobar')]);
  const otroAprueba = oc.solicitado_por !== usuario.id || usuario.rol === 'ADMIN';
  return {
    puede_editar: editar.permitido && oc.estado === 'borrador',
    puede_enviar_aprobacion: editar.permitido && oc.estado === 'borrador',
    puede_aprobar: aprobar.permitido && otroAprueba && oc.estado === 'pendiente_aprobacion',
    puede_enviar: editar.permitido && oc.estado === 'aprobada',
    puede_recibir: editar.permitido && ['aprobada', 'enviada', 'recibida_parcial'].includes(oc.estado),
    puede_cancelar: editar.permitido && ['borrador', 'pendiente_aprobacion', 'aprobada', 'enviada'].includes(oc.estado),
  };
}

export async function obtener(usuario, id) {
  const oc = await queryOne(`${SELECT} WHERE oc.id = ?`, [id]);
  if (!oc) throw errores.noEncontrado('La orden de compra no existe');
  const [items, recepciones] = await Promise.all([
    query(`SELECT i.*, pr.codigo AS producto_codigo, pr.unidad
           FROM orden_compra_items i LEFT JOIN productos pr ON pr.id = i.producto_id
           WHERE i.orden_compra_id = ? ORDER BY i.id`, [id]),
    query(`SELECT m.cantidad, m.created_at, pr.codigo AS producto_codigo, pr.nombre AS producto_nombre, pr.unidad,
                  d.codigo AS deposito_codigo, CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre, m.observacion
           FROM movimientos_stock m JOIN productos pr ON pr.id = m.producto_id
           JOIN depositos d ON d.id = m.deposito_id JOIN usuarios u ON u.id = m.usuario_id
           WHERE m.ref_tipo = 'orden_compra' AND m.ref_id = ? ORDER BY m.id DESC`, [id]),
  ]);
  return { ...oc, items, recepciones, ...(await acciones(usuario, oc)) };
}

/** Para los adjuntos (foto del remito o de la factura del proveedor). */
export async function acceso(usuario, id) {
  const ver = await resolverPermiso(usuario, 'COM', 'ver');
  if (!ver.permitido) throw errores.noEncontrado('La orden de compra no existe');
  const oc = await queryOne('SELECT estado FROM ordenes_compra WHERE id = ?', [id]);
  if (!oc) throw errores.noEncontrado('La orden de compra no existe');
  const editar = await resolverPermiso(usuario, 'COM', 'editar');
  return { puedeEscribir: editar.permitido && oc.estado !== 'cancelada', puedeGestionar: editar.permitido };
}

/** Arma los ítems con sus importes. La descripción por defecto es el nombre del producto. */
async function prepararItems(conn, items) {
  const listos = [];
  for (const [i, it] of items.entries()) {
    let descripcion = it.descripcion ?? null;
    if (it.producto_id) {
      const p = await stock.productoActivo(conn, it.producto_id, `body.items.${i}.producto_id`);
      descripcion = descripcion ?? p.nombre;
    }
    if (!descripcion) throw errores.validacion([{ campo: `body.items.${i}.descripcion`, mensaje: 'Indicá el producto o una descripción' }]);
    const subtotal = centavos(it.cantidad * it.precio_unitario);
    listos.push({ ...it, descripcion, iva_alicuota: it.iva_alicuota ?? 21, subtotal });
  }
  const subtotal = centavos(listos.reduce((a, it) => a + it.subtotal, 0));
  const iva = centavos(listos.reduce((a, it) => a + it.subtotal * (it.iva_alicuota / 100), 0));
  return { items: listos, subtotal, iva, total: centavos(subtotal + iva) };
}

async function validarCabecera(conn, d) {
  const [[p]] = await conn.execute('SELECT id, activo FROM proveedores WHERE id = ?', [d.proveedor_id]);
  if (!p || !p.activo) throw errores.validacion([{ campo: 'body.proveedor_id', mensaje: 'El proveedor no existe' }]);
  if (d.orden_trabajo_id) {
    const [[ot]] = await conn.execute('SELECT estado FROM ordenes_trabajo WHERE id = ?', [d.orden_trabajo_id]);
    if (!ot) throw errores.validacion([{ campo: 'body.orden_trabajo_id', mensaje: 'La orden de trabajo no existe' }]);
    if (['entregada', 'cancelada'].includes(ot.estado)) throw errores.negocio('La orden de trabajo ya está cerrada');
  }
}

async function guardarItems(conn, ocId, items) {
  await conn.execute('DELETE FROM orden_compra_items WHERE orden_compra_id = ?', [ocId]);
  for (const it of items) {
    await conn.execute(
      `INSERT INTO orden_compra_items (orden_compra_id, producto_id, descripcion, cantidad, precio_unitario, iva_alicuota, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ocId, it.producto_id ?? null, it.descripcion, it.cantidad, it.precio_unitario, it.iva_alicuota, it.subtotal]);
  }
}

export async function crear(usuario, d, req) {
  const id = await transaccion(async (conn) => {
    await validarCabecera(conn, d);
    const calc = await prepararItems(conn, d.items);
    const numero = await siguienteNumero(conn, 'OC');
    const [r] = await conn.execute(
      `INSERT INTO ordenes_compra (numero, proveedor_id, orden_trabajo_id, fecha, fecha_entrega_esperada, subtotal, iva_monto, total,
         observaciones, solicitado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, d.proveedor_id, d.orden_trabajo_id ?? null, hoy(), d.fecha_entrega_esperada ?? null, calc.subtotal, calc.iva, calc.total,
        d.observaciones ?? null, usuario.id]);
    await guardarItems(conn, r.insertId, calc.items);
    return r.insertId;
  });
  await auditar(req, { accion: 'crear', entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

export async function editar(usuario, id, d, req) {
  await transaccion(async (conn) => {
    const [[oc]] = await conn.execute('SELECT * FROM ordenes_compra WHERE id = ? FOR UPDATE', [id]);
    if (!oc) throw errores.noEncontrado('La orden de compra no existe');
    if (oc.estado !== 'borrador') throw errores.conflicto('Solo se modifica en borrador');
    const datos = { proveedor_id: oc.proveedor_id, ...d };
    await validarCabecera(conn, datos);
    const sets = [];
    const params = [];
    for (const c of ['proveedor_id', 'orden_trabajo_id', 'fecha_entrega_esperada', 'observaciones']) {
      if (d[c] !== undefined) { sets.push(`${c} = ?`); params.push(d[c]); }
    }
    if (d.items) {
      const calc = await prepararItems(conn, d.items);
      await guardarItems(conn, id, calc.items);
      sets.push('subtotal = ?', 'iva_monto = ?', 'total = ?');
      params.push(calc.subtotal, calc.iva, calc.total);
    }
    if (sets.length) await conn.execute(`UPDATE ordenes_compra SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  });
  await auditar(req, { accion: 'editar', entidad: 'orden_compra', entidadId: id, detalle: { campos: Object.keys(d) } });
  return obtener(usuario, id);
}

/** Cambio de estado con bloqueo de la fila. `verificar(oc)` lanza si no corresponde. */
async function cambiarEstado(id, nuevo, verificar, extra = {}) {
  return transaccion(async (conn) => {
    const [[oc]] = await conn.execute('SELECT * FROM ordenes_compra WHERE id = ? FOR UPDATE', [id]);
    if (!oc) throw errores.noEncontrado('La orden de compra no existe');
    verificar(oc);
    const columnas = { estado: nuevo, ...extra };
    await conn.execute(`UPDATE ordenes_compra SET ${Object.keys(columnas).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(columnas), id]);
    return oc;
  });
}

const exigirEstado = (...estados) => (oc) => {
  if (!estados.includes(oc.estado)) throw errores.negocio(`La orden de compra está "${oc.estado.replaceAll('_', ' ')}"`);
};

export async function enviarAprobacion(usuario, id, req) {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM orden_compra_items WHERE orden_compra_id = ?', [id]);
  if (!n) throw errores.negocio('La orden de compra no tiene ítems');
  const oc = await cambiarEstado(id, 'pendiente_aprobacion', exigirEstado('borrador'));
  await auditar(req, { accion: 'enviar_aprobacion', entidad: 'orden_compra', entidadId: id });
  const aprobadores = (await usuariosDeArea('ABA', { soloJefe: true })).filter((u) => u !== usuario.id);
  await notificar(aprobadores, { tipo: 'oc_para_aprobar', titulo: `Aprobar ${oc.numero}`, mensaje: `Total $ ${Number(oc.total).toLocaleString('es-AR')}`, entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

export async function aprobar(usuario, id, req) {
  const oc = await cambiarEstado(id, 'aprobada', (o) => {
    exigirEstado('pendiente_aprobacion')(o);
    if (o.solicitado_por === usuario.id && usuario.rol !== 'ADMIN') throw errores.prohibido('Una orden de compra la aprueba alguien distinto de quien la pidió');
  }, { aprobado_por: usuario.id, aprobado_at: new Date() });
  await auditar(req, { accion: 'aprobar', entidad: 'orden_compra', entidadId: id, detalle: { total: oc.total } });
  await notificar(oc.solicitado_por, { tipo: 'oc_aprobada', titulo: `${oc.numero} aprobada`, mensaje: 'Ya se puede enviar al proveedor.', entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

export async function rechazar(usuario, id, comentario, req) {
  const oc = await cambiarEstado(id, 'borrador', exigirEstado('pendiente_aprobacion'));
  await query('UPDATE ordenes_compra SET observaciones = CONCAT_WS(?, observaciones, ?) WHERE id = ?', ['\n', `Rechazada: ${comentario}`.slice(0, 600), id]);
  await auditar(req, { accion: 'rechazar', entidad: 'orden_compra', entidadId: id });
  await notificar(oc.solicitado_por, { tipo: 'oc_rechazada', titulo: `${oc.numero} volvió a borrador`, mensaje: comentario, entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

export async function enviar(usuario, id, req) {
  await cambiarEstado(id, 'enviada', exigirEstado('aprobada'));
  await auditar(req, { accion: 'enviar_proveedor', entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

export async function cancelar(usuario, id, comentario, req) {
  await cambiarEstado(id, 'cancelada', exigirEstado('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada'));
  if (comentario) await query('UPDATE ordenes_compra SET observaciones = CONCAT_WS(?, observaciones, ?) WHERE id = ?', ['\n', `Cancelada: ${comentario}`.slice(0, 600), id]);
  await auditar(req, { accion: 'cancelar', entidad: 'orden_compra', entidadId: id });
  return obtener(usuario, id);
}

/** Recepción (total o parcial): ingresa al depósito y actualiza el estado de la OC. */
export async function recibir(usuario, id, d, req) {
  const oc = await transaccion(async (conn) => {
    const [[o]] = await conn.execute('SELECT * FROM ordenes_compra WHERE id = ? FOR UPDATE', [id]);
    if (!o) throw errores.noEncontrado('La orden de compra no existe');
    exigirEstado('aprobada', 'enviada', 'recibida_parcial')(o);
    const [items] = await conn.execute('SELECT * FROM orden_compra_items WHERE orden_compra_id = ? FOR UPDATE', [id]);
    const porId = new Map(items.map((i) => [i.id, i]));
    const vistos = new Set();
    for (const [n, r] of d.items.entries()) {
      const it = porId.get(r.item_id);
      if (!it) throw errores.validacion([{ campo: `body.items.${n}.item_id`, mensaje: 'El ítem no es de esta orden de compra' }]);
      if (vistos.has(r.item_id)) throw errores.validacion([{ campo: `body.items.${n}.item_id`, mensaje: 'Ítem repetido' }]);
      vistos.add(r.item_id);
      const pendiente = Number(it.cantidad) - Number(it.cantidad_recibida);
      if (r.cantidad > pendiente + 1e-9) throw errores.negocio(`De "${it.descripcion}" quedan ${pendiente} por recibir`);
      await conn.execute('UPDATE orden_compra_items SET cantidad_recibida = cantidad_recibida + ? WHERE id = ?', [r.cantidad, it.id]);
      if (it.producto_id) {
        await stock.ingresar(conn, { productoId: it.producto_id, depositoId: d.deposito_id, cantidad: r.cantidad, costoUnitario: Number(it.precio_unitario) },
          { tipo: 'ingreso_compra', refTipo: 'orden_compra', refId: id, usuarioId: usuario.id, observacion: d.remito ? `Remito ${d.remito}` : null });
      }
    }
    const [[{ faltan }]] = await conn.execute(
      'SELECT COUNT(*) AS faltan FROM orden_compra_items WHERE orden_compra_id = ? AND cantidad_recibida < cantidad', [id]);
    const estado = Number(faltan) === 0 ? 'recibida' : 'recibida_parcial';
    await conn.execute('UPDATE ordenes_compra SET estado = ? WHERE id = ?', [estado, id]);
    return { ...o, estado };
  });

  await auditar(req, { accion: 'recibir', entidad: 'orden_compra', entidadId: id, detalle: { items: d.items.length, estado: oc.estado, remito: d.remito ?? null } });
  // Avisar a quien la pidió y, si era para una OT, al responsable de la OT.
  const avisar = [oc.solicitado_por];
  if (oc.orden_trabajo_id) {
    const r = await queryOne(`SELECT o.numero, u.id AS usuario_id FROM ordenes_trabajo o
      LEFT JOIN usuarios u ON u.empleado_id = o.responsable_id WHERE o.id = ?`, [oc.orden_trabajo_id]);
    if (r?.usuario_id) avisar.push(r.usuario_id);
    await notificar(avisar.filter((u) => u !== usuario.id), {
      tipo: 'material_recibido', titulo: `Llegó material para ${r?.numero ?? 'la OT'}`,
      mensaje: `${oc.numero} ${oc.estado === 'recibida' ? 'recibida completa' : 'recibida en parte'}.`, entidad: 'orden_trabajo', entidadId: oc.orden_trabajo_id,
    });
  } else {
    await notificar(avisar.filter((u) => u !== usuario.id), {
      tipo: 'material_recibido', titulo: `${oc.numero} ${oc.estado === 'recibida' ? 'recibida' : 'recibida en parte'}`, entidad: 'orden_compra', entidadId: id,
    });
  }
  return obtener(usuario, id);
}
