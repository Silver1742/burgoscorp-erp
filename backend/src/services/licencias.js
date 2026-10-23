// Solicitudes de licencia y vacaciones con circuito de aprobación en dos pasos:
//
//   empleado pide ──▶ pendiente ──(jefe de su área)──▶ aprobada_jefe ──(RRHH)──▶ aprobada
//                        │                                  │
//                        └──────── rechazada / cancelada ───┘
//
// Si quien pide es jefe (o su área no tiene jefe), aprueba RRHH directamente.
// Nadie aprueba su propia solicitud.
import { query, queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { hoy, sumarDias, diasHabiles, fechaAr } from '../utils/fechas.js';
import { resolverPermiso, filtroAlcance } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuariosRrhh, usuarioJefeDeArea } from './notificaciones.js';

const TIPOS = { vacaciones: 'Vacaciones', enfermedad: 'Enfermedad', estudio: 'Examen / estudio', personal: 'Trámite personal', otro: 'Otro' };

const SELECT = `
  SELECT l.*, e.legajo, e.nombre, e.apellido, e.area_id, a.nombre AS area_nombre,
         (e.id = a.jefe_empleado_id) AS solicitante_es_jefe
  FROM solicitudes_licencia l
  JOIN empleados e ON e.id = l.empleado_id
  JOIN areas a ON a.id = e.area_id`;

function exigirLegajo(usuario) {
  if (!usuario.empleado_id) throw errores.negocio('Tu cuenta no está vinculada a un legajo. Pedile a RRHH que la vincule.');
}

export async function solicitar(usuario, datos, req) {
  exigirLegajo(usuario);
  const { tipo, fecha_desde: desde, fecha_hasta: hasta, motivo = null } = datos;

  // Enfermedad se puede cargar hasta 7 días hacia atrás (se avisa al volver); el resto, desde hoy.
  const minimo = tipo === 'enfermedad' ? sumarDias(hoy(), -7) : hoy();
  if (desde < minimo) throw errores.validacion([{ campo: 'body.fecha_desde', mensaje: 'La fecha de inicio ya pasó' }]);
  if (hasta > sumarDias(hoy(), 365)) throw errores.validacion([{ campo: 'body.fecha_hasta', mensaje: 'Máximo un año hacia adelante' }]);
  const dias = diasHabiles(desde, hasta);
  if (dias === 0) throw errores.validacion([{ campo: 'body.fecha_hasta', mensaje: 'El período no tiene días hábiles' }]);

  const superpuesta = await queryOne(
    `SELECT id FROM solicitudes_licencia WHERE empleado_id = ? AND estado IN ('pendiente','aprobada_jefe','aprobada')
     AND fecha_desde <= ? AND fecha_hasta >= ?`,
    [usuario.empleado_id, hasta, desde],
  );
  if (superpuesta) throw errores.conflicto('Ya tenés una solicitud en esas fechas');

  const r = await query(
    'INSERT INTO solicitudes_licencia (empleado_id, tipo, fecha_desde, fecha_hasta, dias, motivo) VALUES (?, ?, ?, ?, ?, ?)',
    [usuario.empleado_id, tipo, desde, hasta, dias, motivo],
  );
  await auditar(req, { accion: 'crear', entidad: 'licencia', entidadId: r.insertId });

  const solicitud = await obtener(r.insertId);
  // Aviso a quien tiene que aprobar primero.
  const jefe = solicitud.solicitante_es_jefe ? null : await usuarioJefeDeArea(solicitud.area_id);
  await notificar(jefe ?? await usuariosRrhh(), {
    tipo: 'licencia_pendiente',
    titulo: `${solicitud.nombre} ${solicitud.apellido} pidió ${TIPOS[tipo].toLowerCase()}`,
    mensaje: `Del ${fechaAr(desde)} al ${fechaAr(hasta)} (${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'})`,
    entidad: 'licencia', entidadId: r.insertId,
  });
  return solicitud;
}

export function obtener(id) {
  return queryOne(`${SELECT} WHERE l.id = ?`, [id]);
}

