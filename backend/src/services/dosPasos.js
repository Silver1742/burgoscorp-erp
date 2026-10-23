// Verificación en dos pasos: app autenticadora (TOTP), código por email o código de respaldo.
import crypto from 'node:crypto';
import { query, queryOne, transaccion } from '../config/db.js';
import { errores, AppError } from '../utils/errores.js';
import { sha256 } from '../utils/seguridad.js';
import * as totp from './totp.js';
import { generarCodigo, verificarCodigo } from './codigos.js';
import { enviarCodigo } from './email.js';
import { auditar } from './auditoria.js';
import { verificarTemporal } from './tokens.js';
import { buscarUsuarioPorId } from './usuarios.js';
import { emitirSesion, registrarIntentoFallido } from './auth.js';

const CANTIDAD_RESPALDO = 10;
const codigoInvalido = () => errores.validacion([{ campo: 'body.codigo', mensaje: 'Código incorrecto' }]);

// Códigos de respaldo tipo "7F3A-92C1": se muestran una sola vez y se guardan hasheados.
const normalizarRespaldo = (c) => c.toUpperCase().replace(/[^0-9A-F]/g, '');

async function crearCodigosRespaldo(usuarioId, conn) {
  const codigos = Array.from({ length: CANTIDAD_RESPALDO }, () => {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
  await conn.execute('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [usuarioId]);
  for (const c of codigos) {
    await conn.execute('INSERT INTO codigos_respaldo_2fa (usuario_id, codigo_hash) VALUES (?, ?)',
      [usuarioId, sha256(normalizarRespaldo(c))]);
  }
  return codigos;
}

async function usarCodigoRespaldo(usuarioId, codigo) {
  const r = await query(
    `UPDATE codigos_respaldo_2fa SET usado_at = UTC_TIMESTAMP()
     WHERE usuario_id = ? AND codigo_hash = ? AND usado_at IS NULL LIMIT 1`,
    [usuarioId, sha256(normalizarRespaldo(codigo))],
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

/** Para desactivar o regenerar códigos hay que probar que se tiene el segundo factor. */
async function exigirSegundoFactor(usuario, codigo, req) {
  if (!usuario.totp_habilitado) throw errores.conflicto('La verificación en dos pasos no está activa');
  const ok = (await usarCodigoTotp(usuario.id, codigo)) || (await usarCodigoRespaldo(usuario.id, codigo));
  if (!ok) {
    await auditar(req, { accion: '2fa_verificacion_fallida' });
    throw codigoInvalido();
  }
}

export async function desactivar(usuario, codigo, req) {
  await exigirSegundoFactor(usuario, codigo, req);
  await transaccion(async (conn) => {
    await conn.execute(
      'UPDATE usuarios SET totp_habilitado = 0, totp_secret_cifrado = NULL, totp_ultimo_paso = NULL WHERE id = ?',
      [usuario.id]);
    await conn.execute('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [usuario.id]);
  });
  await auditar(req, { accion: '2fa_desactivada' });
}

export async function regenerarRespaldo(usuario, codigo, req) {
  await exigirSegundoFactor(usuario, codigo, req);
  const codigosRespaldo = await transaccion((conn) => crearCodigosRespaldo(usuario.id, conn));
  await auditar(req, { accion: '2fa_respaldo_regenerado' });
  return { codigosRespaldo };
}

// ---------------------------------------------------------------- segundo paso del login

/** Envía un código por email como alternativa a la app autenticadora. */
export async function enviarCodigoLogin(tokenTemporal) {
  const usuario = await buscarUsuarioPorId(verificarTemporal(tokenTemporal, '2fa'));
  if (!usuario?.activo) throw errores.noAutenticado();
  const codigo = await generarCodigo(usuario.id, 'login_email');
  await enviarCodigo({ para: usuario.email, nombre: usuario.nombre, tipo: 'login_email', codigo });
}

/** Completa el login: valida el segundo factor y entrega la sesión. */
export async function completarLogin({ tokenTemporal, metodo, codigo }, req) {
  const usuarioId = verificarTemporal(tokenTemporal, '2fa');
  const fila = await queryOne(
    'SELECT id, activo, totp_habilitado, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = ?', [usuarioId]);
  if (!fila?.activo || !fila.totp_habilitado) throw errores.noAutenticado();
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    throw new AppError(423, 'CUENTA_BLOQUEADA', 'Demasiados intentos fallidos. Probá de nuevo en 15 minutos.');
  }

  const verificadores = {
    totp: () => usarCodigoTotp(usuarioId, codigo),
    email: () => verificarCodigo(usuarioId, 'login_email', codigo),
    respaldo: () => usarCodigoRespaldo(usuarioId, codigo),
  };
  if (!(await verificadores[metodo]())) {
    // Los fallos del segundo paso cuentan para el mismo bloqueo que la contraseña.
    await registrarIntentoFallido(fila);
    await auditar(req, { accion: 'login_fallido', usuarioId, detalle: { metodo: `2fa_${metodo}` } });
    throw codigoInvalido();
  }

  await query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [usuarioId]);
  await auditar(req, { accion: 'login_ok', usuarioId, detalle: { metodo: `2fa_${metodo}` } });
  return emitirSesion(await buscarUsuarioPorId(usuarioId), req);
}
