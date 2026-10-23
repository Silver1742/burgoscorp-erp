// Fichaje de entrada y salida. Cada empleado ficha solo por sí mismo; RRHH puede corregir.
import { query, queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { hoy } from '../utils/fechas.js';
import { resolverPermiso, filtroAlcance } from './permisos.js';
import { auditar } from './auditoria.js';

const HORAS_MAX_JORNADA = 16; // un fichaje abierto más tiempo que esto se considera olvidado

function exigirLegajo(usuario) {
  if (!usuario.empleado_id) throw errores.negocio('Tu cuenta no está vinculada a un legajo. Pedile a RRHH que la vincule.');
}

const abierta = (empleadoId) => queryOne(
  `SELECT * FROM asistencias WHERE empleado_id = ? AND salida_at IS NULL
   AND entrada_at > UTC_TIMESTAMP() - INTERVAL ${HORAS_MAX_JORNADA} HOUR ORDER BY entrada_at DESC LIMIT 1`,
  [empleadoId],
);

export async function estadoHoy(usuario) {
  exigirLegajo(usuario);
  const actual = await abierta(usuario.empleado_id);
  const registros = await query(
    'SELECT id, entrada_at, salida_at, origen FROM asistencias WHERE empleado_id = ? AND fecha = ? ORDER BY entrada_at',
    [usuario.empleado_id, hoy()],
  );
  const minutos = registros.reduce((acc, r) => {
    const fin = r.salida_at ? new Date(r.salida_at) : new Date();
    return acc + Math.max(0, (fin - new Date(r.entrada_at)) / 60000);
  }, 0);
  return { dentro: Boolean(actual), desde: actual?.entrada_at ?? null, registros, minutosHoy: Math.round(minutos) };
}

export async function ficharEntrada(usuario, req) {
  exigirLegajo(usuario);
  if (await abierta(usuario.empleado_id)) throw errores.conflicto('Ya registraste la entrada. Primero registrá la salida.');
  const r = await query(
    "INSERT INTO asistencias (empleado_id, fecha, entrada_at, origen) VALUES (?, ?, UTC_TIMESTAMP(), 'app')",
    [usuario.empleado_id, hoy()],
  );
  await auditar(req, { accion: 'fichar_entrada', entidad: 'asistencia', entidadId: r.insertId });
  return estadoHoy(usuario);
}

export async function ficharSalida(usuario, req) {
  exigirLegajo(usuario);
  const actual = await abierta(usuario.empleado_id);
  if (!actual) throw errores.conflicto('No tenés una entrada registrada');
  await query('UPDATE asistencias SET salida_at = UTC_TIMESTAMP() WHERE id = ? AND salida_at IS NULL', [actual.id]);
  await auditar(req, { accion: 'fichar_salida', entidad: 'asistencia', entidadId: actual.id });
  return estadoHoy(usuario);
}

export async function listar(usuario, filtros) {
  const permiso = await resolverPermiso(usuario, 'RRHH', 'ver');
  const alc = filtroAlcance(usuario, permiso.alcance, { areaCol: 'e.area_id', propioCol: 's.empleado_id' });
  const where = [`(${alc.sql})`];
  const params = [...alc.params];
  if (filtros.empleado_id) { where.push('s.empleado_id = ?'); params.push(filtros.empleado_id); }
  if (filtros.desde) { where.push('s.fecha >= ?'); params.push(filtros.desde); }
  if (filtros.hasta) { where.push('s.fecha <= ?'); params.push(filtros.hasta); }
  const condicion = where.join(' AND ');
  const offset = (filtros.pagina - 1) * filtros.limite;

  const filas = await query(`
    SELECT s.*, e.legajo, e.nombre, e.apellido, a.nombre AS area_nombre,
           ROUND(TIMESTAMPDIFF(MINUTE, s.entrada_at, COALESCE(s.salida_at, UTC_TIMESTAMP())) / 60, 2) AS horas
    FROM asistencias s JOIN empleados e ON e.id = s.empleado_id JOIN areas a ON a.id = e.area_id
    WHERE ${condicion} ORDER BY s.entrada_at DESC LIMIT ${Number(filtros.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM asistencias s JOIN empleados e ON e.id = s.empleado_id
    WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: filtros.pagina, limite: filtros.limite, total } };
}

/** Corrección manual (olvido de fichaje). Solo RRHH; queda auditada con el motivo. */
export async function corregir(usuario, id, datos, req) {
  const permiso = await resolverPermiso(usuario, 'RRHH', 'editar');
  if (!permiso.permitido || permiso.alcance !== 'todo') throw errores.prohibido('Solo RRHH puede corregir fichajes');
  const actual = await queryOne('SELECT * FROM asistencias WHERE id = ?', [id]);
  if (!actual) throw errores.noEncontrado();

  const entrada = datos.entrada_at ? new Date(datos.entrada_at) : new Date(actual.entrada_at);
  const salida = datos.salida_at === undefined ? actual.salida_at : (datos.salida_at && new Date(datos.salida_at));
  if (salida && salida < entrada) throw errores.validacion([{ campo: 'body.salida_at', mensaje: 'La salida no puede ser anterior a la entrada' }]);
  if (entrada > new Date()) throw errores.validacion([{ campo: 'body.entrada_at', mensaje: 'La entrada no puede estar en el futuro' }]);

  await query("UPDATE asistencias SET entrada_at = ?, salida_at = ?, origen = 'manual', observacion = ? WHERE id = ?",
    [entrada, salida ?? null, datos.observacion, id]);
  await auditar(req, { accion: 'corregir', entidad: 'asistencia', entidadId: id, detalle: { motivo: datos.observacion } });
  return queryOne('SELECT * FROM asistencias WHERE id = ?', [id]);
}
