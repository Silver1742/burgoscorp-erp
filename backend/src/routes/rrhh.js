// Recursos Humanos y Organización: legajos, habilidades, fichaje, licencias, EPP y organigrama.
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { crearRecursoCrud } from '../utils/crud.js';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import { filtroAlcance, resolverPermiso } from '../services/permisos.js';
import { auditar } from '../services/auditoria.js';
import * as asistencias from '../services/asistencias.js';
import * as licencias from '../services/licencias.js';
import { id, paramsId } from '../validators/comunes.js';
import * as v from '../validators/rrhh.js';
import { errores } from '../utils/errores.js';
import { hoy as hoyEmpresa } from '../utils/fechas.js';

const router = Router();

// Datos personales que solo ven RRHH, el admin y el propio empleado (minimización, Ley 25.326).
// Un jefe ve a su equipo y Gerencia a todos, pero sin DNI, CUIL, nacimiento, domicilio ni costo.
const DATOS_PERSONALES = ['dni', 'cuil', 'fecha_nacimiento', 'direccion', 'costo_hora'];
const esRrhhOAdmin = (req) => req.usuario.rol === 'ADMIN' || (req.permiso.esDuenia && req.permiso.alcance === 'todo');

/** Altas y cambios de datos de RRHH: solo con alcance de toda la empresa (área RRHH o admin). */
function exigirRrhh(req, mensaje = 'Solo RRHH puede hacer este cambio') {
  if (req.permiso.alcance !== 'todo') throw errores.prohibido(mensaje);
}

// ---------------------------------------------------------------- legajos
router.use('/empleados', crearRecursoCrud({
  modulo: 'RRHH', tabla: 'empleados', entidad: 'empleado',
  select: `t.*, a.nombre AS area_nombre, p.nombre AS puesto_nombre,
           CONCAT(s.nombre, ' ', s.apellido) AS supervisor_nombre,
           (SELECT u.id FROM usuarios u WHERE u.empleado_id = t.id) AS usuario_id,
           (SELECT GROUP_CONCAT(h.nombre ORDER BY h.nombre SEPARATOR ', ')
              FROM empleado_habilidades eh JOIN habilidades h ON h.id = eh.habilidad_id
             WHERE eh.empleado_id = t.id) AS habilidades`,
  joins: 'JOIN areas a ON a.id = t.area_id LEFT JOIN puestos p ON p.id = t.puesto_id LEFT JOIN empleados s ON s.id = t.supervisor_id',
  busqueda: ['t.legajo', 't.nombre', 't.apellido', "CONCAT(t.nombre, ' ', t.apellido)"], // sin DNI: no se puede deducir
  filtros: {
    area_id: { col: 't.area_id', esquema: id },
    estado: { col: 't.estado', esquema: z.enum(['activo', 'licencia', 'baja']) },
  },
  ordenables: { apellido: 't.apellido', legajo: 't.legajo', ingreso: 't.fecha_ingreso', area: 'a.nombre' },
  ordenDefecto: 't.apellido',
  esquemaCrear: v.empleado,
  esquemaEditar: v.empleadoEditar,
  sinBorrar: true, // la baja es estado = 'baja' + fecha_egreso, para conservar la historia
  alcance: { areaCol: 't.area_id', areaCampo: 'area_id', propioCol: 't.id' },
  ocultar: (req, fila) => (esRrhhOAdmin(req) || fila.id === req.usuario.empleado_id ? [] : DATOS_PERSONALES),
  async antesDeGuardar(datos, { req, id: empleadoId }) {
    if (esRrhhOAdmin(req)) return datos;
    // Fuera de RRHH: cada uno actualiza solo sus propios datos de contacto (ni el jefe los de su equipo).
    const ajenos = Object.keys(datos).filter((c) => !v.CAMPOS_CONTACTO.includes(c));
    if (!empleadoId || ajenos.length) {
      throw errores.prohibido('Solo RRHH puede dar de alta legajos o cambiar área, puesto, estado o costo');
    }
    if (empleadoId !== req.usuario.empleado_id) throw errores.prohibido('Solo podés cambiar tus propios datos de contacto');
    return datos;
  },
}));

