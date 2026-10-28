// Finanzas (módulo FIN, equivalente a SAP FI): facturas de venta y de compra, cobros y pagos.
// Facturas internas, sin integración con AFIP. Solo accede el área de Administración y Finanzas.
//
//   Factura de venta: se emite desde una OT terminada o entregada (los ítems salen del presupuesto).
//   Factura de compra: se carga la del proveedor desde una OC recibida, con la foto del comprobante.
//   pendiente ──(cobro/pago parcial)──▶ parcial ──▶ pagado          anulado: sin pagos registrados
//
// Letra: a un cliente Responsable Inscripto se le hace A; al resto, B. Importes calculados acá.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { hoy, sumarDias } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';

const centavos = (n) => Math.round(n * 100) / 100;
const PUNTO_VENTA = 1;

const SELECT = `
  SELECT cp.*, CONCAT(LPAD(cp.punto_venta, 4, '0'), '-', LPAD(cp.numero, 8, '0')) AS numero_completo,
         COALESCE(c.razon_social, pr.razon_social) AS contraparte, o.numero AS ot_numero, oc.numero AS oc_numero,
         (cp.estado IN ('pendiente','parcial') AND cp.fecha_vencimiento < ?) AS vencido
  FROM comprobantes cp
  LEFT JOIN clientes c ON c.id = cp.cliente_id
  LEFT JOIN proveedores pr ON pr.id = cp.proveedor_id
  LEFT JOIN ordenes_trabajo o ON o.id = cp.orden_trabajo_id
  LEFT JOIN ordenes_compra oc ON oc.id = cp.orden_compra_id`;

const conVencido = (c) => ({ ...c, vencido: Boolean(c.vencido) });

