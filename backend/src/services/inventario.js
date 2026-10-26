// Inventario (módulo INV, equivalente a SAP MM-IM): stock por depósito, lo reservado para
// órdenes de trabajo, movimientos, ajustes y transferencias entre depósitos.
// Los ajustes y transferencias los hace Abastecimiento (área dueña del módulo).
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { auditar } from './auditoria.js';
import * as stock from './stock.js';

// Reservado = lo que las OT tienen apartado y todavía no consumieron.
const RESERVADO = `COALESCE((SELECT SUM(r.cantidad - r.cantidad_consumida) FROM reservas_material r
                     WHERE r.producto_id = p.id AND r.estado = 'activa'), 0)`;
const TOTAL = 'COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.producto_id = p.id), 0)';
// En camino = pedido en órdenes de compra aprobadas o enviadas y todavía no recibido.
const EN_CAMINO = `COALESCE((SELECT SUM(i.cantidad - i.cantidad_recibida) FROM orden_compra_items i
                    JOIN ordenes_compra oc ON oc.id = i.orden_compra_id
                    WHERE i.producto_id = p.id AND oc.estado IN ('aprobada','enviada','recibida_parcial')), 0)`;

const SELECT = `
  SELECT p.id, p.codigo, p.nombre, p.tipo, p.unidad, p.costo_promedio, p.stock_minimo, c.nombre AS categoria_nombre,
         ${TOTAL} AS stock_total, ${RESERVADO} AS reservado, ${EN_CAMINO} AS en_camino
  FROM productos p
  LEFT JOIN categorias_producto c ON c.id = p.categoria_id`;

function conCalculos(p) {
  const disponible = Math.max(0, Number(p.stock_total) - Number(p.reservado));
  return { ...p, disponible, bajo_minimo: Number(p.stock_total) < Number(p.stock_minimo) };
}

export async function listarStock(f) {
  const where = ['p.activo = 1'];
  const params = [];
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(p.codigo LIKE ? OR p.nombre LIKE ?)');
    params.push(patron, patron);
  }
  if (f.tipo) { where.push('p.tipo = ?'); params.push(f.tipo); }
  if (f.categoria_id) { where.push('p.categoria_id = ?'); params.push(f.categoria_id); }
  if (f.bajo_minimo) where.push(`${TOTAL} < p.stock_minimo`);
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  // Primero lo que está bajo el mínimo.
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY ${TOTAL} < p.stock_minimo DESC, p.nombre LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM productos p WHERE ${condicion}`, params);
  return { data: filas.map(conCalculos), meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtenerProducto(id) {
  const p = await queryOne(`${SELECT} WHERE p.id = ?`, [id]);
  if (!p) throw errores.noEncontrado('El producto no existe');
  const [depositos, reservas, movimientos, compras] = await Promise.all([
    query(`SELECT d.id, d.codigo, d.nombre, COALESCE(s.cantidad, 0) AS cantidad
           FROM depositos d LEFT JOIN stock s ON s.deposito_id = d.id AND s.producto_id = ?
           WHERE d.activo = 1 ORDER BY d.codigo`, [id]),
    query(`SELECT r.id, r.cantidad, r.cantidad_consumida, o.id AS orden_trabajo_id, o.numero AS ot_numero, o.titulo AS ot_titulo
           FROM reservas_material r JOIN ordenes_trabajo o ON o.id = r.orden_trabajo_id
           WHERE r.producto_id = ? AND r.estado = 'activa' ORDER BY r.created_at`, [id]),
    listarMovimientos({ producto_id: id, pagina: 1, limite: 15 }).then((r) => r.data),
    query(`SELECT oc.id, oc.numero, oc.estado, oc.fecha_entrega_esperada, pr.razon_social AS proveedor_nombre,
                  i.cantidad - i.cantidad_recibida AS pendiente
           FROM orden_compra_items i JOIN ordenes_compra oc ON oc.id = i.orden_compra_id
           JOIN proveedores pr ON pr.id = oc.proveedor_id
           WHERE i.producto_id = ? AND oc.estado IN ('pendiente_aprobacion','aprobada','enviada','recibida_parcial')
             AND i.cantidad > i.cantidad_recibida
           ORDER BY oc.fecha_entrega_esperada IS NULL, oc.fecha_entrega_esperada`, [id]),
  ]);
  return { ...conCalculos(p), depositos, reservas, movimientos, compras };
}

export async function listarMovimientos(f) {
  const where = ['1=1'];
  const params = [];
  if (f.producto_id) { where.push('m.producto_id = ?'); params.push(f.producto_id); }
  if (f.deposito_id) { where.push('m.deposito_id = ?'); params.push(f.deposito_id); }
  if (f.tipo) { where.push('m.tipo = ?'); params.push(f.tipo); }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  // El número del documento de origen (OC, OT u OM) se muestra para la trazabilidad.
  const filas = await query(`
    SELECT m.id, m.tipo, m.cantidad, m.costo_unitario, m.ref_tipo, m.ref_id, m.observacion, m.created_at,
           p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.unidad, d.codigo AS deposito_codigo,
           CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre,
           CASE m.ref_tipo
             WHEN 'orden_compra' THEN (SELECT numero FROM ordenes_compra WHERE id = m.ref_id)
             WHEN 'orden_trabajo' THEN (SELECT numero FROM ordenes_trabajo WHERE id = m.ref_id)
             WHEN 'orden_mantenimiento' THEN (SELECT numero FROM ordenes_mantenimiento WHERE id = m.ref_id)
           END AS ref_numero
    FROM movimientos_stock m
    JOIN productos p ON p.id = m.producto_id
    JOIN depositos d ON d.id = m.deposito_id
    JOIN usuarios u ON u.id = m.usuario_id
    WHERE ${condicion} ORDER BY m.id DESC LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM movimientos_stock m WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

