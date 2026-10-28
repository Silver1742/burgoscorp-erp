// Tablero (módulo TAB): los números del día para Gerencia y los jefes, pensado para el celular.
// Cada bloque aparece solo si el usuario puede ver ese módulo; con alcance de área, Producción se
// limita a las OT de su área. Gerencia y el admin ven toda la empresa.
import { query } from '../config/db.js';
import { hoy } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import * as finanzas from './finanzas.js';

const primeroDelMes = () => `${hoy().slice(0, 8)}01`;
const num = (v) => Number(v ?? 0);

async function produccion(areaId) {
  const filtro = areaId ? 'AND o.area_id = ?' : '';
  const p = areaId ? [areaId] : [];
  const [[r]] = [await query(`
    SELECT SUM(o.estado NOT IN ('entregada','cancelada')) AS abiertas,
           SUM(o.estado = 'control_calidad') AS en_calidad,
           SUM(o.estado = 'terminada') AS para_entregar,
           SUM(o.estado NOT IN ('terminada','entregada','cancelada') AND o.fecha_entrega_plan < ?) AS atrasadas,
           SUM(o.estado = 'entregada' AND o.fecha_entrega_real >= ?) AS entregadas_mes
    FROM ordenes_trabajo o WHERE 1=1 ${filtro}`, [hoy(), primeroDelMes(), ...p])];
  const [[h]] = [await query(`
    SELECT COALESCE(SUM(t.horas_estimadas), 0) AS estimadas, COALESCE(SUM(t.horas_reales), 0) AS reales
    FROM tareas t JOIN ordenes_trabajo o ON o.id = t.orden_trabajo_id
    WHERE t.estado = 'aprobada' AND t.horas_estimadas > 0 ${filtro}`, p)];
  const porEstado = await query(`SELECT o.estado, COUNT(*) AS cantidad FROM ordenes_trabajo o
    WHERE o.estado NOT IN ('entregada','cancelada') ${filtro} GROUP BY o.estado`, p);
  return {
    abiertas: num(r.abiertas), en_calidad: num(r.en_calidad), para_entregar: num(r.para_entregar), atrasadas: num(r.atrasadas),
    entregadas_mes: num(r.entregadas_mes), horas_estimadas: num(h.estimadas), horas_reales: num(h.reales),
    por_estado: porEstado.map((e) => ({ estado: e.estado, cantidad: num(e.cantidad) })),
  };
}

async function ventas() {
  const [[r]] = [await query(`
    SELECT (SELECT COUNT(*) FROM solicitudes WHERE estado IN ('nueva','en_analisis')) AS solicitudes_abiertas,
           (SELECT COUNT(*) FROM presupuestos WHERE estado = 'enviado') AS presupuestos_enviados,
           (SELECT COALESCE(SUM(total), 0) FROM presupuestos WHERE estado = 'enviado') AS monto_enviado,
           (SELECT COUNT(*) FROM presupuestos WHERE estado = 'aprobado' AND respuesta_cliente_at >= ?) AS aprobados_mes,
           (SELECT COUNT(*) FROM presupuestos WHERE estado = 'rechazado' AND respuesta_cliente_at >= ?) AS rechazados_mes`,
  [primeroDelMes(), primeroDelMes()])];
  const resueltos = num(r.aprobados_mes) + num(r.rechazados_mes);
  return {
    solicitudes_abiertas: num(r.solicitudes_abiertas), presupuestos_enviados: num(r.presupuestos_enviados), monto_enviado: num(r.monto_enviado),
    aprobados_mes: num(r.aprobados_mes), tasa_aprobacion: resueltos ? Math.round((num(r.aprobados_mes) / resueltos) * 100) : null,
  };
}

async function calidad() {
  const [[r]] = [await query(`
    SELECT COUNT(*) AS inspecciones, SUM(resultado <> 'rechazada') AS aprobadas, SUM(resultado = 'rechazada') AS rechazadas
    FROM inspecciones WHERE fecha >= ?`, [primeroDelMes()])];
  return {
    inspecciones_mes: num(r.inspecciones), rechazadas_mes: num(r.rechazadas),
    porcentaje_aprobadas: num(r.inspecciones) ? Math.round((num(r.aprobadas) / num(r.inspecciones)) * 100) : null,
  };
}

async function mantenimiento() {
  const [[r]] = [await query(`
    SELECT (SELECT COUNT(*) FROM centros_trabajo WHERE activo = 1 AND estado <> 'operativo') AS maquinas_paradas,
           (SELECT COUNT(*) FROM centros_trabajo WHERE activo = 1) AS maquinas,
           (SELECT COUNT(*) FROM ordenes_mantenimiento WHERE estado IN ('abierta','en_curso','esperando_repuesto')) AS ordenes_abiertas,
           (SELECT COUNT(*) FROM planes_mantenimiento WHERE activo = 1 AND proxima_fecha < ?) AS preventivos_vencidos`, [hoy()])];
  return {
    maquinas_paradas: num(r.maquinas_paradas), maquinas: num(r.maquinas), ordenes_abiertas: num(r.ordenes_abiertas),
    preventivos_vencidos: num(r.preventivos_vencidos),
  };
}

async function inventario() {
  const [[r]] = [await query(`
    SELECT (SELECT COUNT(*) FROM productos p WHERE p.activo = 1
              AND COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.producto_id = p.id), 0) < p.stock_minimo) AS bajo_minimo,
           (SELECT COALESCE(SUM(s.cantidad * p.costo_promedio), 0) FROM stock s JOIN productos p ON p.id = s.producto_id) AS valor_stock,
           (SELECT COUNT(*) FROM ordenes_compra WHERE estado = 'pendiente_aprobacion') AS compras_para_aprobar`)];
  return { bajo_minimo: num(r.bajo_minimo), valor_stock: num(r.valor_stock), compras_para_aprobar: num(r.compras_para_aprobar) };
}

async function facturacion() {
  const [[r]] = [await query(`
    SELECT COALESCE(SUM(CASE WHEN tipo = 'factura_venta' THEN total END), 0) AS facturado_mes,
           COALESCE((SELECT SUM(monto) FROM pagos WHERE tipo = 'cobro' AND fecha >= ?), 0) AS cobrado_mes
    FROM comprobantes WHERE estado <> 'anulado' AND fecha >= ?`, [primeroDelMes(), primeroDelMes()])];
  return { facturado_mes: num(r.facturado_mes), cobrado_mes: num(r.cobrado_mes), ...(await finanzas.resumen()) };
}

export async function obtener(usuario) {
  const puede = async (modulo) => resolverPermiso(usuario, modulo, 'ver');
  const [prod, ven, cal, mant, inv, fin] = await Promise.all(['PROD', 'VEN', 'CAL', 'MANT', 'INV', 'FIN'].map(puede));
  const areaId = prod.alcance === 'todo' ? null : (usuario.area_id ?? -1);
  const datos = { fecha: hoy(), alcance: areaId ? 'area' : 'todo' };
  if (prod.permitido) datos.produccion = await produccion(areaId);
  if (ven.permitido) datos.ventas = await ventas();
  if (cal.permitido) datos.calidad = await calidad();
  if (mant.permitido) datos.mantenimiento = await mantenimiento();
  if (inv.permitido) datos.inventario = await inventario();
  if (fin.permitido) {
    const f = await facturacion();
    datos.finanzas = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, num(v)]));
  }
  return datos;
}