// Habilidades de un empleado (para asignar tareas según lo que sabe hacer).
router.get('/empleados/:id/habilidades', autenticado, requierePermiso('RRHH', 'ver'), validar({ params: paramsId }), async (req, res) => {
  const alc = filtroAlcance(req.usuario, req.permiso.alcance, { areaCol: 'e.area_id', propioCol: 'e.id' });
  const empleado = await queryOne(`SELECT e.id FROM empleados e WHERE e.id = ? AND (${alc.sql})`, [req.validado.params.id, ...alc.params]);
  if (!empleado) throw errores.noEncontrado();
  const filas = await query(`
    SELECT h.id AS habilidad_id, h.codigo, h.nombre, h.requiere_certificacion, eh.nivel, eh.certificado_vence,
           (h.requiere_certificacion = 1 AND (eh.certificado_vence IS NULL OR eh.certificado_vence < CURDATE())) AS vencida
    FROM empleado_habilidades eh JOIN habilidades h ON h.id = eh.habilidad_id
    WHERE eh.empleado_id = ? ORDER BY h.nombre`, [empleado.id]);
  res.json({ ok: true, data: filas });
});

router.put('/empleados/:id/habilidades/:habilidadId', autenticado, requierePermiso('RRHH', 'editar'),
  validar({ params: v.paramsEmpleadoHabilidad, body: v.habilidadEmpleado }), async (req, res) => {
    exigirRrhh(req);
    const { id: empleadoId, habilidadId } = req.validado.params;
    const { nivel, certificado_vence: vence = null } = req.validado.body;
    const hab = await queryOne('SELECT requiere_certificacion FROM habilidades WHERE id = ?', [habilidadId]);
    if (!hab) throw errores.noEncontrado('La habilidad no existe');
    if (hab.requiere_certificacion && !vence) {
      throw errores.validacion([{ campo: 'body.certificado_vence', mensaje: 'Esta habilidad requiere la fecha de vencimiento de la certificación' }]);
    }
    await query(`INSERT INTO empleado_habilidades (empleado_id, habilidad_id, nivel, certificado_vence) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE nivel = VALUES(nivel), certificado_vence = VALUES(certificado_vence)`,
    [empleadoId, habilidadId, nivel, vence]);
    await auditar(req, { accion: 'editar', entidad: 'empleado_habilidad', entidadId: empleadoId, detalle: { habilidadId, nivel } });
    res.json({ ok: true, data: { empleado_id: empleadoId, habilidad_id: habilidadId, nivel, certificado_vence: vence } });
  });

router.delete('/empleados/:id/habilidades/:habilidadId', autenticado, requierePermiso('RRHH', 'editar'),
  validar({ params: v.paramsEmpleadoHabilidad }), async (req, res) => {
    exigirRrhh(req);
    const { id: empleadoId, habilidadId } = req.validado.params;
    const r = await query('DELETE FROM empleado_habilidades WHERE empleado_id = ? AND habilidad_id = ?', [empleadoId, habilidadId]);
    if (!r.affectedRows) throw errores.noEncontrado();
    await auditar(req, { accion: 'borrar', entidad: 'empleado_habilidad', entidadId: empleadoId, detalle: { habilidadId } });
    res.status(204).end();
  });

// ---------------------------------------------------------------- fichaje
// Fichar es una acción personal: alcanza con tener legajo (no depende del permiso del módulo).
router.get('/asistencias/hoy', autenticado, async (req, res) => {
  res.json({ ok: true, data: await asistencias.estadoHoy(req.usuario) });
});
router.post('/asistencias/entrada', autenticado, async (req, res) => {
  res.status(201).json({ ok: true, data: await asistencias.ficharEntrada(req.usuario, req) });
});
router.post('/asistencias/salida', autenticado, async (req, res) => {
  res.json({ ok: true, data: await asistencias.ficharSalida(req.usuario, req) });
});
router.get('/asistencias', autenticado, requierePermiso('RRHH', 'ver'), validar({ query: v.filtroAsistencias }), async (req, res) => {
  res.json({ ok: true, ...(await asistencias.listar(req.usuario, req.validado.query)) });
});
router.put('/asistencias/:id', autenticado, requierePermiso('RRHH', 'editar'),
  validar({ params: paramsId, body: v.correccionAsistencia }), async (req, res) => {
    res.json({ ok: true, data: await asistencias.corregir(req.usuario, req.validado.params.id, req.validado.body, req) });
  });

// ---------------------------------------------------------------- licencias
router.get('/licencias', autenticado, requierePermiso('RRHH', 'ver'), validar({ query: v.filtroLicencias }), async (req, res) => {
  res.json({ ok: true, ...(await licencias.listar(req.usuario, req.validado.query)) });
});
router.post('/licencias', autenticado, validar({ body: v.solicitudLicencia }), async (req, res) => {
  res.status(201).json({ ok: true, data: await licencias.solicitar(req.usuario, req.validado.body, req) });
});
router.post('/licencias/:id/aprobar', autenticado, requierePermiso('RRHH', 'aprobar'),
  validar({ params: paramsId, body: v.resolucion }), async (req, res) => {
    res.json({ ok: true, data: await licencias.aprobar(req.validado.params.id, req.usuario, req.validado.body.comentario, req) });
  });
