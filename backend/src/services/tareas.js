// Tareas: la unidad de trabajo asignable (módulo TAR). Una tarea puede ser una operación de una
// orden de trabajo (OT + secuencia + máquina) o una tarea suelta del área.
//
//   pendiente ──iniciar──▶ en_curso ──terminar──▶ en_revision ──aprobar──▶ aprobada
//      ▲                  │  ▲                         │
//      │             pausar  reanudar                rechazar (con motivo)
//      │                  ▼  │                         ▼
//      └─────────────── pausada              rechazada ──iniciar──▶ en_curso
//   (jefe) cancelar desde cualquier estado salvo aprobada.
//
// Reglas de negocio que se validan SIEMPRE en el servidor:
//  - Solo se asigna a empleados activos con la habilidad requerida y, si la habilidad pide
//    certificación (ej. soldadura MIG), con la certificación vigente.
//  - No se asigna ni se inicia una operación si la máquina no está operativa (mantenimiento).
//  - Un empleado tiene una sola tarea en curso a la vez.
//  - Solo los asignados avanzan la tarea; la aprueba un jefe que no esté asignado a ella.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { hoy, fechaAr } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar } from './notificaciones.js';
import { actualizarPorOperaciones } from './ordenes.js';

const SELECT = `
  SELECT t.*, o.numero AS ot_numero, o.titulo AS ot_titulo, o.estado AS ot_estado, a.nombre AS area_nombre,
         ct.codigo AS centro_codigo, ct.nombre AS centro_nombre, ct.estado AS centro_estado,
         h.nombre AS habilidad_nombre, h.requiere_certificacion AS habilidad_certificada,
         CONCAT(u.nombre, ' ', u.apellido) AS creador_nombre,
         (SELECT GROUP_CONCAT(CONCAT(e.nombre, ' ', e.apellido) ORDER BY e.apellido SEPARATOR ', ')
            FROM tarea_asignaciones ta JOIN empleados e ON e.id = ta.empleado_id WHERE ta.tarea_id = t.id) AS asignados
  FROM tareas t
  JOIN areas a ON a.id = t.area_id
  LEFT JOIN ordenes_trabajo o ON o.id = t.orden_trabajo_id
  LEFT JOIN centros_trabajo ct ON ct.id = t.centro_trabajo_id
  LEFT JOIN habilidades h ON h.id = t.habilidad_requerida_id
  JOIN usuarios u ON u.id = t.creado_por`;

const asignadoA = 'EXISTS (SELECT 1 FROM tarea_asignaciones ta WHERE ta.tarea_id = t.id AND ta.empleado_id = ?)';

/** Qué tareas ve el usuario: toda la empresa, las de su área, o las propias (asignadas o creadas por él). */
async function condicionAlcance(usuario) {
  const { alcance } = await resolverPermiso(usuario, 'TAR', 'ver');
  const emp = usuario.empleado_id ?? 0;
  if (alcance === 'todo') return { sql: '1=1', params: [], alcance };
  if (alcance === 'area' && usuario.area_id) {
    return { sql: `(t.area_id = ? OR t.creado_por = ? OR ${asignadoA})`, params: [usuario.area_id, usuario.id, emp], alcance };
  }
  return { sql: `(t.creado_por = ? OR ${asignadoA})`, params: [usuario.id, emp], alcance };
}

export async function listar(usuario, f) {
  const alc = await condicionAlcance(usuario);
  const where = [alc.sql];
  const params = [...alc.params];
  if (f.mias) { where.push(asignadoA); params.push(usuario.empleado_id ?? 0); }
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(t.titulo LIKE ? OR o.numero LIKE ?)');
    params.push(patron, patron);
  }
  if (f.estado) { where.push('t.estado = ?'); params.push(f.estado); }
  if (f.abiertas) where.push("t.estado NOT IN ('aprobada', 'cancelada')");
  if (f.orden_trabajo_id) { where.push('t.orden_trabajo_id = ?'); params.push(f.orden_trabajo_id); }
  if (f.area_id) { where.push('t.area_id = ?'); params.push(f.area_id); }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;

  // Primero lo que está en curso, después lo urgente y lo que vence antes.
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY FIELD(t.estado, 'en_curso','rechazada','pausada','pendiente','en_revision','aprobada','cancelada'),
             FIELD(t.prioridad, 'urgente','alta','media','baja'), t.fecha_limite IS NULL, t.fecha_limite, t.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tareas t
    LEFT JOIN ordenes_trabajo o ON o.id = t.orden_trabajo_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

