// Mantenimiento de máquinas (módulo MANT, equivalente a SAP PM): fallas reportadas desde la
// máquina (QR + foto), órdenes de mantenimiento y planes preventivos.
//
//   abierta ─▶ en_curso ⇄ esperando_repuesto
//      │           └──▶ cerrada (con la solución)
//      └──── (jefe de Mantenimiento) ──▶ cancelada
//
// Reglas:
//  - Cualquiera con acceso al módulo reporta una falla. Si "detiene la máquina", el centro pasa a
//    'mantenimiento' y Producción no puede iniciar ni asignar operaciones en él (services/tareas.js).
//  - El área de Mantenimiento ve todas las órdenes; un técnico toma una y la avanza; el jefe asigna
//    y cancela. Los demás ven las que reportaron y las de las máquinas de su área.
//  - Al cerrar la última orden que detenía la máquina, vuelve a 'operativo'.
//  - Los repuestos usados salen del stock y suman al costo de la orden.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { siguienteNumero } from '../utils/secuencias.js';
import { hoy, sumarDias } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuariosDeArea } from './notificaciones.js';
import * as stock from './stock.js';

const TRANSICIONES = {
  abierta: ['en_curso', 'cancelada'],
  en_curso: ['esperando_repuesto', 'cerrada', 'cancelada'],
  esperando_repuesto: ['en_curso', 'cancelada'],
  cerrada: [],
  cancelada: [],
};
const ABIERTAS = "('abierta','en_curso','esperando_repuesto')";

const SELECT = `
  SELECT om.*, ct.codigo AS centro_codigo, ct.nombre AS centro_nombre, ct.estado AS centro_estado, ct.area_id AS centro_area_id,
         a.nombre AS area_nombre, pl.nombre AS plan_nombre,
         CONCAT(ur.nombre, ' ', ur.apellido) AS reportado_por_nombre,
         CONCAT(er.nombre, ' ', er.apellido) AS responsable_nombre
  FROM ordenes_mantenimiento om
  JOIN centros_trabajo ct ON ct.id = om.centro_trabajo_id
  JOIN areas a ON a.id = ct.area_id
  LEFT JOIN planes_mantenimiento pl ON pl.id = om.plan_id
  JOIN usuarios ur ON ur.id = om.reportado_por
  LEFT JOIN empleados er ON er.id = om.responsable_id`;

/** Rol del usuario en el módulo: gestor (jefe de Mantenimiento o admin), técnico (área Mantenimiento) o nada. */
async function rolMant(usuario) {
  const [ver, editar, aprobar] = await Promise.all(['ver', 'editar', 'aprobar'].map((a) => resolverPermiso(usuario, 'MANT', a)));
  const gestor = usuario.rol === 'ADMIN' || (aprobar.permitido && aprobar.esDuenia);
  const tecnico = gestor || (editar.permitido && editar.esDuenia);
  return { ver, gestor, tecnico };
}

async function condicionAlcance(usuario) {
  const { ver, tecnico } = await rolMant(usuario);
  const emp = usuario.empleado_id ?? 0;
  if (ver.alcance === 'todo' || ver.esDuenia || tecnico) return { sql: '1=1', params: [] };
  if (ver.alcance === 'area' && usuario.area_id) {
    return { sql: '(ct.area_id = ? OR om.reportado_por = ? OR om.responsable_id = ?)', params: [usuario.area_id, usuario.id, emp] };
  }
  return { sql: '(om.reportado_por = ? OR om.responsable_id = ?)', params: [usuario.id, emp] };
}

