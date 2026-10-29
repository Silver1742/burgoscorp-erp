// Restablece la contraseña del administrador de prueba (admin@burgoscorp.test) cuando no hay otra
// forma de entrar (su email es ficticio, así que "Olvidé mi contraseña" no le llega a nadie).
//
// Se usa una sola vez: se define ADMIN_RESET_PASSWORD en el panel del hosting, la API arranca
// (npm start corre antes este script) y después se BORRA la variable. Sin la variable no hace nada.
// También cierra todas las sesiones del admin.
import bcrypt from 'bcryptjs';
import '../src/config/env.js';
import { pool, queryOne, transaccion } from '../src/config/db.js';
import { password as reglaPassword } from '../src/validators/comunes.js';
import { claveDe } from '../src/services/intentos.js';

const EMAIL = 'admin@burgoscorp.test';
const COSTO_BCRYPT = 12;
const nueva = process.env.ADMIN_RESET_PASSWORD;

async function main() {
  if (!nueva) return;
  const valida = reglaPassword.safeParse(nueva);
  if (!valida.success || nueva.length < 12) {
    console.error('ADMIN_RESET_PASSWORD no se aplicó: tiene que tener 12 caracteres o más, con letras y números.');
    return;
  }
  const admin = await queryOne('SELECT id FROM usuarios WHERE email = ?', [EMAIL]);
  if (!admin) {
    console.error(`ADMIN_RESET_PASSWORD no se aplicó: no existe ${EMAIL}.`);
    return;
  }
  const hash = await bcrypt.hash(nueva, COSTO_BCRYPT);
  await transaccion(async (conn) => {
    await conn.execute(
      "UPDATE usuarios SET password_hash = ?, activo = 1, estado_cuenta = 'habilitada' WHERE id = ?", [hash, admin.id]);
    await conn.execute(
      'UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND revocado_at IS NULL', [admin.id]);
    // Los intentos fallidos previos (con la contraseña olvidada) no deben dejarlo bloqueado.
    await conn.execute('DELETE FROM intentos_login WHERE clave = ?', [claveDe(EMAIL)]);
    await conn.execute(
      "INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?, 'password_restablecida_admin', NULL)", [admin.id]);
  });
  console.log(`Contraseña de ${EMAIL} restablecida. BORRÁ la variable ADMIN_RESET_PASSWORD del panel.`);
}

main()
  .catch((err) => {
    console.error('No se pudo restablecer la contraseña del admin:', err.message);
  })
  .finally(() => pool.end());