/** Carga una tarea que el usuario puede ver; agrega si está asignado y si puede gestionarla. */
async function cargar(usuario, id) {
  const alc = await condicionAlcance(usuario);
  const t = await queryOne(`${SELECT} WHERE t.id = ? AND ${alc.sql}`, [id, ...alc.params]);
  if (!t) throw errores.noEncontrado('La tarea no existe');
  const asignados = await query(`
    SELECT e.id, e.nombre, e.apellido, e.legajo, ta.asignado_at FROM tarea_asignaciones ta
    JOIN empleados e ON e.id = ta.empleado_id WHERE ta.tarea_id = ? ORDER BY e.apellido`, [id]);
  const gestion = await resolverPermiso(usuario, 'TAR', 'aprobar');
  const puedeGestionar = gestion.permitido && (gestion.alcance === 'todo' || t.area_id === usuario.area_id);
  return {
    t,
    asignados,
    esAsignado: asignados.some((a) => a.id === usuario.empleado_id),
    puedeGestionar,
  };
}

export async function obtener(usuario, id) {
  const { t, asignados, esAsignado, puedeGestionar } = await cargar(usuario, id);
  const [checklist, comentarios, historial, horas] = await Promise.all([
    query('SELECT id, texto, hecho, orden FROM tarea_checklist WHERE tarea_id = ? ORDER BY orden, id', [id]),
    query(`SELECT c.id, c.texto, c.created_at, CONCAT(u.nombre, ' ', u.apellido) AS autor
           FROM tarea_comentarios c JOIN usuarios u ON u.id = c.usuario_id WHERE c.tarea_id = ? ORDER BY c.created_at, c.id`, [id]),
    query(`SELECT hi.estado_anterior, hi.estado_nuevo, hi.comentario, hi.created_at, CONCAT(u.nombre, ' ', u.apellido) AS autor
           FROM tarea_historial hi JOIN usuarios u ON u.id = hi.usuario_id WHERE hi.tarea_id = ? ORDER BY hi.id`, [id]),
    query(`SELECT r.inicio_at, r.fin_at, r.horas, CONCAT(e.nombre, ' ', e.apellido) AS empleado
           FROM registros_horas r JOIN empleados e ON e.id = r.empleado_id WHERE r.tarea_id = ? ORDER BY r.inicio_at DESC`, [id]),
  ]);
  return { ...t, asignados_detalle: asignados, checklist, comentarios, historial, horas, es_asignado: esAsignado, puede_gestionar: puedeGestionar };
}

// ---------------------------------------------------------------- alta

