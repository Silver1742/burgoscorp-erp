// Legajo = la ficha de la persona como empleado de BurgosCorp: número (L0031), área, puesto, jefe,
// habilidades, fecha de ingreso y costo por hora. Es lo que la ubica en la empresa: sin legajo una
// cuenta no ve ningún módulo, porque los permisos dependen del área.
//
// Cuando el administrador habilita a alguien (o le crea la cuenta) el legajo se arma acá mismo, con el
// número siguiente: no hace falta que RRHH lo haya cargado antes.
import { errores } from '../utils/errores.js';
import { hoy } from '../utils/fechas.js';

/** Próximo número de legajo (L0001, L0002…). Bloquea la tabla para que dos altas no tomen el mismo. */
async function proximoLegajo(conn) {
  const [[{ ultimo }]] = await conn.execute(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(legajo, 2) AS UNSIGNED)), 0) AS ultimo FROM empleados WHERE legajo REGEXP '^L[0-9]+$' FOR UPDATE");
  return `L${String(Number(ultimo) + 1).padStart(4, '0')}`;
}

/** Valida que el área exista y que el puesto (si viene) sea de esa área. Devuelve el jefe del área. */
async function validarArea(conn, areaId, puestoId) {
  const [[area]] = await conn.execute('SELECT id, jefe_empleado_id FROM areas WHERE id = ? AND activo = 1', [areaId]);
  if (!area) throw errores.validacion([{ campo: 'body.area_id', mensaje: 'El área no existe' }]);
  if (puestoId) {
    const [[puesto]] = await conn.execute('SELECT id FROM puestos WHERE id = ? AND area_id = ? AND activo = 1', [puestoId, areaId]);
    if (!puesto) throw errores.validacion([{ campo: 'body.puesto_id', mensaje: 'Ese puesto no es de esa área' }]);
  }
  return area;
}

/** Reemplaza las habilidades del legajo por las elegidas (las certificadas quedan "a cargar el vencimiento"). */
export async function guardarHabilidades(conn, empleadoId, habilidades = []) {
  const ids = habilidades.map((h) => h.habilidad_id);
  if (ids.length) {
    const [filas] = await conn.query('SELECT id FROM habilidades WHERE id IN (?)', [ids]);
    if (filas.length !== new Set(ids).size) throw errores.validacion([{ campo: 'body.habilidades', mensaje: 'Alguna habilidad no existe' }]);
  }
  await conn.execute('DELETE FROM empleado_habilidades WHERE empleado_id = ?', [empleadoId]);
  for (const h of habilidades) {
    await conn.execute('INSERT INTO empleado_habilidades (empleado_id, habilidad_id, nivel) VALUES (?, ?, ?)',
      [empleadoId, h.habilidad_id, h.nivel ?? 'basico']);
  }
}

/**
 * Si es jefe y el área no tiene jefe, queda a cargo del área. Al resto le pone de supervisor
 * al jefe del área (cuando no es él mismo).
 */
async function ubicarEnArea(conn, empleadoId, area, rol) {
  let jefeId = area.jefe_empleado_id;
  if (rol === 'JEFE' && !jefeId) {
    await conn.execute('UPDATE areas SET jefe_empleado_id = ? WHERE id = ?', [empleadoId, area.id]);
    jefeId = empleadoId;
  }
  await conn.execute('UPDATE empleados SET supervisor_id = ? WHERE id = ?', [jefeId && jefeId !== empleadoId ? jefeId : null, empleadoId]);
}

/**
 * Crea el legajo de una persona y devuelve su id.
 * datos: { nombre, apellido, email, area_id, puesto_id?, dni?, habilidades?: [{ habilidad_id, nivel }] }
 */
export async function crearLegajo(conn, datos, rol) {
  const area = await validarArea(conn, datos.area_id, datos.puesto_id);
  const legajo = await proximoLegajo(conn);
  let r;
  try {
    [r] = await conn.execute(
      `INSERT INTO empleados (legajo, nombre, apellido, dni, email_laboral, area_id, puesto_id, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [legajo, datos.nombre, datos.apellido, datos.dni ?? null, datos.email ?? null, datos.area_id, datos.puesto_id ?? null, hoy()]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw errores.conflicto('Ya hay un legajo con ese DNI');
    throw err;
  }
  await guardarHabilidades(conn, r.insertId, datos.habilidades);
  await ubicarEnArea(conn, r.insertId, area, rol);
  return { id: r.insertId, legajo };
}

/** Cambia área, puesto y habilidades de un legajo que ya existe. */
export async function actualizarLegajo(conn, empleadoId, datos, rol) {
  const area = await validarArea(conn, datos.area_id, datos.puesto_id);
  // Si deja de estar en un área que tenía a cargo, el área queda sin jefe hasta que se asigne otro.
  await conn.execute('UPDATE areas SET jefe_empleado_id = NULL WHERE jefe_empleado_id = ? AND id <> ?', [empleadoId, datos.area_id]);
  await conn.execute('UPDATE empleados SET area_id = ?, puesto_id = ? WHERE id = ?', [datos.area_id, datos.puesto_id ?? null, empleadoId]);
  if (datos.dni) await conn.execute('UPDATE empleados SET dni = ? WHERE id = ?', [datos.dni, empleadoId]);
  if (datos.habilidades) await guardarHabilidades(conn, empleadoId, datos.habilidades);
  await ubicarEnArea(conn, empleadoId, area, rol);
}