export async function listar(f) {
  const where = ['1=1'];
  const params = [hoy()];
  if (f.lado === 'venta') where.push("cp.tipo IN ('factura_venta','nota_credito_venta')");
  if (f.lado === 'compra') where.push("cp.tipo IN ('factura_compra','nota_credito_compra')");
  if (f.estado) { where.push('cp.estado = ?'); params.push(f.estado); }
  if (f.pendientes) where.push("cp.estado IN ('pendiente','parcial')");
  if (f.vencidos) { where.push("cp.estado IN ('pendiente','parcial') AND cp.fecha_vencimiento < ?"); params.push(hoy()); }
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(c.razon_social LIKE ? OR pr.razon_social LIKE ? OR o.numero LIKE ? OR oc.numero LIKE ?)');
    params.push(p, p, p, p);
  }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY cp.estado IN ('pagado','anulado'), cp.fecha_vencimiento IS NULL, cp.fecha_vencimiento, cp.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM comprobantes cp
    LEFT JOIN clientes c ON c.id = cp.cliente_id LEFT JOIN proveedores pr ON pr.id = cp.proveedor_id
    LEFT JOIN ordenes_trabajo o ON o.id = cp.orden_trabajo_id LEFT JOIN ordenes_compra oc ON oc.id = cp.orden_compra_id
    WHERE ${condicion}`, params.slice(1));
  return { data: filas.map(conVencido), meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtener(usuario, id) {
  const c = await queryOne(`${SELECT} WHERE cp.id = ?`, [hoy(), id]);
  if (!c) throw errores.noEncontrado('El comprobante no existe');
  const [items, pagos] = await Promise.all([
    query('SELECT * FROM comprobante_items WHERE comprobante_id = ? ORDER BY id', [id]),
    query(`SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS registrado_por_nombre FROM pagos p
           JOIN usuarios u ON u.id = p.registrado_por WHERE p.comprobante_id = ? ORDER BY p.fecha, p.id`, [id]),
  ]);
  const [editar, aprobar] = await Promise.all([resolverPermiso(usuario, 'FIN', 'editar'), resolverPermiso(usuario, 'FIN', 'aprobar')]);
  return {
    ...conVencido(c), items, pagos,
    puede_pagar: editar.permitido && ['pendiente', 'parcial'].includes(c.estado),
    puede_anular: aprobar.permitido && c.estado === 'pendiente' && !pagos.length,
  };
}

/** Para los adjuntos: la foto o el PDF de la factura del proveedor. */
export async function acceso(usuario, id) {
  const ver = await resolverPermiso(usuario, 'FIN', 'ver');
  const c = ver.permitido ? await queryOne('SELECT estado FROM comprobantes WHERE id = ?', [id]) : null;
  if (!c) throw errores.noEncontrado('El comprobante no existe');
  const editar = await resolverPermiso(usuario, 'FIN', 'editar');
  return { puedeEscribir: editar.permitido && c.estado !== 'anulado', puedeGestionar: editar.permitido };
}

function totales(items) {
  const listos = items.map((it) => ({ ...it, iva_alicuota: it.iva_alicuota ?? 21, subtotal: centavos(it.cantidad * it.precio_unitario) }));
  const subtotal = centavos(listos.reduce((a, it) => a + it.subtotal, 0));
  const iva = centavos(listos.reduce((a, it) => a + it.subtotal * (it.iva_alicuota / 100), 0));
  return { items: listos, subtotal, iva, total: centavos(subtotal + iva) };
}

async function insertar(conn, cab, calc, usuarioId) {
  const [r] = await conn.execute(
    `INSERT INTO comprobantes (tipo, letra, punto_venta, numero, cliente_id, proveedor_id, orden_trabajo_id, orden_compra_id, fecha,
       fecha_vencimiento, subtotal, iva_monto, total, saldo, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [cab.tipo, cab.letra, cab.punto_venta, cab.numero, cab.cliente_id ?? null, cab.proveedor_id ?? null, cab.orden_trabajo_id ?? null,
      cab.orden_compra_id ?? null, cab.fecha, cab.fecha_vencimiento, calc.subtotal, calc.iva, calc.total, calc.total, usuarioId]);
  for (const it of calc.items) {
    await conn.execute(
      'INSERT INTO comprobante_items (comprobante_id, descripcion, cantidad, precio_unitario, iva_alicuota, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
      [r.insertId, it.descripcion.slice(0, 200), it.cantidad, it.precio_unitario, it.iva_alicuota, it.subtotal]);
  }
  return r.insertId;
}

/** Factura de venta de una OT terminada. Una sola por OT (salvo que se anule). */
export async function facturarOt(usuario, d, req) {
  const id = await transaccion(async (conn) => {
    const [[ot]] = await conn.execute(
      `SELECT o.id, o.numero, o.titulo, o.estado, o.cantidad, o.cliente_id, o.presupuesto_id, c.condicion_iva
       FROM ordenes_trabajo o LEFT JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ? FOR UPDATE`, [d.orden_trabajo_id]);
    if (!ot) throw errores.validacion([{ campo: 'body.orden_trabajo_id', mensaje: 'La orden de trabajo no existe' }]);
    if (!ot.cliente_id) throw errores.negocio('Es un trabajo interno: no se factura');
    if (!['terminada', 'entregada'].includes(ot.estado)) throw errores.negocio('Se factura cuando Calidad aprobó el trabajo (OT terminada)');
    const [[ya]] = await conn.execute("SELECT id FROM comprobantes WHERE orden_trabajo_id = ? AND tipo = 'factura_venta' AND estado <> 'anulado'", [ot.id]);
    if (ya) throw errores.conflicto('La orden de trabajo ya está facturada');

    let items = d.items;
    if (!items?.length && ot.presupuesto_id) {
      [items] = await conn.execute('SELECT descripcion, cantidad, precio_unitario, iva_alicuota FROM presupuesto_items WHERE presupuesto_id = ?', [ot.presupuesto_id]);
      items = items.map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), iva_alicuota: Number(i.iva_alicuota) }));
    }
    if (!items?.length) throw errores.validacion([{ campo: 'body.items', mensaje: 'La OT no tiene presupuesto: cargá los ítems a facturar' }]);

    const letra = ot.condicion_iva === 'RI' ? 'A' : 'B';
    // Numeración correlativa por tipo, letra y punto de venta (bloqueando para que no se repita).
    const [[{ ultimo }]] = await conn.execute(
      "SELECT COALESCE(MAX(numero), 0) AS ultimo FROM comprobantes WHERE tipo = 'factura_venta' AND letra = ? AND punto_venta = ? FOR UPDATE",
      [letra, PUNTO_VENTA]);
    const fecha = hoy();
    return insertar(conn, {
      tipo: 'factura_venta', letra, punto_venta: PUNTO_VENTA, numero: Number(ultimo) + 1, cliente_id: ot.cliente_id, orden_trabajo_id: ot.id,
      fecha, fecha_vencimiento: sumarDias(fecha, d.dias_vencimiento ?? 30),
    }, totales(items), usuario.id);
  });
  await auditar(req, { accion: 'facturar', entidad: 'comprobante', entidadId: id, detalle: { ot: d.orden_trabajo_id } });
  return obtener(usuario, id);
}