async function insertarTarea(conn, datos) {
  const [r] = await conn.execute(
    `INSERT INTO tareas (titulo, descripcion, area_id, orden_trabajo_id, secuencia, centro_trabajo_id,
       habilidad_requerida_id, prioridad, fecha_limite, horas_estimadas, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.titulo, datos.descripcion ?? null, datos.area_id, datos.orden_trabajo_id ?? null, datos.secuencia ?? null,
      datos.centro_trabajo_id ?? null, datos.habilidad_requerida_id ?? null, datos.prioridad ?? 'media',
      datos.fecha_limite ? new Date(datos.fecha_limite) : null, datos.horas_estimadas ?? null, datos.creado_por],
  );
  for (const [i, texto] of (datos.checklist ?? []).entries()) {
    await conn.execute('INSERT INTO tarea_checklist (tarea_id, texto, orden) VALUES (?, ?, ?)', [r.insertId, texto, i]);
  }
  await conn.execute('INSERT INTO tarea_historial (tarea_id, usuario_id, estado_nuevo) VALUES (?, ?, ?)', [r.insertId, datos.creado_por, 'pendiente']);
  return r.insertId;
}

/** Si se elige una máquina, la habilidad requerida por defecto es la de la máquina. */
async function completarConMaquina(datos) {
  if (!datos.centro_trabajo_id) return datos;
  const ct = await queryOne('SELECT id, area_id, habilidad_requerida_id, activo FROM centros_trabajo WHERE id = ?', [datos.centro_trabajo_id]);
  if (!ct || !ct.activo) throw errores.validacion([{ campo: 'body.centro_trabajo_id', mensaje: 'La máquina no existe' }]);
  return { ...datos, habilidad_requerida_id: datos.habilidad_requerida_id ?? ct.habilidad_requerida_id, area_maquina: ct.area_id };
}

/** Agrega una operación a una OT. La operación queda en el área de la máquina (o la de la OT). */
export async function crearOperacion(usuario, otId, datos, req) {
  const permiso = await resolverPermiso(usuario, 'PROD', 'editar');
  if (!permiso.permitido) throw errores.prohibido();
  const ot = await queryOne('SELECT id, numero, area_id, estado FROM ordenes_trabajo WHERE id = ?', [otId]);
  if (!ot) throw errores.noEncontrado('La orden de trabajo no existe');
  if (permiso.alcance !== 'todo' && ot.area_id !== usuario.area_id) throw errores.prohibido('La orden de trabajo es de otra área');
  if (['terminada', 'entregada', 'cancelada'].includes(ot.estado)) throw errores.conflicto('La orden de trabajo ya está cerrada');

  const d = await completarConMaquina(datos);
  const id = await transaccion(async (conn) => {
    const [[{ siguiente }]] = await conn.execute(
      'SELECT COALESCE(MAX(secuencia), 0) + 10 AS siguiente FROM tareas WHERE orden_trabajo_id = ? FOR UPDATE', [otId]);
    return insertarTarea(conn, { ...d, area_id: d.area_maquina ?? ot.area_id, orden_trabajo_id: otId, secuencia: siguiente, creado_por: usuario.id });
  });
  await auditar(req, { accion: 'crear', entidad: 'tarea', entidadId: id, detalle: { ot: ot.numero } });
  return obtener(usuario, id);
}

/** Tarea suelta del área (no ligada a una OT). */
export async function crear(usuario, datos, req) {
  const permiso = await resolverPermiso(usuario, 'TAR', 'crear');
  if (!permiso.permitido) throw errores.prohibido();
  const areaId = permiso.alcance === 'todo' ? (datos.area_id ?? usuario.area_id) : usuario.area_id;
  if (datos.area_id && permiso.alcance !== 'todo' && datos.area_id !== usuario.area_id) throw errores.prohibido('Solo podés crear tareas de tu área');
  if (!areaId) throw errores.validacion([{ campo: 'body.area_id', mensaje: 'Indicá el área' }]);
  const d = await completarConMaquina(datos);
  const id = await transaccion((conn) => insertarTarea(conn, { ...d, area_id: areaId, creado_por: usuario.id }));
  await auditar(req, { accion: 'crear', entidad: 'tarea', entidadId: id });
  return obtener(usuario, id);
}

export async function editar(usuario, id, datos, req) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido('Solo el jefe del área puede modificar la tarea');
  if (['aprobada', 'cancelada'].includes(t.estado)) throw errores.conflicto('La tarea ya está cerrada');
  const d = await completarConMaquina(datos);
  delete d.area_maquina;
  const cambios = { ...d };
  if (cambios.fecha_limite) cambios.fecha_limite = new Date(cambios.fecha_limite);
  const columnas = Object.keys(cambios);
  await query(`UPDATE tareas SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...columnas.map((c) => cambios[c] ?? null), id]);
  await auditar(req, { accion: 'editar', entidad: 'tarea', entidadId: id, detalle: { campos: columnas } });
  return obtener(usuario, id);
}

// ---------------------------------------------------------------- asignación