router.post('/licencias/:id/rechazar', autenticado, requierePermiso('RRHH', 'aprobar'),
  validar({ params: paramsId, body: v.rechazo }), async (req, res) => {
    res.json({ ok: true, data: await licencias.rechazar(req.validado.params.id, req.usuario, req.validado.body.comentario, req) });
  });
router.post('/licencias/:id/cancelar', autenticado, validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await licencias.cancelar(req.validado.params.id, req.usuario, req) });
});

// ---------------------------------------------------------------- elementos de protección personal
router.use('/epp-entregas', crearRecursoCrud({
  modulo: 'RRHH', tabla: 'epp_entregas', entidad: 'epp',
  select: `t.*, e.legajo, CONCAT(e.nombre, ' ', e.apellido) AS empleado_nombre,
           (t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURDATE()) AS vencido`,
  joins: 'JOIN empleados e ON e.id = t.empleado_id',
  busqueda: ['t.elemento', 'e.apellido', 'e.legajo'],
  filtros: { empleado_id: { col: 't.empleado_id', esquema: id } },
  ordenables: { entrega: 't.fecha_entrega', vencimiento: 't.fecha_vencimiento' },
  ordenDefecto: 't.fecha_entrega',
  esquemaCrear: v.epp,
  alcance: { areaCol: 'e.area_id', propioCol: 't.empleado_id' },
  async antesDeGuardar(datos, { req, id: eppId }) {
    exigirRrhh(req, 'Solo RRHH registra entregas de EPP');
    return eppId ? datos : { ...datos, entregado_por: req.usuario.id };
  },
}));

// ---------------------------------------------------------------- organigrama
// Personal: cuánta gente trabaja, por área (con su jefe), quién vino hoy y qué cuentas faltan ubicar.
// Toda la empresa para administración, gerencia y RRHH; un jefe ve solo su área.
router.get('/personal/resumen', autenticado, requierePermiso('RRHH', 'ver'), async (req, res) => {
  if (!['todo', 'area'].includes(req.permiso.alcance)) throw errores.prohibido('Solo jefes, RRHH, gerencia y administración ven el personal');
  const alc = filtroAlcance(req.usuario, req.permiso.alcance, { areaCol: 'a.id' });
  const fecha = hoyEmpresa();
  const areas = await query(`
    SELECT a.id, a.codigo, a.nombre, CONCAT(j.nombre, ' ', j.apellido) AS jefe_nombre,
           COUNT(e.id) AS total,
           SUM(e.estado = 'activo') AS activos,
           SUM(e.estado = 'licencia') AS en_licencia,
           SUM(e.estado <> 'baja' AND EXISTS (SELECT 1 FROM asistencias s WHERE s.empleado_id = e.id AND s.fecha = ?)) AS vinieron_hoy,
           SUM(e.estado <> 'baja' AND EXISTS (SELECT 1 FROM asistencias s WHERE s.empleado_id = e.id AND s.fecha = ? AND s.salida_at IS NULL)) AS trabajando_ahora,
           SUM(e.estado <> 'baja' AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.empleado_id = e.id)) AS sin_cuenta
    FROM areas a
    LEFT JOIN empleados j ON j.id = a.jefe_empleado_id
    LEFT JOIN empleados e ON e.area_id = a.id AND e.estado <> 'baja'
    WHERE a.activo = 1 AND (${alc.sql})
    GROUP BY a.id ORDER BY a.nombre`, [fecha, fecha, ...alc.params]);
  const num = (v) => Number(v ?? 0);
  const totales = areas.reduce((t, a) => ({
    personal: t.personal + num(a.total),
    activos: t.activos + num(a.activos),
    en_licencia: t.en_licencia + num(a.en_licencia),
    vinieron_hoy: t.vinieron_hoy + num(a.vinieron_hoy),
    trabajando_ahora: t.trabajando_ahora + num(a.trabajando_ahora),
    sin_cuenta: t.sin_cuenta + num(a.sin_cuenta),
  }), { personal: 0, activos: 0, en_licencia: 0, vinieron_hoy: 0, trabajando_ahora: 0, sin_cuenta: 0 });
  // Cuentas habilitadas que todavía no tienen área (solo las ve quien administra toda la empresa).
  const sinArea = req.permiso.alcance === 'todo' ? await query(`
    SELECT u.id, u.nombre, u.apellido, u.email, r.codigo AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id
    WHERE u.empleado_id IS NULL AND u.estado_cuenta = 'habilitada' AND u.activo = 1 AND r.codigo <> 'ADMIN'
    ORDER BY u.apellido`) : [];
  res.json({
    ok: true,
    data: {
      fecha, totales,
      areas: areas.map((a) => ({ ...a, total: num(a.total), activos: num(a.activos), en_licencia: num(a.en_licencia),
        vinieron_hoy: num(a.vinieron_hoy), trabajando_ahora: num(a.trabajando_ahora), sin_cuenta: num(a.sin_cuenta) })),
      cuentas_sin_area: sinArea,
    },
  });
});