export async function listar(usuario, f) {
  const alc = await condicionAlcance(usuario);
  const where = [alc.sql];
  const params = [...alc.params];
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(om.numero LIKE ? OR ct.codigo LIKE ? OR ct.nombre LIKE ? OR om.descripcion LIKE ?)');
    params.push(patron, patron, patron, patron);
  }
  if (f.estado) { where.push('om.estado = ?'); params.push(f.estado); }
  if (f.tipo) { where.push('om.tipo = ?'); params.push(f.tipo); }
  if (f.centro_trabajo_id) { where.push('om.centro_trabajo_id = ?'); params.push(f.centro_trabajo_id); }
  if (f.abiertas) where.push(`om.estado IN ${ABIERTAS}`);
  if (f.mias) { where.push('om.responsable_id = ?'); params.push(usuario.empleado_id ?? 0); }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  // Primero lo que tiene la máquina parada y lo urgente.
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY om.estado IN ('cerrada','cancelada'), om.detiene_maquina DESC, FIELD(om.prioridad, 'urgente','alta','media','baja'), om.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM ordenes_mantenimiento om
    JOIN centros_trabajo ct ON ct.id = om.centro_trabajo_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

async function cargar(usuario, id) {
  const alc = await condicionAlcance(usuario);
  const om = await queryOne(`${SELECT} WHERE om.id = ? AND ${alc.sql}`, [id, ...alc.params]);
  if (!om) throw errores.noEncontrado('La orden de mantenimiento no existe');
  const rol = await rolMant(usuario);
  const esResponsable = Boolean(usuario.empleado_id) && om.responsable_id === usuario.empleado_id;
  const abierta = !['cerrada', 'cancelada'].includes(om.estado);
  return { om, ...rol, esResponsable, abierta, trabaja: abierta && (rol.gestor || esResponsable) };
}

export async function obtener(usuario, id) {
  const { om, gestor, tecnico, esResponsable, abierta, trabaja } = await cargar(usuario, id);
  const repuestos = await query(`
    SELECT m.cantidad, m.costo_unitario, m.created_at, p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.unidad,
           CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre
    FROM movimientos_stock m JOIN productos p ON p.id = m.producto_id JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.ref_tipo = 'orden_mantenimiento' AND m.ref_id = ? ORDER BY m.id`, [id]);
  const transiciones = trabaja ? TRANSICIONES[om.estado].filter((e) => e !== 'cancelada' || gestor) : [];
  // Un técnico puede tomar una orden abierta sin responsable (queda a su nombre al iniciarla).
  if (abierta && om.estado === 'abierta' && !om.responsable_id && tecnico && !transiciones.includes('en_curso')) transiciones.unshift('en_curso');
  return {
    ...om, repuestos, transiciones,
    es_responsable: esResponsable, puede_asignar: gestor && abierta, puede_repuestos: trabaja,
  };
}

/** Para los adjuntos: quien ve la orden agrega fotos mientras esté abierta. */
export async function acceso(usuario, id) {
  const { om, gestor, tecnico, esResponsable, abierta } = await cargar(usuario, id);
  return { puedeEscribir: abierta && (gestor || tecnico || esResponsable || om.reportado_por === usuario.id), puedeGestionar: gestor };
}

async function centroActivo(conn, centroId) {
  const [[ct]] = await conn.execute('SELECT id, codigo, nombre, estado, activo FROM centros_trabajo WHERE id = ? FOR UPDATE', [centroId]);
  if (!ct || !ct.activo) throw errores.validacion([{ campo: 'body.centro_trabajo_id', mensaje: 'La máquina no existe' }]);
  return ct;
}

/** Si ya no queda ninguna orden abierta que detenga la máquina, vuelve a estar operativa. */
async function liberarMaquina(conn, centroId) {
  const [[{ n }]] = await conn.execute(
    `SELECT COUNT(*) AS n FROM ordenes_mantenimiento WHERE centro_trabajo_id = ? AND detiene_maquina = 1 AND estado IN ${ABIERTAS}`, [centroId]);
  if (Number(n) === 0) await conn.execute("UPDATE centros_trabajo SET estado = 'operativo' WHERE id = ? AND estado = 'mantenimiento'", [centroId]);
}