/**
 * Empleados que pueden hacer la tarea: activos, del área de la tarea, con la habilidad requerida
 * (y la certificación vigente si corresponde). Incluye cuántas tareas abiertas tiene cada uno.
 */
export async function candidatos(usuario, id) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido();
  return query(`
    SELECT e.id, e.legajo, e.nombre, e.apellido, p.nombre AS puesto_nombre,
           eh.nivel, eh.certificado_vence,
           (SELECT COUNT(*) FROM tarea_asignaciones ta2 JOIN tareas t2 ON t2.id = ta2.tarea_id
             WHERE ta2.empleado_id = e.id AND t2.estado IN ('pendiente','en_curso','pausada','rechazada')) AS carga,
           EXISTS (SELECT 1 FROM tarea_asignaciones ta WHERE ta.tarea_id = ? AND ta.empleado_id = e.id) AS ya_asignado
    FROM empleados e
    LEFT JOIN puestos p ON p.id = e.puesto_id
    LEFT JOIN empleado_habilidades eh ON eh.empleado_id = e.id AND eh.habilidad_id = ?
    LEFT JOIN habilidades h ON h.id = eh.habilidad_id
    WHERE e.estado = 'activo' AND e.area_id = ?
      AND (? IS NULL OR (eh.habilidad_id IS NOT NULL
           AND (h.requiere_certificacion = 0 OR eh.certificado_vence >= ?)))
    ORDER BY carga, FIELD(eh.nivel, 'avanzado','intermedio','basico'), e.apellido`,
  [id, t.habilidad_requerida_id, t.area_id, t.habilidad_requerida_id, hoy()]);
}

async function validarAsignable(t, empleadoId) {
  const e = await queryOne('SELECT id, nombre, apellido, area_id, estado FROM empleados WHERE id = ?', [empleadoId]);
  if (!e) throw errores.validacion([{ campo: 'body.empleado_id', mensaje: 'El empleado no existe' }]);
  const nombre = `${e.nombre} ${e.apellido}`;
  if (e.estado !== 'activo') throw errores.negocio(`${nombre} no está activo (${e.estado})`);
  if (e.area_id !== t.area_id) throw errores.negocio(`${nombre} no pertenece al área de la tarea (${t.area_nombre})`);
  if (t.centro_trabajo_id && t.centro_estado !== 'operativo') {
    throw errores.negocio(`La máquina ${t.centro_codigo} está ${t.centro_estado === 'mantenimiento' ? 'en mantenimiento' : 'fuera de servicio'}`);
  }
  if (t.habilidad_requerida_id) {
    const h = await queryOne(
      `SELECT eh.certificado_vence, h.requiere_certificacion FROM empleado_habilidades eh
       JOIN habilidades h ON h.id = eh.habilidad_id WHERE eh.empleado_id = ? AND eh.habilidad_id = ?`,
      [empleadoId, t.habilidad_requerida_id]);
    if (!h) throw errores.negocio(`${nombre} no tiene la habilidad "${t.habilidad_nombre}"`);
    if (h.requiere_certificacion && (!h.certificado_vence || h.certificado_vence < hoy())) {
      throw errores.negocio(`La certificación de "${t.habilidad_nombre}" de ${nombre} está vencida${h.certificado_vence ? ` desde el ${fechaAr(h.certificado_vence)}` : ''}`);
    }
  }
  return e;
}

export async function asignar(usuario, id, empleadoId, req) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido('Solo el jefe del área asigna tareas');
  if (['aprobada', 'cancelada'].includes(t.estado)) throw errores.conflicto('La tarea ya está cerrada');
  const e = await validarAsignable(t, empleadoId);

  const r = await query('INSERT IGNORE INTO tarea_asignaciones (tarea_id, empleado_id, asignado_por) VALUES (?, ?, ?)', [id, empleadoId, usuario.id]);
  if (!r.affectedRows) throw errores.conflicto(`${e.nombre} ${e.apellido} ya está asignado`);
  await auditar(req, { accion: 'asignar', entidad: 'tarea', entidadId: id, detalle: { empleadoId } });

  const destinatario = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ? AND activo = 1', [empleadoId]);
  await notificar(destinatario?.id, {
    tipo: 'tarea_asignada',
    titulo: `Te asignaron: ${t.titulo}`,
    mensaje: [t.ot_numero, t.centro_codigo && `Máquina ${t.centro_codigo}`, t.fecha_limite && `Vence ${fechaAr(new Date(t.fecha_limite).toISOString())}`].filter(Boolean).join(' · ') || null,
    entidad: 'tarea', entidadId: id,
  });
  return obtener(usuario, id);
}