// Integrantes de un área con sus datos: para el administrador, gerencia y RRHH (toda la empresa)
// y para el jefe (solo su área).
router.get('/personal/area/:id', autenticado, requierePermiso('RRHH', 'ver'), validar({ params: paramsId }), async (req, res) => {
  const areaId = req.validado.params.id;
  const { alcance } = req.permiso;
  if (!(alcance === 'todo' || (alcance === 'area' && req.usuario.area_id === areaId))) {
    throw errores.prohibido('Solo podés ver el personal de tu área');
  }
  const area = await queryOne(`
    SELECT a.id, a.codigo, a.nombre, a.descripcion, a.jefe_empleado_id, CONCAT(j.nombre, ' ', j.apellido) AS jefe_nombre
    FROM areas a LEFT JOIN empleados j ON j.id = a.jefe_empleado_id WHERE a.id = ? AND a.activo = 1`, [areaId]);
  if (!area) throw errores.noEncontrado('El área no existe');
  const fecha = hoyEmpresa();
  const integrantes = await query(`
    SELECT e.id, e.legajo, e.nombre, e.apellido, e.estado, e.telefono, e.fecha_ingreso,
           COALESCE(u.email, e.email_laboral) AS email, p.nombre AS puesto, r.codigo AS rol, u.id AS usuario_id,
           a.jefe_empleado_id = e.id AS es_jefe,
           (SELECT GROUP_CONCAT(CONCAT(h.nombre, ' (', eh.nivel, ')') ORDER BY h.nombre SEPARATOR ', ')
              FROM empleado_habilidades eh JOIN habilidades h ON h.id = eh.habilidad_id WHERE eh.empleado_id = e.id) AS habilidades,
           (SELECT MIN(s.entrada_at) FROM asistencias s WHERE s.empleado_id = e.id AND s.fecha = ?) AS entrada_hoy,
           EXISTS (SELECT 1 FROM asistencias s WHERE s.empleado_id = e.id AND s.fecha = ? AND s.salida_at IS NULL) AS trabajando,
           (SELECT COUNT(*) FROM tarea_asignaciones ta JOIN tareas t ON t.id = ta.tarea_id
             WHERE ta.empleado_id = e.id AND t.estado IN ('pendiente','en_curso','pausada','rechazada')) AS tareas_abiertas
    FROM empleados e
    JOIN areas a ON a.id = e.area_id
    LEFT JOIN puestos p ON p.id = e.puesto_id
    LEFT JOIN usuarios u ON u.empleado_id = e.id
    LEFT JOIN roles r ON r.id = u.rol_id
    WHERE e.area_id = ? AND e.estado <> 'baja'
    ORDER BY es_jefe DESC, e.apellido, e.nombre`, [fecha, fecha, areaId]);
  res.json({
    ok: true,
    data: {
      area,
      integrantes: integrantes.map((i) => ({
        ...i, es_jefe: Boolean(i.es_jefe), trabajando: Boolean(i.trabajando), tareas_abiertas: Number(i.tareas_abiertas),
      })),
    },
  });
});

/**
 * Ficha de una persona en una sola llamada: legajo, habilidades, cuenta, tareas abiertas y si vino
 * hoy, más qué puede hacer quien la mira (`acciones`). La ven el administrador, gerencia y RRHH
 * (toda la empresa), el jefe (su área) y la persona misma.
 */
