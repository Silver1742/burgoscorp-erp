// Movimientos de stock compartidos por Inventario, Compras, Producción y Mantenimiento.
// Toda variación de stock pasa por acá: se bloquea la fila con FOR UPDATE, se valida que no
// quede negativa y se registra el movimiento. Siempre dentro de una transacción (`conn`).
import { errores } from '../utils/errores.js';

const redondear = (n) => Math.round(Number(n) * 1000) / 1000;

/**
 * Stock total, reservado (pendiente de consumir) y disponible de un producto.
 * `excluirReserva`: no cuenta esa reserva (para calcular cuánto le falta a ella misma).
 */
export async function disponibilidad(conn, productoId, excluirReserva = null) {
  const [[s]] = await conn.execute('SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock WHERE producto_id = ?', [productoId]);
  const [[r]] = await conn.execute(
    `SELECT COALESCE(SUM(cantidad - cantidad_consumida), 0) AS reservado FROM reservas_material
     WHERE producto_id = ? AND estado = 'activa' AND id <> ?`, [productoId, excluirReserva ?? 0]);
  const total = Number(s.total);
  const reservado = Number(r.reservado);
  return { total, reservado, disponible: redondear(Math.max(0, total - reservado)) };
}

/** Producto activo o error de validación en el campo indicado. */
export async function productoActivo(conn, productoId, campo = 'body.producto_id') {
  const [[p]] = await conn.execute('SELECT id, codigo, nombre, unidad, costo_promedio, activo FROM productos WHERE id = ?', [productoId]);
  if (!p || !p.activo) throw errores.validacion([{ campo, mensaje: 'El producto no existe' }]);
  return p;
}

async function depositoActivo(conn, depositoId, campo = 'body.deposito_id') {
  const [[d]] = await conn.execute('SELECT id, activo FROM depositos WHERE id = ?', [depositoId]);
  if (!d || !d.activo) throw errores.validacion([{ campo, mensaje: 'El depósito no existe' }]);
}

/**
 * Saca stock. Sin depósito, toma el que más tiene. Devuelve { depositoId, costoUnitario }.
 * mov: { tipo, refTipo, refId, usuarioId, observacion }
 */
export async function sacar(conn, { productoId, depositoId = null, cantidad }, mov) {
  const p = await productoActivo(conn, productoId);
  if (depositoId) await depositoActivo(conn, depositoId);
  const [filas] = depositoId
    ? await conn.execute('SELECT deposito_id, cantidad FROM stock WHERE producto_id = ? AND deposito_id = ? FOR UPDATE', [productoId, depositoId])
    : await conn.execute('SELECT deposito_id, cantidad FROM stock WHERE producto_id = ? ORDER BY cantidad DESC LIMIT 1 FOR UPDATE', [productoId]);
  const fila = filas[0];
  if (!fila || Number(fila.cantidad) < cantidad) {
    const hay = fila ? Number(fila.cantidad) : 0;
    throw errores.negocio(`No hay stock suficiente de ${p.nombre}: hay ${hay} ${p.unidad}${depositoId ? ' en ese depósito' : ''}`);
  }
  await conn.execute('UPDATE stock SET cantidad = cantidad - ? WHERE producto_id = ? AND deposito_id = ?', [cantidad, productoId, fila.deposito_id]);
  await registrar(conn, { productoId, depositoId: fila.deposito_id, cantidad, costoUnitario: p.costo_promedio }, mov);
  return { depositoId: fila.deposito_id, costoUnitario: Number(p.costo_promedio), producto: p };
}

/**
 * Ingresa stock. Con `costoUnitario` (compras) recalcula el costo promedio ponderado del producto.
 */
export async function ingresar(conn, { productoId, depositoId, cantidad, costoUnitario = null }, mov) {
  const p = await productoActivo(conn, productoId);
  await depositoActivo(conn, depositoId);
  if (costoUnitario !== null) {
    const [[{ total }]] = await conn.execute('SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock WHERE producto_id = ? FOR UPDATE', [productoId]);
    const existente = Math.max(0, Number(total));
    const promedio = (existente * Number(p.costo_promedio) + cantidad * costoUnitario) / (existente + cantidad);
    await conn.execute('UPDATE productos SET costo_promedio = ? WHERE id = ?', [Math.round(promedio * 100) / 100, productoId]);
  }
  await conn.execute(
    `INSERT INTO stock (producto_id, deposito_id, cantidad) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`, [productoId, depositoId, cantidad]);
  await registrar(conn, { productoId, depositoId, cantidad, costoUnitario: costoUnitario ?? p.costo_promedio }, mov);
  return p;
}

async function registrar(conn, { productoId, depositoId, cantidad, costoUnitario }, { tipo, refTipo = null, refId = null, usuarioId, observacion = null }) {
  await conn.execute(
    `INSERT INTO movimientos_stock (producto_id, deposito_id, tipo, cantidad, costo_unitario, ref_tipo, ref_id, usuario_id, observacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [productoId, depositoId, tipo, cantidad, costoUnitario, refTipo, refId, usuarioId, observacion],
  );
}