/** Factura del proveedor de una OC recibida (los ítems salen de la OC). */
export async function cargarFacturaCompra(usuario, d, req) {
  const id = await transaccion(async (conn) => {
    const [[oc]] = await conn.execute('SELECT id, numero, estado, proveedor_id FROM ordenes_compra WHERE id = ? FOR UPDATE', [d.orden_compra_id]);
    if (!oc) throw errores.validacion([{ campo: 'body.orden_compra_id', mensaje: 'La orden de compra no existe' }]);
    if (!['recibida', 'recibida_parcial'].includes(oc.estado)) throw errores.negocio('Primero hay que recibir la mercadería');
    const [[ya]] = await conn.execute("SELECT id FROM comprobantes WHERE orden_compra_id = ? AND tipo = 'factura_compra' AND estado <> 'anulado'", [oc.id]);
    if (ya) throw errores.conflicto('La orden de compra ya tiene su factura cargada');
    const [items] = await conn.execute('SELECT descripcion, cantidad, precio_unitario, iva_alicuota FROM orden_compra_items WHERE orden_compra_id = ?', [oc.id]);
    const calc = totales(items.map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), iva_alicuota: Number(i.iva_alicuota) })));
    const [[dup]] = await conn.execute(
      "SELECT id FROM comprobantes WHERE tipo = 'factura_compra' AND letra = ? AND punto_venta = ? AND numero = ? AND proveedor_id = ?",
      [d.letra, d.punto_venta, d.numero, oc.proveedor_id]);
    if (dup) throw errores.conflicto('Ese comprobante del proveedor ya está cargado');
    return insertar(conn, {
      tipo: 'factura_compra', letra: d.letra, punto_venta: d.punto_venta, numero: d.numero, proveedor_id: oc.proveedor_id, orden_compra_id: oc.id,
      fecha: d.fecha ?? hoy(), fecha_vencimiento: d.fecha_vencimiento ?? sumarDias(d.fecha ?? hoy(), 30),
    }, calc, usuario.id);
  });
  await auditar(req, { accion: 'cargar_factura_compra', entidad: 'comprobante', entidadId: id, detalle: { oc: d.orden_compra_id } });
  return obtener(usuario, id);
}