export async function desasignar(usuario, id, empleadoId, req) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido();
  if (['aprobada', 'cancelada'].includes(t.estado)) throw errores.conflicto('La tarea ya está cerrada');
  const abierto = await queryOne('SELECT id FROM registros_horas WHERE tarea_id = ? AND empleado_id = ? AND fin_at IS NULL', [id, empleadoId]);
  if (abierto) throw errores.conflicto('Esa persona está trabajando en la tarea ahora. Que la pause primero.');
  const r = await query('DELETE FROM tarea_asignaciones WHERE tarea_id = ? AND empleado_id = ?', [id, empleadoId]);
  if (!r.affectedRows) throw errores.noEncontrado('No estaba asignado');
  await auditar(req, { accion: 'desasignar', entidad: 'tarea', entidadId: id, detalle: { empleadoId } });
  return obtener(usuario, id);
}

// ---------------------------------------------------------------- avance (asignados) y revisión (jefe)

/** Cierra el registro de horas abierto de un empleado en la tarea y recalcula las horas reales. */
async function cerrarHoras(conn, tareaId, empleadoId) {
  await conn.execute(
    `UPDATE registros_horas SET fin_at = UTC_TIMESTAMP(),
       horas = ROUND(TIMESTAMPDIFF(SECOND, inicio_at, UTC_TIMESTAMP()) / 3600, 2)
     WHERE tarea_id = ? AND empleado_id = ? AND fin_at IS NULL`, [tareaId, empleadoId]);
  await conn.execute(
    'UPDATE tareas SET horas_reales = (SELECT COALESCE(SUM(horas), 0) FROM registros_horas WHERE tarea_id = ?) WHERE id = ?',
    [tareaId, tareaId]);
}

/** `extra` son columnas fijas del código (ej. ', completada_at = UTC_TIMESTAMP()'); sus valores van en `extraParams`. */
async function cambiarEstado(conn, t, usuario, nuevo, comentario = null, extra = '', extraParams = []) {
  // El estado esperado en el WHERE evita que dos acciones simultáneas se pisen.
  const [r] = await conn.execute(`UPDATE tareas SET estado = ?${extra} WHERE id = ? AND estado = ?`, [nuevo, ...extraParams, t.id, t.estado]);
  if (!r.affectedRows) throw errores.conflicto('La tarea cambió mientras tanto. Actualizá y probá de nuevo.');
  await conn.execute('INSERT INTO tarea_historial (tarea_id, usuario_id, estado_anterior, estado_nuevo, comentario) VALUES (?, ?, ?, ?, ?)',
    [t.id, usuario.id, t.estado, nuevo, comentario]);
  if (t.orden_trabajo_id) await actualizarPorOperaciones(conn, t.orden_trabajo_id);
}