export async function crear(usuario, d, req) {
  const { gestor } = await rolMant(usuario);
  if (d.tipo === 'preventivo' && !gestor) throw errores.prohibido('Las órdenes preventivas las genera el jefe de Mantenimiento');

  const r = await transaccion(async (conn) => {
    const ct = await centroActivo(conn, d.centro_trabajo_id);
    if (d.plan_id) {
      const [[pl]] = await conn.execute('SELECT centro_trabajo_id FROM planes_mantenimiento WHERE id = ? AND activo = 1', [d.plan_id]);
      if (!pl || pl.centro_trabajo_id !== ct.id) throw errores.validacion([{ campo: 'body.plan_id', mensaje: 'El plan no es de esta máquina' }]);
    }
    const numero = await siguienteNumero(conn, 'OM');
    const [ins] = await conn.execute(
      `INSERT INTO ordenes_mantenimiento (numero, centro_trabajo_id, plan_id, tipo, descripcion, prioridad, detiene_maquina, reportado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, ct.id, d.plan_id ?? null, d.tipo ?? 'correctivo', d.descripcion, d.prioridad ?? (d.detiene_maquina ? 'alta' : 'media'),
        d.detiene_maquina ? 1 : 0, usuario.id]);
    if (d.detiene_maquina) await conn.execute("UPDATE centros_trabajo SET estado = 'mantenimiento' WHERE id = ?", [ct.id]);
    return { id: ins.insertId, numero, ct };
  });

  await auditar(req, { accion: 'crear', entidad: 'orden_mantenimiento', entidadId: r.id, detalle: { maquina: r.ct.codigo, detiene: Boolean(d.detiene_maquina) } });
  if ((d.tipo ?? 'correctivo') === 'correctivo') {
    await notificar((await usuariosDeArea('MAN')).filter((u) => u !== usuario.id), {
      tipo: 'falla_maquina',
      titulo: `${d.detiene_maquina ? 'Máquina parada' : 'Falla'}: ${r.ct.codigo} ${r.ct.nombre}`.slice(0, 120),
      mensaje: d.descripcion, entidad: 'orden_mantenimiento', entidadId: r.id,
    });
  }
  return obtener(usuario, r.id);
}

/** El jefe asigna el técnico, cambia la prioridad o si la falla detiene la máquina. */
export async function editar(usuario, id, d, req) {
  const { om, gestor, abierta } = await cargar(usuario, id);
  if (!gestor) throw errores.prohibido('Solo el jefe de Mantenimiento modifica la orden');
  if (!abierta) throw errores.conflicto('La orden de mantenimiento ya está cerrada');
  await transaccion(async (conn) => {
    if (d.responsable_id) {
      const [[e]] = await conn.execute(
        `SELECT e.id FROM empleados e JOIN areas a ON a.id = e.area_id WHERE e.id = ? AND e.estado = 'activo' AND a.codigo = 'MAN'`, [d.responsable_id]);
      if (!e) throw errores.validacion([{ campo: 'body.responsable_id', mensaje: 'Elegí a alguien del área de Mantenimiento' }]);
    }
    const columnas = Object.keys(d);
    await conn.execute(`UPDATE ordenes_mantenimiento SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map((c) => (typeof d[c] === 'boolean' ? Number(d[c]) : d[c])), id]);
    if (d.detiene_maquina === true) await conn.execute("UPDATE centros_trabajo SET estado = 'mantenimiento' WHERE id = ?", [om.centro_trabajo_id]);
    if (d.detiene_maquina === false) await liberarMaquina(conn, om.centro_trabajo_id);
  });
  await auditar(req, { accion: 'editar', entidad: 'orden_mantenimiento', entidadId: id, detalle: { campos: Object.keys(d) } });
  if (d.responsable_id && d.responsable_id !== om.responsable_id) {
    const u = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ? AND activo = 1', [d.responsable_id]);
    await notificar(u?.id, { tipo: 'om_asignada', titulo: `Te asignaron ${om.numero}`, mensaje: `${om.centro_codigo} ${om.centro_nombre}: ${om.descripcion}`, entidad: 'orden_mantenimiento', entidadId: id });
  }
  return obtener(usuario, id);
}

