// Ajustes que se aplican en cada arranque sobre una base que ya existe (también la de la nube).
// Todos son idempotentes: si ya están hechos, no cambian nada.
//
//  1. El DNI del legajo pasa a ser opcional: el legajo se crea al habilitar la cuenta y el DNI lo
//     completa RRHH después.
//  2. La empresa queda ordenada: cada área con su jefe y cada empleado con su supervisor. El
//     administrador del sistema no pertenece a ningún área (no lleva legajo).

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

/**
 * El administrador del sistema no es un empleado de un área: no lleva legajo. Deshace el legajo
 * "Administrador de sistemas" que le había puesto una versión anterior de esta migración.
 */
async function administradorSinLegajo(conn) {
  const [legajos] = await conn.execute(
    `SELECT u.id AS usuario_id, e.id AS empleado_id, e.legajo FROM usuarios u
     JOIN roles r ON r.id = u.rol_id JOIN empleados e ON e.id = u.empleado_id JOIN puestos p ON p.id = e.puesto_id
     WHERE r.codigo = 'ADMIN' AND p.nombre = 'Administrador de sistemas'`);
  for (const l of legajos) {
    await conn.execute('UPDATE usuarios SET empleado_id = NULL WHERE id = ?', [l.usuario_id]);
    try {
      await conn.execute('DELETE FROM empleados WHERE id = ?', [l.empleado_id]);
    } catch (err) {
      if (err.code !== 'ER_ROW_IS_REFERENCED_2') throw err;
      await conn.execute("UPDATE empleados SET estado = 'baja', fecha_egreso = CURDATE() WHERE id = ?", [l.empleado_id]);
    }
    console.log(`Migración: el administrador ya no tiene legajo (se quitó ${l.legajo}).`);
  }
  await conn.execute(
    `DELETE p FROM puestos p LEFT JOIN empleados e ON e.puesto_id = p.id
     WHERE p.nombre = 'Administrador de sistemas' AND e.id IS NULL`);
}

async function jornadaLaboral(conn) {
  await conn.query(`CREATE TABLE IF NOT EXISTS jornada_laboral (
    id                  TINYINT UNSIGNED PRIMARY KEY,
    hora_entrada        TIME NOT NULL DEFAULT '08:00:00',
    tolerancia_min      TINYINT UNSIGNED NOT NULL DEFAULT 10,
    horas_diarias       DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    recargo_extra_habil TINYINT UNSIGNED NOT NULL DEFAULT 50,
    recargo_extra_finde TINYINT UNSIGNED NOT NULL DEFAULT 100,
    CONSTRAINT ck_jornada_unica CHECK (id = 1)
  ) ENGINE=InnoDB`);
  await conn.query('INSERT IGNORE INTO jornada_laboral (id) VALUES (1)');
}

/**
 * Solo en la base de demostración (la que tiene las cuentas de prueba): si casi no hay fichajes,
 * carga los de las últimas 4 semanas para que la liquidación muestre algo real: la mayoría llega a
 * horario, algunos tarde, algunos se quedan horas extra y un par falta sin aviso.
 */