export async function iniciar(usuario, id, req) {
  const { t, esAsignado } = await cargar(usuario, id);
  if (!esAsignado) throw errores.prohibido('Solo las personas asignadas pueden trabajar en la tarea');
  if (!['pendiente', 'pausada', 'rechazada'].includes(t.estado)) throw errores.conflicto(`La tarea está ${t.estado.replace('_', ' ')}`);
  if (t.centro_trabajo_id && t.centro_estado !== 'operativo') {
    throw errores.negocio(`La máquina ${t.centro_codigo} no está operativa. Avisá a Mantenimiento.`);
  }
  const otra = await queryOne(`
    SELECT t.titulo FROM registros_horas r JOIN tareas t ON t.id = r.tarea_id
    WHERE r.empleado_id = ? AND r.fin_at IS NULL AND r.tarea_id <> ?`, [usuario.empleado_id, id]);
  if (otra) throw errores.conflicto(`Ya tenés en curso "${otra.titulo}". Pausala antes de empezar otra.`);

  await transaccion(async (conn) => {
    await cambiarEstado(conn, t, usuario, 'en_curso', null, ', iniciada_at = COALESCE(iniciada_at, UTC_TIMESTAMP())');
    await conn.execute('INSERT INTO registros_horas (tarea_id, empleado_id, inicio_at) VALUES (?, ?, UTC_TIMESTAMP())', [id, usuario.empleado_id]);
  });
  await auditar(req, { accion: 'iniciar', entidad: 'tarea', entidadId: id });
  return obtener(usuario, id);
}

export async function pausar(usuario, id, req) {
  const { t, esAsignado } = await cargar(usuario, id);
  if (!esAsignado) throw errores.prohibido('Solo las personas asignadas pueden trabajar en la tarea');
  if (t.estado !== 'en_curso') throw errores.conflicto('La tarea no está en curso');
  await transaccion(async (conn) => {
    // Se cierran las horas de todos los asignados: la tarea completa queda en pausa.
    const [abiertos] = await conn.execute('SELECT DISTINCT empleado_id FROM registros_horas WHERE tarea_id = ? AND fin_at IS NULL', [id]);
    for (const a of abiertos) await cerrarHoras(conn, id, a.empleado_id);
    await cambiarEstado(conn, t, usuario, 'pausada');
  });
  await auditar(req, { accion: 'pausar', entidad: 'tarea', entidadId: id });
  return obtener(usuario, id);
}

export async function terminar(usuario, id, comentario, req) {
  const { t, esAsignado } = await cargar(usuario, id);
  if (!esAsignado) throw errores.prohibido('Solo las personas asignadas pueden terminar la tarea');
  if (!['en_curso', 'pausada'].includes(t.estado)) throw errores.conflicto('Primero hay que iniciar la tarea');
  const [{ pendientes }] = await query('SELECT COUNT(*) AS pendientes FROM tarea_checklist WHERE tarea_id = ? AND hecho = 0', [id]);
  if (pendientes > 0) throw errores.negocio(`Faltan ${pendientes} ${pendientes === 1 ? 'punto' : 'puntos'} de la lista de control`);
  await transaccion(async (conn) => {
    const [abiertos] = await conn.execute('SELECT DISTINCT empleado_id FROM registros_horas WHERE tarea_id = ? AND fin_at IS NULL', [id]);
    for (const a of abiertos) await cerrarHoras(conn, id, a.empleado_id);
    await cambiarEstado(conn, t, usuario, 'en_revision', comentario ?? null, ', completada_at = UTC_TIMESTAMP()');
  });
  await auditar(req, { accion: 'terminar', entidad: 'tarea', entidadId: id });
  await notificar(t.creado_por, {
    tipo: 'tarea_en_revision', titulo: `Para revisar: ${t.titulo}`,
    mensaje: `${usuario.nombre} ${usuario.apellido} la marcó como terminada${t.ot_numero ? ` · ${t.ot_numero}` : ''}`,
    entidad: 'tarea', entidadId: id,
  });
  return obtener(usuario, id);
}

async function avisarAsignados(id, datos) {
  const us = await query('SELECT u.id FROM tarea_asignaciones ta JOIN usuarios u ON u.empleado_id = ta.empleado_id WHERE ta.tarea_id = ? AND u.activo = 1', [id]);
  await notificar(us.map((u) => u.id), { ...datos, entidad: 'tarea', entidadId: id });
}

async function exigirRevisor(usuario, id) {
  const datos = await cargar(usuario, id);
  if (!datos.puedeGestionar) throw errores.prohibido('Solo el jefe del área revisa la tarea');
  if (datos.esAsignado) throw errores.prohibido('No podés aprobar una tarea en la que trabajaste');
  return datos;
}

