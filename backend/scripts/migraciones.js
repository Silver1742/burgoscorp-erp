// Ajustes que se aplican en cada arranque sobre una base que ya existe (también la de la nube).
// Todos son idempotentes: si ya están hechos, no cambian nada.
//
//  1. El DNI del legajo pasa a ser opcional: el legajo se crea al habilitar la cuenta y el DNI lo
//     completa RRHH después.
//  2. La empresa queda ordenada: cada área con su jefe, cada empleado con su supervisor, y el
//     administrador del sistema con su legajo en Administración (así aparece en el organigrama).
import { crearLegajo } from '../src/services/legajos.js';

async function dniOpcional(conn) {
  const [[col]] = await conn.execute(
    "SELECT IS_NULLABLE AS nulo FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'empleados' AND column_name = 'dni'");
  if (col?.nulo === 'NO') {
    await conn.query('ALTER TABLE empleados MODIFY dni VARCHAR(10) NULL');
    console.log('Migración: el DNI del legajo ahora es opcional.');
  }
}

/** Cada área sin jefe toma al empleado activo de esa área con puesto de jefe (o cuenta con rol JEFE). */
async function jefesDeArea(conn) {
  const [sinJefe] = await conn.execute('SELECT id, nombre FROM areas WHERE jefe_empleado_id IS NULL AND activo = 1');
  for (const area of sinJefe) {
    const [[jefe]] = await conn.execute(
      `SELECT e.id FROM empleados e
       LEFT JOIN puestos p ON p.id = e.puesto_id
       LEFT JOIN usuarios u ON u.empleado_id = e.id
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE e.area_id = ? AND e.estado <> 'baja' AND (p.nombre LIKE 'Jefe%' OR p.nombre LIKE 'Gerente%' OR r.codigo = 'JEFE')
       ORDER BY (p.nombre LIKE 'Jefe%' OR p.nombre LIKE 'Gerente%') DESC, e.fecha_ingreso LIMIT 1`, [area.id]);
    if (jefe) {
      await conn.execute('UPDATE areas SET jefe_empleado_id = ? WHERE id = ?', [jefe.id, area.id]);
      console.log(`Migración: ${area.nombre} ya tiene jefe.`);
    }
  }
  // Los empleados sin supervisor quedan a cargo del jefe de su área (los jefes, del gerente general).
  await conn.execute(
    `UPDATE empleados e JOIN areas a ON a.id = e.area_id
     SET e.supervisor_id = a.jefe_empleado_id
     WHERE e.supervisor_id IS NULL AND a.jefe_empleado_id IS NOT NULL AND a.jefe_empleado_id <> e.id`);
  await conn.execute(
    `UPDATE empleados e
     JOIN areas a ON a.jefe_empleado_id = e.id
     JOIN areas dir ON dir.codigo = 'DIR' AND dir.jefe_empleado_id IS NOT NULL AND dir.jefe_empleado_id <> e.id
     SET e.supervisor_id = dir.jefe_empleado_id
     WHERE e.supervisor_id IS NULL`);
}

/** El administrador del sistema (cuenta de prueba) con legajo en Administración y Finanzas. */
async function legajoDelAdministrador(conn) {
  const [[admin]] = await conn.execute(
    "SELECT u.id, u.nombre, u.apellido, u.email FROM usuarios u WHERE u.email = 'admin@burgoscorp.test' AND u.empleado_id IS NULL");
  const [[area]] = await conn.execute("SELECT id FROM areas WHERE codigo = 'ADM'");
  if (!admin || !area) return;
  await conn.execute("INSERT IGNORE INTO puestos (area_id, nombre) VALUES (?, 'Administrador de sistemas')", [area.id]);
  const [[puesto]] = await conn.execute("SELECT id FROM puestos WHERE area_id = ? AND nombre = 'Administrador de sistemas'", [area.id]);
  await conn.beginTransaction();
  try {
    const legajo = await crearLegajo(conn, {
      nombre: admin.nombre, apellido: admin.apellido, email: admin.email, area_id: area.id, puesto_id: puesto.id,
    }, 'ADMIN');
    await conn.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [legajo.id, admin.id]);
    await conn.commit();
    console.log(`Migración: el administrador tiene el legajo ${legajo.legajo}.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

export async function migrar(conn) {
  await dniOpcional(conn);
  await jefesDeArea(conn);
  await legajoDelAdministrador(conn);
}