async function fichajesDeEjemplo(conn) {
  const [[demo]] = await conn.execute("SELECT id FROM usuarios WHERE email = 'admin@burgoscorp.test'");
  const [[{ cantidad }]] = await conn.execute('SELECT COUNT(*) AS cantidad FROM asistencias');
  if (!demo || cantidad >= 50) return;
  const [empleados] = await conn.execute(
    "SELECT id, CAST(SUBSTRING(legajo, 2) AS UNSIGNED) AS n FROM empleados WHERE estado = 'activo' AND legajo REGEXP '^L00[0-9]{2}$' ORDER BY legajo");
  const hoy = new Date();
  const filas = [];
  for (let atras = 28; atras >= 1; atras -= 1) {
    const dia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - atras));
    const semana = dia.getUTCDay();
    if (semana === 0 || semana === 6) continue;
    const fecha = dia.toISOString().slice(0, 10);
    for (const e of empleados) {
      const r = (e.n * 31 + atras * 17) % 100; // variación fija por persona y día (siempre igual)
      if (r < 3) continue; // ausencia sin aviso
      const llegada = r < 13 ? 8 * 60 + 12 + (r % 25) : 7 * 60 + 50 + (r % 9); // 10 % llega tarde
      const salida = r > 85 ? 18 * 60 + (r % 40) : 16 * 60 + (r % 10);      // 15 % se queda horas extra
      // 08:00 en la Argentina son las 11:00 UTC: se guarda en UTC como el resto.
      const aUtc = (min) => `${fecha} ${String(Math.floor(min / 60) + 3).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
      filas.push([e.id, fecha, aUtc(llegada), aUtc(salida)]);
    }
  }
  if (!filas.length) return;
  await conn.query("INSERT INTO asistencias (empleado_id, fecha, entrada_at, salida_at, origen, observacion) VALUES ?",
    [filas.map((f) => [...f, 'manual', 'Fichaje de ejemplo'])]);
  console.log(`Migración: se cargaron ${filas.length} fichajes de ejemplo de las últimas 4 semanas.`);
}

/**
 * Cuentas habilitadas (que no son del administrador) sin legajo o con un legajo sin área: no ven
 * ningún módulo. Si el nombre coincide exactamente con un legajo sin cuenta, se vinculan; las demás
 * quedan en el registro para asignarles el área desde Usuarios.
 */
async function cuentasSinArea(conn) {
  const [cuentas] = await conn.execute(
    `SELECT u.id, u.nombre, u.apellido, r.codigo AS rol FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     LEFT JOIN empleados e ON e.id = u.empleado_id
     WHERE r.codigo <> 'ADMIN' AND u.activo = 1 AND u.estado_cuenta = 'habilitada' AND e.area_id IS NULL`);
  for (const c of cuentas) {
    const [legajos] = await conn.execute(
      `SELECT e.id, e.legajo FROM empleados e LEFT JOIN usuarios u ON u.empleado_id = e.id
       WHERE u.id IS NULL AND e.estado = 'activo' AND e.area_id IS NOT NULL AND e.nombre = ? AND e.apellido = ?`,
      [c.nombre, c.apellido]);
    if (legajos.length === 1) {
      await conn.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [legajos[0].id, c.id]);
      console.log(`Migración: la cuenta ${c.id} (${c.rol}) quedó con el legajo ${legajos[0].legajo}.`);
    } else {
      console.log(`Migración: la cuenta ${c.id} (${c.nombre} ${c.apellido}, ${c.rol}) no tiene área: asignala en Usuarios.`);
    }
  }
}

/**
 * La verificación en dos pasos pasó a ser solo por email: se agrega el tipo de código para
 * activarla/desactivarla y se borran los secretos de la app autenticadora y los códigos de
 * respaldo. Quien la tenía activa la sigue teniendo (ahora le llega el código al email).
 */
async function dosPasosPorEmail(conn) {
  const [[col]] = await conn.execute(
    `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'codigos_verificacion' AND COLUMN_NAME = 'tipo'`);
  if (!col.tipo.includes('config_2fa')) {
    await conn.query(`ALTER TABLE codigos_verificacion
      MODIFY tipo ENUM('verificar_email','recuperar_password','login_email','config_2fa') NOT NULL`);
    console.log('Migración: códigos por email para activar la verificación en dos pasos.');
  }
  const [r] = await conn.execute(
    'UPDATE usuarios SET totp_secret_cifrado = NULL, totp_ultimo_paso = NULL WHERE totp_secret_cifrado IS NOT NULL');
  await conn.execute('DELETE FROM codigos_respaldo_2fa');
  if (r.affectedRows) console.log(`Migración: ${r.affectedRows} cuenta(s) pasan a la verificación en dos pasos por email.`);
  // Un email ficticio (dominios reservados, ej. admin@burgoscorp.test) no recibe el código: con la
  // verificación activa esa cuenta no podría entrar nunca. Se le desactiva.
  if (!process.env.BREVO_API_KEY && !process.env.SMTP_HOST) return; // en desarrollo los códigos salen por consola
  const [sinCorreo] = await conn.execute(
    `UPDATE usuarios SET totp_habilitado = 0
     WHERE totp_habilitado = 1 AND email REGEXP '[.](test|example|invalid|localhost)$'`);
  if (sinCorreo.affectedRows) {
    console.log(`Migración: se desactivó la verificación en dos pasos de ${sinCorreo.affectedRows} cuenta(s) con email de prueba (no les llega el código).`);
  }
}

/** Login con Discord: se agrega a los proveedores de cuentas sociales. */
async function proveedorDiscord(conn) {
  const [[col]] = await conn.execute(
    `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cuentas_sociales' AND COLUMN_NAME = 'proveedor'`);
  if (col && !col.tipo.includes('discord')) {
    await conn.query("ALTER TABLE cuentas_sociales MODIFY proveedor ENUM('google','github','facebook','discord') NOT NULL");
    console.log('Migración: se agregó Discord a los ingresos con redes sociales.');
  }
}

export async function migrar(conn) {
  await dosPasosPorEmail(conn);
  await proveedorDiscord(conn);
  await dniOpcional(conn);
  await jornadaLaboral(conn);
  await fichajesDeEjemplo(conn);
  await jefesDeArea(conn);
  await administradorSinLegajo(conn);
  await cuentasSinArea(conn);
}
