// Legajo = la ficha de la persona como empleado de BurgosCorp: número (L0031), área, puesto, jefe,
// habilidades, fecha de ingreso y costo por hora. Es lo que la ubica en la empresa: sin legajo una
// cuenta no ve ningún módulo, porque los permisos dependen del área.
//
// Cuando el administrador habilita a alguien (o le crea la cuenta) el legajo se arma acá mismo, con el
// número siguiente: no hace falta que RRHH lo haya cargado antes.
import { z } from 'zod';
import { AppError, errores } from '../utils/errores.js';
import { hoy } from '../utils/fechas.js';
import { revocarTodas } from './tokens.js';

/**
 * Qué hacer con el jefe actual de un área cuando se pone a otra persona como jefe:
 *   destituir → el actual pasa a ser empleado de la misma área;
 *   mover     → el actual pasa a ser jefe de otra área que no tenga jefe (area_id).
 */
export const jefeActual = z.object({
  accion: z.enum(['destituir', 'mover']),
  area_id: z.coerce.number().int().positive().optional(),
}).strict().refine((d) => d.accion !== 'mover' || d.area_id, { message: 'Elegí a qué área se mueve', path: ['area_id'] });

/** Jefes de un área (el titular y quien tenga rol de jefe con legajo ahí), sin contar a `excepto`. */
async function jefesDe(conn, areaId, excepto) {
  const [filas] = await conn.execute(`
    SELECT e.id, CONCAT(e.nombre, ' ', e.apellido) AS nombre, u.id AS usuario_id, r.codigo AS rol
    FROM empleados e
    JOIN areas a ON a.id = e.area_id
    LEFT JOIN usuarios u ON u.empleado_id = e.id
    LEFT JOIN roles r ON r.id = u.rol_id
    WHERE e.area_id = ? AND e.estado <> 'baja' AND e.id <> ?
      AND (a.jefe_empleado_id = e.id OR (r.codigo = 'JEFE' AND u.activo = 1))`, [areaId, excepto ?? 0]);
  return filas;
}

/**
 * Un área tiene un solo jefe. Si va a tener uno nuevo y ya hay otro, no se sigue hasta que se decida
 * qué hacer con el actual (409 JEFE_OCUPADO, con su nombre y las áreas libres a las que se puede mover).
 */
export async function resolverJefatura(conn, { areaId, empleadoId = null, decision }) {
  const actuales = await jefesDe(conn, areaId, empleadoId);
  if (!actuales.length) return;
  const [[area]] = await conn.execute('SELECT id, nombre FROM areas WHERE id = ?', [areaId]);
  if (!decision) {
    const [libres] = await conn.execute(`
      SELECT a.id, a.nombre FROM areas a WHERE a.activo = 1 AND a.id <> ? AND a.jefe_empleado_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM empleados e JOIN usuarios u ON u.empleado_id = e.id JOIN roles r ON r.id = u.rol_id
                        WHERE e.area_id = a.id AND r.codigo = 'JEFE' AND u.activo = 1 AND e.estado <> 'baja')
      ORDER BY a.nombre`, [areaId]);
    throw new AppError(409, 'JEFE_OCUPADO', `${area.nombre} ya tiene jefe: ${actuales.map((j) => j.nombre).join(', ')}. Elegí si lo destituís o lo pasás a otra área.`, [{
      campo: 'body.jefe_actual', mensaje: 'El área ya tiene jefe',
      area: { id: area.id, nombre: area.nombre },
      jefes: actuales.map((j) => ({ empleado_id: j.id, nombre: j.nombre })),
      areas_libres: libres,
    }]);
  }

  let destino = null;
  if (decision.accion === 'mover') {
    [[destino]] = await conn.execute('SELECT id, nombre, jefe_empleado_id FROM areas WHERE id = ? AND activo = 1', [decision.area_id]);
    if (!destino || destino.id === areaId) throw errores.validacion([{ campo: 'body.jefe_actual.area_id', mensaje: 'Elegí otra área' }]);
    if (actuales.length > 1 || destino.jefe_empleado_id || (await jefesDe(conn, destino.id)).length) {
      throw errores.conflicto(`${destino.nombre} también tiene jefe: elegí un área sin jefe o destituilo`);
    }
  }
  await conn.execute('UPDATE areas SET jefe_empleado_id = NULL WHERE id = ?', [areaId]);
  for (const j of actuales) {
    if (decision.accion === 'destituir') {
      // Sigue en el área como empleado; sus permisos cambian, así que se cierran sus sesiones.
      if (j.usuario_id && j.rol === 'JEFE') {
        await conn.execute("UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE codigo = 'EMPLEADO') WHERE id = ?", [j.usuario_id]);
        await revocarTodas(j.usuario_id, conn);
      }
    } else {
      await conn.execute('UPDATE empleados SET area_id = ?, puesto_id = NULL WHERE id = ?', [destino.id, j.id]);
      await conn.execute('UPDATE areas SET jefe_empleado_id = ? WHERE id = ?', [j.id, destino.id]);
      await conn.execute('UPDATE empleados SET supervisor_id = ? WHERE area_id = ? AND id <> ?', [j.id, destino.id, j.id]);
      if (j.usuario_id) await revocarTodas(j.usuario_id, conn);
    }
  }
}

/** Próximo número de legajo (L0001, L0002…). Bloquea la tabla para que dos altas no tomen el mismo. */
export async function proximoLegajo(conn) {
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
  const [[{ jefe_empleado_id: actual }]] = await conn.execute('SELECT jefe_empleado_id FROM areas WHERE id = ?', [area.id]);
  let jefeId = actual;
  if (rol === 'JEFE' && !jefeId) {
    await conn.execute('UPDATE areas SET jefe_empleado_id = ? WHERE id = ?', [empleadoId, area.id]);
    jefeId = empleadoId;
    // El equipo del área pasa a tenerlo como supervisor.
    await conn.execute('UPDATE empleados SET supervisor_id = ? WHERE area_id = ? AND id <> ?', [empleadoId, area.id, empleadoId]);
  }
  await conn.execute('UPDATE empleados SET supervisor_id = ? WHERE id = ?', [jefeId && jefeId !== empleadoId ? jefeId : null, empleadoId]);
}

/**
 * Crea el legajo de una persona y devuelve su id.
 * datos: { nombre, apellido, email, area_id, puesto_id?, dni?, habilidades?: [{ habilidad_id, nivel }] }
 */
export async function crearLegajo(conn, datos, rol) {
  const area = await validarArea(conn, datos.area_id, datos.puesto_id);
  if (rol === 'JEFE') await resolverJefatura(conn, { areaId: area.id, decision: datos.jefe_actual });
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
  if (rol === 'JEFE') await resolverJefatura(conn, { areaId: area.id, empleadoId, decision: datos.jefe_actual });
  // Si deja de estar en un área que tenía a cargo, el área queda sin jefe hasta que se asigne otro.
  await conn.execute('UPDATE areas SET jefe_empleado_id = NULL WHERE jefe_empleado_id = ? AND id <> ?', [empleadoId, datos.area_id]);
  await conn.execute('UPDATE empleados SET area_id = ?, puesto_id = ? WHERE id = ?', [datos.area_id, datos.puesto_id ?? null, empleadoId]);
  if (datos.dni) await conn.execute('UPDATE empleados SET dni = ? WHERE id = ?', [datos.dni, empleadoId]);
  if (datos.habilidades) await guardarHabilidades(conn, empleadoId, datos.habilidades);
  await ubicarEnArea(conn, empleadoId, area, rol);
}
