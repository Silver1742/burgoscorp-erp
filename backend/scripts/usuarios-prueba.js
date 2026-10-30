// Cuentas de prueba, una por rol, para mostrar y probar el sistema sin usar las de la gente:
//
//   admin@burgoscorp.test     Administrador (ya existe, no se toca)
//   gerencia@burgoscorp.test  Gerencia, en Dirección
//   jefe@burgoscorp.test      Jefe en Mecanizado (recibe las tareas que manda el administrador)
//   empleado@burgoscorp.test  Empleado en Mecanizado, con tornería y CNC
//
// La contraseña sale de la variable PASSWORD_PRUEBA (12 caracteres o más, con letras y números),
// que se carga en el panel del hosting: nunca va en el código. Sin la variable no hace nada.
// Se puede dejar puesta: si las cuentas ya existen solo les actualiza la contraseña si cambió.
// Corre antes de arrancar la API (npm start) o a mano con `npm run usuarios:prueba`.
import bcrypt from 'bcryptjs';
import '../src/config/env.js';
import { pool, queryOne, transaccion } from '../src/config/db.js';
import { password as reglaPassword } from '../src/validators/comunes.js';
import { crearLegajo } from '../src/services/legajos.js';

const COSTO_BCRYPT = 12;
const PASSWORD = process.env.PASSWORD_PRUEBA;

// email, nombre, apellido, rol, área, puesto, habilidades [código, nivel], costo por hora
const CUENTAS = [
  ['gerencia@burgoscorp.test', 'Gerencia', 'De Prueba', 'GERENCIA', 'DIR', 'Gerente general', [], 20000],
  ['jefe@burgoscorp.test', 'Jefe', 'De Prueba', 'JEFE', 'MEC', 'Jefe de mecanizado', [['TORNERIA', 'avanzado'], ['FRESADO_CNC', 'avanzado']], 16000],
  ['empleado@burgoscorp.test', 'Empleado', 'De Prueba', 'EMPLEADO', 'MEC', 'Tornero', [['TORNERIA', 'intermedio'], ['TORNO_CNC', 'basico']], 12000],
];

async function crearCuenta(conn, hash, [email, nombre, apellido, rol, codigoArea, puesto, habilidades, costoHora]) {
  const [[area]] = await conn.execute('SELECT id FROM areas WHERE codigo = ?', [codigoArea]);
  if (!area) throw new Error(`no existe el área ${codigoArea}`);
  const [[p]] = await conn.execute('SELECT id FROM puestos WHERE area_id = ? AND nombre = ?', [area.id, puesto]);
  const habs = [];
  for (const [codigo, nivel] of habilidades) {
    const [[h]] = await conn.execute('SELECT id FROM habilidades WHERE codigo = ?', [codigo]);
    if (h) habs.push({ habilidad_id: h.id, nivel });
  }
  const legajo = await crearLegajo(conn, { nombre, apellido, email, area_id: area.id, puesto_id: p?.id, habilidades: habs }, rol);
  await conn.execute('UPDATE empleados SET costo_hora = ? WHERE id = ?', [costoHora, legajo.id]);
  // Email ya verificado: es ficticio (.test), el código de confirmación no le llegaría a nadie.
  await conn.execute(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, empleado_id, email_verificado_at, estado_cuenta)
     VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, UTC_TIMESTAMP(), 'habilitada')`,
    [email, hash, nombre, apellido, rol, legajo.id]);
  return legajo.legajo;
}

async function main() {
  if (!PASSWORD) return;
  if (!reglaPassword.safeParse(PASSWORD).success || PASSWORD.length < 12) {
    console.error('PASSWORD_PRUEBA no se aplicó: tiene que tener 12 caracteres o más, con letras y números.');
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, COSTO_BCRYPT);
  for (const cuenta of CUENTAS) {
    const email = cuenta[0];
    const existe = await queryOne('SELECT id, password_hash FROM usuarios WHERE email = ?', [email]);
    if (existe) {
      if (!(await bcrypt.compare(PASSWORD, existe.password_hash ?? ''))) {
        await transaccion(async (conn) => {
          await conn.execute("UPDATE usuarios SET password_hash = ?, activo = 1, estado_cuenta = 'habilitada' WHERE id = ?", [hash, existe.id]);
          await conn.execute('UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND revocado_at IS NULL', [existe.id]);
        });
        console.log(`Cuenta de prueba ${email}: contraseña actualizada.`);
      }
      continue;
    }
    const legajo = await transaccion((conn) => crearCuenta(conn, hash, cuenta));
    console.log(`Cuenta de prueba ${email} creada (legajo ${legajo}).`);
  }
}

// Nunca impide que arranque la API.
main()
  .catch((err) => console.error('No se pudieron preparar las cuentas de prueba:', err.message))
  .finally(() => pool.end());