/** Listado según alcance: lo propio, el equipo (jefe) o toda la empresa (RRHH / gerencia). */
export async function listar(usuario, filtros) {
  const permiso = await resolverPermiso(usuario, 'RRHH', 'ver');
  const alc = filtroAlcance(usuario, permiso.alcance, { areaCol: 'e.area_id', propioCol: 'l.empleado_id' });
  const where = [`(${alc.sql})`];
  const params = [...alc.params];

  if (filtros.estado) { where.push('l.estado = ?'); params.push(filtros.estado); }
  if (filtros.empleado_id) { where.push('l.empleado_id = ?'); params.push(filtros.empleado_id); }
  if (filtros.para_aprobar) {
    // Lo que este usuario puede resolver ahora, sin incluir lo propio.
    const condiciones = [];
    if (usuario.rol === 'JEFE' && usuario.area_id) {
      condiciones.push("(l.estado = 'pendiente' AND e.area_id = ? AND e.id <> a.jefe_empleado_id)");
      params.push(usuario.area_id);
    }
    if (await esRrhh(usuario)) {
      condiciones.push("(l.estado = 'aprobada_jefe' OR (l.estado = 'pendiente' AND (e.id = a.jefe_empleado_id OR a.jefe_empleado_id IS NULL)))");
    }
    where.push(condiciones.length ? `(${condiciones.join(' OR ')})` : '1=0');
    where.push('l.empleado_id <> ?');
    params.push(usuario.empleado_id ?? 0);
  }

  const condicion = where.join(' AND ');
  const offset = (filtros.pagina - 1) * filtros.limite;
  const filas = await query(`${SELECT} WHERE ${condicion} ORDER BY l.created_at DESC, l.id DESC
    LIMIT ${Number(filtros.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM solicitudes_licencia l
    JOIN empleados e ON e.id = l.empleado_id JOIN areas a ON a.id = e.area_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: filtros.pagina, limite: filtros.limite, total } };
}

/** ¿Aprueba en nombre de RRHH (jefe de RRHH o admin)? */
async function esRrhh(usuario) {
  const p = await resolverPermiso(usuario, 'RRHH', 'aprobar');
  return p.permitido && p.alcance === 'todo';
}

async function cargarParaResolver(id, usuario) {
  const s = await obtener(id);
  if (!s) throw errores.noEncontrado('La solicitud no existe');
  if (s.empleado_id === usuario.empleado_id) throw errores.prohibido('No podés resolver tu propia solicitud');
  return s;
}

export async function aprobar(id, usuario, comentario, req) {
  const s = await cargarParaResolver(id, usuario);
  const rrhh = await esRrhh(usuario);
  const esJefeDelArea = usuario.rol === 'JEFE' && usuario.area_id === s.area_id;
  const vaDirectoARrhh = s.solicitante_es_jefe || !(await usuarioJefeDeArea(s.area_id));

  let nuevo;
  if (s.estado === 'pendiente' && esJefeDelArea && !s.solicitante_es_jefe) nuevo = 'aprobada_jefe';
  else if (rrhh && (s.estado === 'aprobada_jefe' || (s.estado === 'pendiente' && vaDirectoARrhh))) nuevo = 'aprobada';
  else if (s.estado === 'pendiente' && rrhh) throw errores.negocio('Primero la tiene que aprobar el jefe del área');
  else if (!['pendiente', 'aprobada_jefe'].includes(s.estado)) throw errores.conflicto('La solicitud ya fue resuelta');
  else throw errores.prohibido('No te corresponde aprobar esta solicitud');

  const columna = nuevo === 'aprobada_jefe' ? 'aprobado_jefe_por' : 'aprobado_rrhh_por';
  // El estado esperado en el WHERE evita que dos personas la resuelvan a la vez.
  const r = await query(
    `UPDATE solicitudes_licencia SET estado = ?, ${columna} = ?, comentario_resolucion = COALESCE(?, comentario_resolucion),
       resuelto_at = IF(? = 'aprobada', UTC_TIMESTAMP(), resuelto_at) WHERE id = ? AND estado = ?`,
    [nuevo, usuario.id, comentario ?? null, nuevo, id, s.estado],
  );
  if (!r.affectedRows) throw errores.conflicto('La solicitud cambió mientras la revisabas. Actualizá y probá de nuevo.');
  await auditar(req, { accion: 'aprobar', entidad: 'licencia', entidadId: id, detalle: { estado: nuevo } });

  const solicitante = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ?', [s.empleado_id]);
  if (nuevo === 'aprobada') {
    await notificar(solicitante?.id, { tipo: 'licencia_aprobada', titulo: `Aprobaron tu solicitud de ${TIPOS[s.tipo].toLowerCase()}`, mensaje: `Del ${fechaAr(s.fecha_desde)} al ${fechaAr(s.fecha_hasta)}`, entidad: 'licencia', entidadId: id });
  } else {
    await notificar(await usuariosRrhh(), { tipo: 'licencia_pendiente', titulo: `Licencia de ${s.nombre} ${s.apellido} aprobada por su jefe`, mensaje: 'Falta la aprobación de RRHH', entidad: 'licencia', entidadId: id });
  }
  return obtener(id);
}

export async function rechazar(id, usuario, comentario, req) {
  const s = await cargarParaResolver(id, usuario);
  const puede = (await esRrhh(usuario)) || (usuario.rol === 'JEFE' && usuario.area_id === s.area_id && s.estado === 'pendiente');
  if (!['pendiente', 'aprobada_jefe'].includes(s.estado)) throw errores.conflicto('La solicitud ya fue resuelta');
  if (!puede) throw errores.prohibido('No te corresponde resolver esta solicitud');

  const r = await query(
    `UPDATE solicitudes_licencia SET estado = 'rechazada', comentario_resolucion = ?, resuelto_at = UTC_TIMESTAMP()
     WHERE id = ? AND estado = ?`, [comentario, id, s.estado]);
  if (!r.affectedRows) throw errores.conflicto('La solicitud cambió mientras la revisabas. Actualizá y probá de nuevo.');
  await auditar(req, { accion: 'rechazar', entidad: 'licencia', entidadId: id });

  const solicitante = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ?', [s.empleado_id]);
  await notificar(solicitante?.id, { tipo: 'licencia_rechazada', titulo: `Rechazaron tu solicitud de ${TIPOS[s.tipo].toLowerCase()}`, mensaje: comentario, entidad: 'licencia', entidadId: id });
  return obtener(id);
}

export async function cancelar(id, usuario, req) {
  const s = await obtener(id);
  if (!s || s.empleado_id !== usuario.empleado_id) throw errores.noEncontrado('La solicitud no existe');
  const r = await query(
    `UPDATE solicitudes_licencia SET estado = 'cancelada', resuelto_at = UTC_TIMESTAMP()
     WHERE id = ? AND estado IN ('pendiente','aprobada_jefe')`, [id]);
  if (!r.affectedRows) throw errores.conflicto('Solo se puede cancelar una solicitud que todavía no fue resuelta');
  await auditar(req, { accion: 'cancelar', entidad: 'licencia', entidadId: id });
  return obtener(id);
}
