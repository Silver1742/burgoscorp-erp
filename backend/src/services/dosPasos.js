// Verificación en dos pasos: app autenticadora (TOTP), código por email o código de respaldo.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import * as totp from './totp.js';
import { generarCodigo, verificarCodigo, hmac } from './codigos.js';
import { enviarCodigo } from './email.js';
import { auditar } from './auditoria.js';
import { verificarTemporal, fallarPaso2, consumirPaso2 } from './tokens.js';
import { buscarUsuarioPorId } from './usuarios.js';
import { emitirSesion } from './auth.js';
import * as intentos from './intentos.js';

const CANTIDAD_RESPALDO = 10;
const codigoInvalido = () => errores.validacion([{ campo: 'body.codigo', mensaje: 'Código incorrecto' }]);

// Códigos de respaldo tipo "7F3A-92C1": se muestran una sola vez y se guardan con HMAC (clave del
// servidor): con solo 32 bits, un hash sin clave se rompería en segundos si se filtrara la base.
const normalizarRespaldo = (c) => c.toUpperCase().replace(/[^0-9A-F]/g, '');
const hashRespaldo = (usuarioId, c) => hmac(usuarioId, 'respaldo', normalizarRespaldo(c));

async function crearCodigosRespaldo(usuarioId, conn) {
  const codigos = Array.from({ length: CANTIDAD_RESPALDO }, () => {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
  await conn.execute('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [usuarioId]);
  for (const c of codigos) {
    await conn.execute('INSERT INTO codigos_respaldo_2fa (usuario_id, codigo_hash) VALUES (?, ?)',
      [usuarioId, hashRespaldo(usuarioId, c)]);
  }
  return codigos;
}

async function usarCodigoRespaldo(usuarioId, codigo) {
  const r = await query(
    `UPDATE codigos_respaldo_2fa SET usado_at = UTC_TIMESTAMP()
     WHERE usuario_id = ? AND codigo_hash = ? AND usado_at IS NULL LIMIT 1`,
    [usuarioId, hashRespaldo(usuarioId, codigo)],
  );
  return r.affectedRows === 1;
}

/** Verifica TOTP y registra el paso usado (un mismo código no sirve dos veces). */
async function usarCodigoTotp(usuarioId, codigo) {
  const fila = await queryOne('SELECT totp_secret_cifrado, totp_ultimo_paso FROM usuarios WHERE id = ?', [usuarioId]);
  if (!fila?.totp_secret_cifrado) return false;
  const paso = totp.verificarTotp(totp.descifrar(fila.totp_secret_cifrado), codigo, fila.totp_ultimo_paso);
  if (paso === null) return false;
  const r = await query(
    'UPDATE usuarios SET totp_ultimo_paso = ? WHERE id = ? AND (totp_ultimo_paso IS NULL OR totp_ultimo_paso < ?)',
    [paso, usuarioId, paso],
  );
  return r.affectedRows === 1;
}

// ---------------------------------------------------------------- configuración (usuario logueado)

/** Paso 1: genera el secreto y devuelve lo necesario para el QR. Queda inactivo hasta confirmar. */
export async function configurar(usuario, req) {
  if (usuario.totp_habilitado) throw errores.conflicto('La verificación en dos pasos ya está activa');
  const secreto = totp.generarSecreto();
  await query('UPDATE usuarios SET totp_secret_cifrado = ?, totp_ultimo_paso = NULL WHERE id = ?',
    [totp.cifrar(secreto), usuario.id]);
  await auditar(req, { accion: '2fa_configuracion_iniciada' });
  return { secreto, otpauthUri: totp.uriOtpauth(secreto, usuario.email) };
}

/** Paso 2: el usuario escanea el QR y manda un código para demostrar que funciona. */
export async function activar(usuario, codigo, req) {
  if (usuario.totp_habilitado) throw errores.conflicto('La verificación en dos pasos ya está activa');
  if (!(await usarCodigoTotp(usuario.id, codigo))) {
    await auditar(req, { accion: '2fa_activacion_fallida' });
    throw codigoInvalido();
  }
  const codigosRespaldo = await transaccion(async (conn) => {
    await conn.execute('UPDATE usuarios SET totp_habilitado = 1 WHERE id = ?', [usuario.id]);
    return crearCodigosRespaldo(usuario.id, conn);
  });
  await auditar(req, { accion: '2fa_activada' });
  return { codigosRespaldo };
}

/**
 * Para desactivar o regenerar códigos hay que probar las dos cosas: la contraseña (si la cuenta
 * tiene) y el segundo factor. Los fallos cuentan para el mismo bloqueo que el login, así que con
 * un token de acceso robado no se pueden probar códigos sin límite.
 */
async function exigirSegundoFactor(usuario, { codigo, password }, req) {
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
  const ok = (await usarCodigoTotp(usuario.id, codigo)) || (await usarCodigoRespaldo(usuario.id, codigo));
  if (!ok) {
    await intentos.registrarFallo(clave, req, '2fa');
    await auditar(req, { accion: '2fa_verificacion_fallida' });
    throw codigoInvalido();
  }
}

export async function desactivar(usuario, datos, req) {
  await exigirSegundoFactor(usuario, datos, req);
  await transaccion(async (conn) => {
    await conn.execute(
      'UPDATE usuarios SET totp_habilitado = 0, totp_secret_cifrado = NULL, totp_ultimo_paso = NULL WHERE id = ?',
      [usuario.id]);
    await conn.execute('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [usuario.id]);
  });
  await auditar(req, { accion: '2fa_desactivada' });
}

export async function regenerarRespaldo(usuario, datos, req) {
  await exigirSegundoFactor(usuario, datos, req);
  const codigosRespaldo = await transaccion((conn) => crearCodigosRespaldo(usuario.id, conn));
  await auditar(req, { accion: '2fa_respaldo_regenerado' });
  return { codigosRespaldo };
}

// ---------------------------------------------------------------- segundo paso del login

/** Envía un código por email como alternativa a la app autenticadora. */
export async function enviarCodigoLogin(tokenTemporal) {
  const { usuarioId } = await verificarTemporal(tokenTemporal, '2fa');
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario?.activo) throw errores.noAutenticado();
  const codigo = await generarCodigo(usuario.id, 'login_email');
  await enviarCodigo({ para: usuario.email, nombre: usuario.nombre, tipo: 'login_email', codigo });
}

/** Completa el login: valida el segundo factor y entrega la sesión. */
export async function completarLogin({ tokenTemporal, metodo, codigo }, req) {
  const { usuarioId, jti } = await verificarTemporal(tokenTemporal, '2fa');
  const fila = await queryOne('SELECT id, email, activo, totp_habilitado FROM usuarios WHERE id = ?', [usuarioId]);
  if (!fila?.activo || !fila.totp_habilitado) throw errores.noAutenticado();
  const clave = intentos.claveDe(fila.email);
  await intentos.exigirNoBloqueado(clave, req);

  const verificadores = {
    totp: () => usarCodigoTotp(usuarioId, codigo),
    email: () => verificarCodigo(usuarioId, 'login_email', codigo),
    respaldo: () => usarCodigoRespaldo(usuarioId, codigo),
  };
  if (!(await verificadores[metodo]())) {
    // Los fallos del segundo paso cuentan para el mismo bloqueo que la contraseña, y el token
    // temporal deja de servir al tercero (hay que volver a poner la contraseña).
    await fallarPaso2(jti);
    await intentos.registrarFallo(clave, req, '2fa');
    await auditar(req, { accion: 'login_fallido', usuarioId, detalle: { metodo: `2fa_${metodo}` } });
    throw codigoInvalido();
  }

  await consumirPaso2(jti);
  await intentos.limpiar(clave, req);
  await auditar(req, { accion: 'login_ok', usuarioId, detalle: { metodo: `2fa_${metodo}` } });
  return emitirSesion(await buscarUsuarioPorId(usuarioId), req);
}