export async function cambiarEstado(usuario, id, d, req) {
  const { om, gestor, tecnico, esResponsable, abierta } = await cargar(usuario, id);
  if (!abierta) throw errores.conflicto('La orden de mantenimiento ya está cerrada');
  if (!TRANSICIONES[om.estado].includes(d.estado)) throw errores.negocio(`No se puede pasar de "${om.estado}" a "${d.estado}"`);
  // Tomar una orden sin responsable: el técnico que la inicia queda a cargo.
  const toma = d.estado === 'en_curso' && !om.responsable_id && tecnico && usuario.empleado_id;
  if (!gestor && !esResponsable && !toma) throw errores.prohibido('La avanza el técnico a cargo o el jefe de Mantenimiento');
  if (d.estado === 'cancelada' && !gestor) throw errores.prohibido('Solo el jefe de Mantenimiento cancela una orden');
  if (d.estado === 'cerrada' && !d.solucion) throw errores.validacion([{ campo: 'body.solucion', mensaje: 'Contá qué se hizo para cerrarla' }]);

  await transaccion(async (conn) => {
    const sets = ['estado = ?'];
    const params = [d.estado];
    if (toma) { sets.push('responsable_id = ?'); params.push(usuario.empleado_id); }
    if (d.solucion) { sets.push('solucion = ?'); params.push(d.solucion); }
    if (d.costo) { sets.push('costo = costo + ?'); params.push(d.costo); }
    if (['cerrada', 'cancelada'].includes(d.estado)) sets.push('fecha_cierre = UTC_TIMESTAMP()');
    await conn.execute(`UPDATE ordenes_mantenimiento SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (['cerrada', 'cancelada'].includes(d.estado)) await liberarMaquina(conn, om.centro_trabajo_id);
    // Preventivo cumplido: se reprograma el plan.
    if (d.estado === 'cerrada' && om.plan_id) {
      await conn.execute('UPDATE planes_mantenimiento SET ultima_ejecucion = ?, proxima_fecha = DATE_ADD(?, INTERVAL frecuencia_dias DAY) WHERE id = ?',
        [hoy(), hoy(), om.plan_id]);
    }
  });

  await auditar(req, { accion: `om_${d.estado}`, entidad: 'orden_mantenimiento', entidadId: id });
  if (d.estado === 'cerrada' && om.reportado_por !== usuario.id) {
    await notificar(om.reportado_por, {
      tipo: 'om_cerrada', titulo: `${om.centro_codigo} reparada (${om.numero})`.slice(0, 120), mensaje: d.solucion, entidad: 'orden_mantenimiento', entidadId: id,
    });
  }
  return obtener(usuario, id);
}

/** Repuesto usado en la reparación: sale del stock y suma al costo de la orden. */
export async function usarRepuesto(usuario, id, d, req) {
  const { trabaja } = await cargar(usuario, id);
  if (!trabaja) throw errores.prohibido('Los repuestos los carga el técnico a cargo mientras la orden está abierta');
  const importe = await transaccion(async (conn) => {
    const salida = await stock.sacar(conn, { productoId: d.producto_id, depositoId: d.deposito_id ?? null, cantidad: d.cantidad },
      { tipo: 'consumo_mantenimiento', refTipo: 'orden_mantenimiento', refId: id, usuarioId: usuario.id, observacion: d.observacion ?? null });
    const total = Math.round(d.cantidad * salida.costoUnitario * 100) / 100;
    await conn.execute('UPDATE ordenes_mantenimiento SET costo = costo + ? WHERE id = ?', [total, id]);
    return total;
  });
  await auditar(req, { accion: 'usar_repuesto', entidad: 'orden_mantenimiento', entidadId: id, detalle: { producto: d.producto_id, cantidad: d.cantidad, importe } });
  return obtener(usuario, id);
}

/** Técnicos del área de Mantenimiento (para que el jefe asigne). */
export async function tecnicos() {
  return query(`SELECT e.id, e.nombre, e.apellido, e.legajo,
                  (SELECT COUNT(*) FROM ordenes_mantenimiento om WHERE om.responsable_id = e.id AND om.estado IN ${ABIERTAS}) AS abiertas
                FROM empleados e JOIN areas a ON a.id = e.area_id
                WHERE a.codigo = 'MAN' AND e.estado = 'activo' ORDER BY e.apellido`);
}

export async function maquinas(f) {
  const params = [];
  let filtro = '';
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    filtro = 'AND (ct.codigo LIKE ? OR ct.nombre LIKE ?)';
    params.push(patron, patron);
  }
  return query(`SELECT ct.id, ct.codigo, ct.nombre, ct.estado, ct.ubicacion, ct.costo_hora, a.nombre AS area_nombre
                FROM centros_trabajo ct JOIN areas a ON a.id = ct.area_id
                WHERE ct.activo = 1 ${filtro} ORDER BY ct.codigo LIMIT ${Number(f.limite)}`, params);
}

/** Ficha de la máquina (lo que se ve al escanear su QR): estado, fallas abiertas y planes. */
export async function maquina(usuario, id) {
  const ct = await queryOne(`
    SELECT ct.id, ct.codigo, ct.nombre, ct.tipo, ct.estado, ct.marca, ct.modelo, ct.nro_serie, ct.ubicacion, ct.area_id, a.nombre AS area_nombre
    FROM centros_trabajo ct JOIN areas a ON a.id = ct.area_id WHERE ct.id = ? AND ct.activo = 1`, [id]);
  if (!ct) throw errores.noEncontrado('La máquina no existe');
  const { gestor } = await rolMant(usuario);
  const [abiertas, ultimas, planes] = await Promise.all([
    query(`SELECT om.id, om.numero, om.tipo, om.descripcion, om.estado, om.prioridad, om.detiene_maquina, om.fecha_apertura
           FROM ordenes_mantenimiento om WHERE om.centro_trabajo_id = ? AND om.estado IN ${ABIERTAS} ORDER BY om.id DESC`, [id]),
    query(`SELECT om.id, om.numero, om.tipo, om.descripcion, om.solucion, om.fecha_cierre
           FROM ordenes_mantenimiento om WHERE om.centro_trabajo_id = ? AND om.estado = 'cerrada' ORDER BY om.fecha_cierre DESC LIMIT 5`, [id]),
    query(`SELECT id, nombre, descripcion, frecuencia_dias, ultima_ejecucion, proxima_fecha, (proxima_fecha <= ?) AS vencido
           FROM planes_mantenimiento WHERE centro_trabajo_id = ? AND activo = 1 ORDER BY proxima_fecha IS NULL, proxima_fecha`, [hoy(), id]),
  ]);
  return { ...ct, abiertas, ultimas, planes: planes.map((p) => ({ ...p, vencido: Boolean(p.vencido) })), puede_generar_preventivo: gestor };
}

/** Planes vencidos o por vencer en los próximos días (para el jefe de Mantenimiento). */
export async function planesProximos(dias = 7) {
  return query(`
    SELECT pl.id, pl.nombre, pl.frecuencia_dias, pl.proxima_fecha, ct.id AS centro_trabajo_id, ct.codigo AS centro_codigo, ct.nombre AS centro_nombre,
           (pl.proxima_fecha <= ?) AS vencido,
           EXISTS (SELECT 1 FROM ordenes_mantenimiento om WHERE om.plan_id = pl.id AND om.estado IN ${ABIERTAS}) AS con_orden
    FROM planes_mantenimiento pl JOIN centros_trabajo ct ON ct.id = pl.centro_trabajo_id
    WHERE pl.activo = 1 AND ct.activo = 1 AND pl.proxima_fecha <= ?
    ORDER BY pl.proxima_fecha`, [hoy(), sumarDias(hoy(), dias)]);
}