/** Cobro (factura de venta) o pago (factura de compra), total o parcial. */
export async function registrarPago(usuario, id, d, req) {
  await transaccion(async (conn) => {
    const [[c]] = await conn.execute('SELECT tipo, saldo, total, estado FROM comprobantes WHERE id = ? FOR UPDATE', [id]);
    if (!c) throw errores.noEncontrado('El comprobante no existe');
    if (!['pendiente', 'parcial'].includes(c.estado)) throw errores.conflicto(`El comprobante está ${c.estado}`);
    if (d.monto > Number(c.saldo) + 1e-9) throw errores.negocio(`El saldo es $ ${Number(c.saldo).toLocaleString('es-AR')}`);
    const tipo = c.tipo.endsWith('venta') ? 'cobro' : 'pago';
    await conn.execute('INSERT INTO pagos (tipo, comprobante_id, fecha, monto, medio, referencia, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tipo, id, d.fecha ?? hoy(), d.monto, d.medio, d.referencia ?? null, usuario.id]);
    const saldo = centavos(Number(c.saldo) - d.monto);
    await conn.execute('UPDATE comprobantes SET saldo = ?, estado = ? WHERE id = ?', [saldo, saldo === 0 ? 'pagado' : 'parcial', id]);
  });
  await auditar(req, { accion: 'registrar_pago', entidad: 'comprobante', entidadId: id, detalle: { monto: d.monto, medio: d.medio } });
  return obtener(usuario, id);
}

export async function anular(usuario, id, comentario, req) {
  const r = await query(
    "UPDATE comprobantes SET estado = 'anulado', saldo = 0 WHERE id = ? AND estado = 'pendiente' AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.comprobante_id = comprobantes.id)", [id]);
  if (!r.affectedRows) throw errores.conflicto('Solo se anula un comprobante pendiente y sin pagos');
  await auditar(req, { accion: 'anular', entidad: 'comprobante', entidadId: id, detalle: { motivo: comentario } });
  return obtener(usuario, id);
}

/** OT terminadas sin facturar y OC recibidas sin factura del proveedor (lo que Finanzas tiene que hacer). */
export async function pendientesDeFacturar() {
  const [ots, ocs] = await Promise.all([
    query(`SELECT o.id, o.numero, o.titulo, o.estado, c.razon_social AS cliente_nombre, p.total AS presupuesto_total
           FROM ordenes_trabajo o JOIN clientes c ON c.id = o.cliente_id LEFT JOIN presupuestos p ON p.id = o.presupuesto_id
           WHERE o.estado IN ('terminada','entregada')
             AND NOT EXISTS (SELECT 1 FROM comprobantes cp WHERE cp.orden_trabajo_id = o.id AND cp.tipo = 'factura_venta' AND cp.estado <> 'anulado')
           ORDER BY o.updated_at`),
    query(`SELECT oc.id, oc.numero, oc.total, pr.razon_social AS proveedor_nombre
           FROM ordenes_compra oc JOIN proveedores pr ON pr.id = oc.proveedor_id
           WHERE oc.estado IN ('recibida','recibida_parcial')
             AND NOT EXISTS (SELECT 1 FROM comprobantes cp WHERE cp.orden_compra_id = oc.id AND cp.tipo = 'factura_compra' AND cp.estado <> 'anulado')
           ORDER BY oc.updated_at`),
  ]);
  return { ordenes_trabajo: ots, ordenes_compra: ocs };
}

/** Saldos: a cobrar y a pagar, y lo vencido de cada uno. */
export async function resumen() {
  const [[r]] = [await query(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'factura_venta' AND estado IN ('pendiente','parcial') THEN saldo END), 0) AS a_cobrar,
           COALESCE(SUM(CASE WHEN tipo = 'factura_venta' AND estado IN ('pendiente','parcial') AND fecha_vencimiento < ? THEN saldo END), 0) AS a_cobrar_vencido,
           COALESCE(SUM(CASE WHEN tipo = 'factura_compra' AND estado IN ('pendiente','parcial') THEN saldo END), 0) AS a_pagar,
           COALESCE(SUM(CASE WHEN tipo = 'factura_compra' AND estado IN ('pendiente','parcial') AND fecha_vencimiento < ? THEN saldo END), 0) AS a_pagar_vencido
    FROM comprobantes`, [hoy(), hoy()])];
  return r;
}