/** Ajuste por conteo físico, rotura o pérdida. La observación es obligatoria (queda en la auditoría). */
export async function ajustar(usuario, d, req) {
  await transaccion(async (conn) => {
    const mov = { tipo: d.tipo, refTipo: 'ajuste', usuarioId: usuario.id, observacion: d.observacion };
    if (d.tipo === 'ajuste_positivo') await stock.ingresar(conn, { productoId: d.producto_id, depositoId: d.deposito_id, cantidad: d.cantidad }, mov);
    else {
      // No se puede bajar por debajo de lo reservado para OT (habría que liberar la reserva primero).
      const { total, reservado } = await stock.disponibilidad(conn, d.producto_id);
      if (total - d.cantidad < reservado) {
        throw errores.negocio(`No se puede: quedarían ${total - d.cantidad} y hay ${reservado} reservados para órdenes de trabajo`);
      }
      await stock.sacar(conn, { productoId: d.producto_id, depositoId: d.deposito_id, cantidad: d.cantidad }, mov);
    }
  });
  await auditar(req, { accion: 'ajuste_stock', entidad: 'producto', entidadId: d.producto_id, detalle: { tipo: d.tipo, cantidad: d.cantidad, deposito: d.deposito_id } });
  return obtenerProducto(d.producto_id);
}

export async function transferir(usuario, d, req) {
  if (d.desde_deposito_id === d.hacia_deposito_id) {
    throw errores.validacion([{ campo: 'body.hacia_deposito_id', mensaje: 'Elegí un depósito distinto al de origen' }]);
  }
  await transaccion(async (conn) => {
    const base = { usuarioId: usuario.id, observacion: d.observacion ?? null };
    await stock.sacar(conn, { productoId: d.producto_id, depositoId: d.desde_deposito_id, cantidad: d.cantidad }, { ...base, tipo: 'transferencia_salida' });
    await stock.ingresar(conn, { productoId: d.producto_id, depositoId: d.hacia_deposito_id, cantidad: d.cantidad }, { ...base, tipo: 'transferencia_entrada' });
  });
  await auditar(req, { accion: 'transferencia_stock', entidad: 'producto', entidadId: d.producto_id, detalle: { cantidad: d.cantidad, desde: d.desde_deposito_id, hacia: d.hacia_deposito_id } });
  return obtenerProducto(d.producto_id);
}