router.get('/personas/:id', autenticado, requierePermiso('RRHH', 'ver'), validar({ params: paramsId }), async (req, res) => {
  const empleadoId = req.validado.params.id;
  const u = req.usuario;
  const e = await queryOne(`
    SELECT e.id, e.legajo, e.nombre, e.apellido, e.telefono, e.email_laboral, e.direccion, e.fecha_ingreso, e.estado,
           e.area_id, a.nombre AS area_nombre, a.jefe_empleado_id = e.id AS es_jefe, p.nombre AS puesto,
           CONCAT(s.nombre, ' ', s.apellido) AS supervisor
    FROM empleados e JOIN areas a ON a.id = e.area_id LEFT JOIN puestos p ON p.id = e.puesto_id
    LEFT JOIN empleados s ON s.id = e.supervisor_id WHERE e.id = ?`, [empleadoId]);
  if (!e) throw errores.noEncontrado('La persona no existe');
  const { alcance } = req.permiso;
  const visible = alcance === 'todo' || (alcance === 'area' && e.area_id === u.area_id) || empleadoId === u.empleado_id;
  if (!visible) throw errores.prohibido('Solo podés ver a la gente de tu área');

  const fecha = hoyEmpresa();
  const [habilidades, cuenta, tareasAbiertas, hoy] = await Promise.all([
    query(`SELECT h.nombre, eh.nivel, eh.certificado_vence, h.requiere_certificacion FROM empleado_habilidades eh
           JOIN habilidades h ON h.id = eh.habilidad_id WHERE eh.empleado_id = ? ORDER BY h.nombre`, [empleadoId]),
    queryOne(`SELECT u.id, u.email, r.codigo AS rol, u.estado_cuenta, u.activo, u.ultimo_login_at, u.totp_habilitado AS dos_pasos
              FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.empleado_id = ?`, [empleadoId]),
    query(`SELECT t.id, t.titulo, t.estado, t.prioridad FROM tarea_asignaciones ta JOIN tareas t ON t.id = ta.tarea_id
           WHERE ta.empleado_id = ? AND t.estado IN ('pendiente','en_curso','pausada','rechazada','en_revision')
           ORDER BY FIELD(t.estado,'en_curso','pausada','rechazada','pendiente','en_revision'), t.id DESC LIMIT 8`, [empleadoId]),
    queryOne('SELECT MIN(entrada_at) AS entrada, MAX(salida_at IS NULL) AS trabajando FROM asistencias WHERE empleado_id = ? AND fecha = ?', [empleadoId, fecha]),
  ]);
  const [seg, tar] = await Promise.all([resolverPermiso(u, 'SEG', 'editar'), resolverPermiso(u, 'TAR', 'crear')]);
  res.json({
    ok: true,
    data: {
      ...e, es_jefe: Boolean(e.es_jefe), habilidades,
      cuenta: cuenta ? { ...cuenta, activo: Boolean(cuenta.activo), dos_pasos: Boolean(cuenta.dos_pasos) } : null,
      tareas_abiertas: tareasAbiertas,
      hoy: { entrada: hoy?.entrada ?? null, trabajando: Boolean(hoy?.entrada && Number(hoy.trabajando)) },
      // Qué botones ve quien mira: el administrador edita todo; el jefe asigna tareas a su gente;
      // gerencia solo consulta.
      acciones: {
        editar_cuenta: seg.permitido && Boolean(cuenta) && cuenta.id !== u.id,
        editar_area: seg.permitido,
        asignar_tarea: tar.permitido && (tar.alcance === 'todo' || e.area_id === u.area_id) && e.estado === 'activo',
      },
    },
  });
});

router.get('/organigrama', autenticado, requierePermiso('ORG', 'ver'), async (req, res) => {
  const areas = await query(`
    SELECT a.id, a.codigo, a.nombre, a.descripcion, a.jefe_empleado_id,
           CONCAT(j.nombre, ' ', j.apellido) AS jefe_nombre, pj.nombre AS jefe_puesto,
           (SELECT COUNT(*) FROM empleados e WHERE e.area_id = a.id AND e.estado <> 'baja') AS empleados
    FROM areas a LEFT JOIN empleados j ON j.id = a.jefe_empleado_id LEFT JOIN puestos pj ON pj.id = j.puesto_id
    WHERE a.activo = 1 ORDER BY a.codigo = 'DIR' DESC, a.nombre`);
  res.json({ ok: true, data: areas });
});

// ---------------------------------------------------------------- notificaciones del usuario
router.get('/notificaciones', autenticado, async (req, res) => {
  const filas = await query(
    'SELECT id, tipo, titulo, mensaje, entidad, entidad_id, leida_at, created_at FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 50',
    [req.usuario.id]);
  const [{ sinLeer }] = await query('SELECT COUNT(*) AS sinLeer FROM notificaciones WHERE usuario_id = ? AND leida_at IS NULL', [req.usuario.id]);
  res.json({ ok: true, data: filas, meta: { sinLeer } });
});
router.post('/notificaciones/leidas', autenticado, async (req, res) => {
  await query('UPDATE notificaciones SET leida_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND leida_at IS NULL', [req.usuario.id]);
  res.status(204).end();
});

export default router;