export async function aprobar(usuario, id, comentario, req) {
  const { t } = await exigirRevisor(usuario, id);
  if (t.estado !== 'en_revision') throw errores.conflicto('La tarea no está esperando revisión');
  await transaccion((conn) => cambiarEstado(conn, t, usuario, 'aprobada', comentario ?? null, ', revisado_por = ?', [usuario.id]));
  await auditar(req, { accion: 'aprobar', entidad: 'tarea', entidadId: id });
  await avisarAsignados(id, { tipo: 'tarea_aprobada', titulo: `Aprobaron: ${t.titulo}`, mensaje: comentario ?? null });
  return obtener(usuario, id);
}

export async function rechazar(usuario, id, comentario, req) {
  const { t } = await exigirRevisor(usuario, id);
  if (t.estado !== 'en_revision') throw errores.conflicto('La tarea no está esperando revisión');
  await transaccion((conn) => cambiarEstado(conn, t, usuario, 'rechazada', comentario));
  await auditar(req, { accion: 'rechazar', entidad: 'tarea', entidadId: id });
  await avisarAsignados(id, { tipo: 'tarea_rechazada', titulo: `Hay que rehacer: ${t.titulo}`, mensaje: comentario });
  return obtener(usuario, id);
}

export async function cancelar(usuario, id, comentario, req) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido('Solo el jefe del área cancela tareas');
  if (['aprobada', 'cancelada'].includes(t.estado)) throw errores.conflicto('La tarea ya está cerrada');
  await transaccion(async (conn) => {
    const [abiertos] = await conn.execute('SELECT DISTINCT empleado_id FROM registros_horas WHERE tarea_id = ? AND fin_at IS NULL', [id]);
    for (const a of abiertos) await cerrarHoras(conn, id, a.empleado_id);
    await cambiarEstado(conn, t, usuario, 'cancelada', comentario ?? null);
  });
  await auditar(req, { accion: 'cancelar', entidad: 'tarea', entidadId: id });
  await avisarAsignados(id, { tipo: 'tarea_cancelada', titulo: `Se canceló: ${t.titulo}`, mensaje: comentario ?? null });
  return obtener(usuario, id);
}

// ---------------------------------------------------------------- comentarios y lista de control

export async function comentar(usuario, id, texto, req) {
  const { t, esAsignado, puedeGestionar } = await cargar(usuario, id);
  if (!esAsignado && !puedeGestionar && t.creado_por !== usuario.id) throw errores.prohibido();
  await query('INSERT INTO tarea_comentarios (tarea_id, usuario_id, texto) VALUES (?, ?, ?)', [id, usuario.id, texto]);
  await auditar(req, { accion: 'comentar', entidad: 'tarea', entidadId: id });
  return obtener(usuario, id);
}

export async function agregarItem(usuario, id, texto) {
  const { t, puedeGestionar } = await cargar(usuario, id);
  if (!puedeGestionar) throw errores.prohibido();
  if (['aprobada', 'cancelada'].includes(t.estado)) throw errores.conflicto('La tarea ya está cerrada');
  await query('INSERT INTO tarea_checklist (tarea_id, texto, orden) VALUES (?, ?, (SELECT COALESCE(MAX(c.orden), -1) + 1 FROM (SELECT orden FROM tarea_checklist WHERE tarea_id = ?) c))', [id, texto, id]);
  return obtener(usuario, id);
}

export async function marcarItem(usuario, id, itemId, hecho) {
  const { t, esAsignado, puedeGestionar } = await cargar(usuario, id);
  if (!esAsignado && !puedeGestionar) throw errores.prohibido();
  if (['aprobada', 'cancelada', 'en_revision'].includes(t.estado)) throw errores.conflicto('La tarea no se puede modificar en este estado');
  const r = await query('UPDATE tarea_checklist SET hecho = ? WHERE id = ? AND tarea_id = ?', [hecho, itemId, id]);
  if (!r.affectedRows) throw errores.noEncontrado();
  return obtener(usuario, id);
}
