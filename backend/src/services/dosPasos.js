// Verificación en dos pasos por email.
//  - Para activarla, la persona pide un código (le llega al email) y lo escribe: así se comprueba que
//    el correo le llega.
//  - Con la verificación activa, cada login con la contraseña correcta manda un código nuevo al
//    email, y la sesión se entrega recién cuando se escribe ese código.
//  - Para desactivarla hacen falta la contraseña y otro código por email.
// (La columna totp_habilitado se conserva como "verificación en dos pasos activa".)
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { generarCodigo, verificarCodigo } from './codigos.js';
import { enviarCodigo } from './email.js';
import { auditar } from './auditoria.js';
import { verificarTemporal, fallarPaso2, consumirPaso2 } from './tokens.js';
import { buscarUsuarioPorId } from './usuarios.js';
import { emitirSesion } from './auth.js';
import * as intentos from './intentos.js';

const codigoInvalido = () => errores.validacion([{ campo: 'body.codigo', mensaje: 'Código incorrecto o vencido' }]);

/** "uriel.burgos@gmail.com" → "ur***@gmail.com" (para decir a dónde se mandó sin mostrarlo entero). */
export function enmascararEmail(email) {
  const [usuario, dominio] = String(email).split('@');
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

// ---------------------------------------------------------------- configuración (usuario logueado)

/** Manda el código para activar o desactivar la verificación. */
export async function enviarCodigoConfiguracion(usuario) {
  const codigo = await generarCodigo(usuario.id, 'config_2fa');
  await enviarCodigo({
    para: usuario.email, nombre: usuario.nombre, tipo: 'config_2fa', codigo,
    plantilla: usuario.totp_habilitado ? 'desactivar_2fa' : 'activar_2fa',
  });
  return { email: enmascararEmail(usuario.email) };
}

export async function activar(usuario, codigo, req) {
  if (usuario.totp_habilitado) throw errores.conflicto('La verificación en dos pasos ya está activa');
  if (!(await verificarCodigo(usuario.id, 'config_2fa', codigo))) {
    await auditar(req, { accion: '2fa_activacion_fallida' });
    throw codigoInvalido();
  }
  await query('UPDATE usuarios SET totp_habilitado = 1, totp_secret_cifrado = NULL, totp_ultimo_paso = NULL WHERE id = ?', [usuario.id]);
  await auditar(req, { accion: '2fa_activada' });
}

/**
 * Desactivar pide la contraseña (si la cuenta tiene) y el código del email. Los fallos cuentan para
 * el mismo bloqueo que el login: con un token de acceso robado no se pueden probar códigos sin límite.
 */
export async function desactivar(usuario, { codigo, password }, req) {
  if (!usuario.totp_habilitado) throw errores.conflicto('La verificación en dos pasos no está activa');
  const clave = intentos.claveDe(usuario.email);
  await intentos.exigirNoBloqueado(clave, req);
  if (usuario.tiene_password) {
    const { password_hash: hash } = await queryOne('SELECT password_hash FROM usuarios WHERE id = ?', [usuario.id]);
    if (!password || !(await bcrypt.compare(password, hash))) {
      await intentos.registrarFallo(clave, req, 'password');
      await auditar(req, { accion: '2fa_verificacion_fallida', detalle: { motivo: 'password' } });
      throw errores.validacion([{ campo: 'body.password', mensaje: 'La contraseña no es correcta' }]);
    }
  }
  if (!(await verificarCodigo(usuario.id, 'config_2fa', codigo))) {
    await intentos.registrarFallo(clave, req, '2fa');
    await auditar(req, { accion: '2fa_verificacion_fallida' });
    throw codigoInvalido();
  }
  await query('UPDATE usuarios SET totp_habilitado = 0 WHERE id = ?', [usuario.id]);
  await query('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [usuario.id]);
  await auditar(req, { accion: '2fa_desactivada' });
}

// ---------------------------------------------------------------- segundo paso del login

async function mandarCodigoLogin(usuario) {
  const codigo = await generarCodigo(usuario.id, 'login_email');
  await enviarCodigo({ para: usuario.email, nombre: usuario.nombre, tipo: 'login_email', codigo });
}

/**
 * Contraseña correcta con la verificación activa: manda el código al email y devuelve el token
 * temporal para completar el ingreso. Si ya se mandó uno hace menos de un minuto, sirve ese.
 */
export async function iniciarSegundoPaso(usuario, firmarTemporal) {
  let codigoEnviado = true;
  try {
    await mandarCodigoLogin(usuario);
  } catch (err) {
    if (err.codigo !== 'ESPERAR_REENVIO') {
      // Si el correo falló, igual se puede pedir otro desde la pantalla del código.
      console.error('No se pudo mandar el código de ingreso:', err.message);
      codigoEnviado = false;
    }
  }
  return { requiere2fa: true, tokenTemporal: await firmarTemporal(usuario.id, '2fa'), email: enmascararEmail(usuario.email), codigoEnviado };
}

/** Reenvía el código del login (botón "Reenviar código"). */
export async function enviarCodigoLogin(tokenTemporal) {
  const { usuarioId } = await verificarTemporal(tokenTemporal, '2fa');
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario?.activo) throw errores.noAutenticado();
  await mandarCodigoLogin(usuario);
}

/** Completa el login: valida el código del email y entrega la sesión. */
export async function completarLogin({ tokenTemporal, codigo }, req) {
  const { usuarioId, jti } = await verificarTemporal(tokenTemporal, '2fa');
  const fila = await queryOne('SELECT id, email, activo, totp_habilitado FROM usuarios WHERE id = ?', [usuarioId]);
  if (!fila?.activo || !fila.totp_habilitado) throw errores.noAutenticado();
  const clave = intentos.claveDe(fila.email);
  await intentos.exigirNoBloqueado(clave, req);

  if (!(await verificarCodigo(usuarioId, 'login_email', codigo))) {
    // Los fallos del segundo paso cuentan para el mismo bloqueo que la contraseña, y el token
    // temporal deja de servir al tercero (hay que volver a poner la contraseña).
    await fallarPaso2(jti);
    await intentos.registrarFallo(clave, req, '2fa');
    await auditar(req, { accion: 'login_fallido', usuarioId, detalle: { metodo: '2fa_email' } });
    throw codigoInvalido();
  }

  await consumirPaso2(jti);
  await intentos.limpiar(clave, req);
  await auditar(req, { accion: 'login_ok', usuarioId, detalle: { metodo: '2fa_email' } });
  return emitirSesion(await buscarUsuarioPorId(usuarioId), req);
}
