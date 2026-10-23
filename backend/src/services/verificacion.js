// Verificación de email y recuperación de contraseña con códigos por email.
import bcrypt from 'bcryptjs';
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { generarCodigo, verificarCodigo } from './codigos.js';
import { enviarCodigo } from './email.js';
import { auditar } from './auditoria.js';
import { revocarTodas } from './tokens.js';

export async function enviarCodigoVerificacion(usuario) {
  if (usuario.email_verificado_at) throw errores.conflicto('Tu email ya está verificado');
  const codigo = await generarCodigo(usuario.id, 'verificar_email');
  await enviarCodigo({ para: usuario.email, nombre: usuario.nombre, tipo: 'verificar_email', codigo });
}

export async function confirmarEmail(usuario, codigo, req) {
  if (usuario.email_verificado_at) throw errores.conflicto('Tu email ya está verificado');
  if (!(await verificarCodigo(usuario.id, 'verificar_email', codigo))) {
    await auditar(req, { accion: 'verificar_email_fallido' });
    throw errores.validacion([{ campo: 'body.codigo', mensaje: 'Código incorrecto o vencido' }]);
  }
  await query('UPDATE usuarios SET email_verificado_at = UTC_TIMESTAMP() WHERE id = ?', [usuario.id]);
  await auditar(req, { accion: 'email_verificado' });
}

/**
 * "Olvidé mi contraseña". La respuesta es siempre la misma y el correo se envía en segundo
 * plano, para que ni el mensaje ni el tiempo de respuesta revelen si el email existe.
 */
export async function solicitarRecuperacion(email, req) {
  const usuario = await queryOne('SELECT id, email, nombre, activo FROM usuarios WHERE email = ?', [email]);
  if (!usuario?.activo) return;
  await auditar(req, { accion: 'recuperacion_solicitada', usuarioId: usuario.id });

  generarCodigo(usuario.id, 'recuperar_password')
    .then((codigo) => enviarCodigo({ para: usuario.email, nombre: usuario.nombre, tipo: 'recuperar_password', codigo }))
    .catch((err) => {
      if (err.codigo !== 'ESPERAR_REENVIO') console.error('[recuperacion] no se pudo enviar el código', err.message);
    });
}

const COSTO_BCRYPT = 12;

/** Define la contraseña nueva con el código recibido. Cierra todas las sesiones abiertas. */
export async function restablecerPassword({ email, codigo, nueva }, req) {
  const usuario = await queryOne('SELECT id, activo FROM usuarios WHERE email = ?', [email]);
  const valido = usuario?.activo && (await verificarCodigo(usuario.id, 'recuperar_password', codigo));
  if (!valido) {
    await auditar(req, { accion: 'recuperacion_fallida', usuarioId: usuario?.id ?? null });
    throw errores.validacion([{ campo: 'body.codigo', mensaje: 'Código incorrecto o vencido' }]);
  }

  const hash = await bcrypt.hash(nueva, COSTO_BCRYPT);
  await transaccion(async (conn) => {
    // Recibir el código prueba que el email es suyo: queda verificado y se levanta el bloqueo.
    await conn.execute(
      `UPDATE usuarios SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL,
              email_verificado_at = COALESCE(email_verificado_at, UTC_TIMESTAMP()) WHERE id = ?`,
      [hash, usuario.id],
    );
    await revocarTodas(usuario.id, conn);
  });
  await auditar(req, { accion: 'password_restablecida', usuarioId: usuario.id });
}
