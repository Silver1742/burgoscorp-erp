// Tokens de acceso (JWT, 15 min) y de renovación (opacos, guardados como hash, con rotación).
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { query, transaccion } from '../config/db.js';
import { sha256, tokenAleatorio, ipDe } from '../utils/seguridad.js';
import { errores } from '../utils/errores.js';
import { auditar } from './auditoria.js';

const ISSUER = 'burgoscorp-api';
const AUD_ACCESO = 'burgoscorp-app';
const AUD_TEMPORAL = 'burgoscorp-paso2';

// ---------------------------------------------------------------- acceso

export function firmarAcceso(usuario) {
  return jwt.sign({ rol: usuario.rol }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: String(usuario.id),
    issuer: ISSUER,
    audience: AUD_ACCESO,
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });
}

/** Devuelve el payload o lanza 401. Solo acepta HS256 (evita el ataque alg:none / cambio de algoritmo). */
export function verificarAcceso(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUD_ACCESO });
  } catch (err) {
    throw err.name === 'TokenExpiredError'
      ? Object.assign(errores.noAutenticado('La sesión expiró'), { codigo: 'TOKEN_EXPIRADO' })
      : errores.noAutenticado('Token inválido');
  }
}

// ---------------------------------------------------------------- token temporal (2FA, paso 2)

/** Token de 5 minutos que solo sirve para completar el segundo paso del login. */
export function firmarTemporal(usuarioId, proposito) {
  return jwt.sign({ proposito }, env.JWT_TEMP_SECRET, {
    algorithm: 'HS256',
    subject: String(usuarioId),
    issuer: ISSUER,
    audience: AUD_TEMPORAL,
    expiresIn: '5m',
  });
}

export function verificarTemporal(token, proposito) {
  try {
    const payload = jwt.verify(token, env.JWT_TEMP_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUD_TEMPORAL });
    if (payload.proposito !== proposito) throw new Error('propósito incorrecto');
    return Number(payload.sub);
  } catch {
    throw errores.noAutenticado('El paso de verificación expiró. Iniciá sesión de nuevo.');
  }
}

// ---------------------------------------------------------------- renovación

function fechaExpiracionRefresh() {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

/** Crea un refresh token nuevo. `conn` permite usarlo dentro de una transacción. */
export async function emitirRefresh(usuarioId, req, { familiaId = crypto.randomUUID(), conn } = {}) {
  const token = tokenAleatorio();
  const ejecutor = conn ?? { execute: async (sql, p) => [await query(sql, p)] };
  const [res] = await ejecutor.execute(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, familia_id, expira_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [usuarioId, sha256(token), familiaId, fechaExpiracionRefresh(), ipDe(req),
      (req.get('user-agent') ?? '').slice(0, 255) || null],
  );
  return { token, id: res.insertId, familiaId };
}

/**
 * Canjea un refresh token por uno nuevo (rotación).
 * Si el token ya había sido usado, se asume robo: se revoca toda la familia.
 * Devuelve { usuarioId, refreshToken }.
 */
export async function rotarRefresh(token, req) {
  const hash = sha256(token);

  const resultado = await transaccion(async (conn) => {
    const [filas] = await conn.execute(
      'SELECT id, usuario_id, familia_id, expira_at, revocado_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE',
      [hash],
    );
    const actual = filas[0];
    if (!actual) return { error: 'inexistente' };

    if (actual.revocado_at) {
      await conn.execute(
        'UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP() WHERE familia_id = ? AND revocado_at IS NULL',
        [actual.familia_id],
      );
      return { error: 'reutilizado', usuarioId: actual.usuario_id };
    }
    if (new Date(actual.expira_at) <= new Date()) return { error: 'expirado' };

    const nuevo = await emitirRefresh(actual.usuario_id, req, { familiaId: actual.familia_id, conn });
    await conn.execute(
      'UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP(), reemplazado_por_id = ? WHERE id = ?',
      [nuevo.id, actual.id],
    );
    return { usuarioId: actual.usuario_id, refreshToken: nuevo.token };
  });

  if (resultado.error === 'reutilizado') {
    await auditar(req, { accion: 'refresh_reutilizado', usuarioId: resultado.usuarioId });
  }
  if (resultado.error) throw errores.noAutenticado('La sesión no es válida. Iniciá sesión de nuevo.');
  return resultado;
}

/** Revoca la familia del token (cerrar sesión en este dispositivo). No revela si el token existía. */
export async function revocarFamilia(token) {
  await query(
    `UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP()
     WHERE revocado_at IS NULL AND familia_id = (SELECT familia_id FROM (
       SELECT familia_id FROM refresh_tokens WHERE token_hash = ?) t)`,
    [sha256(token)],
  );
}

/** Revoca todas las sesiones de un usuario (cambio de contraseña, desactivación, "cerrar en todos lados"). */
export async function revocarTodas(usuarioId, conn) {
  const sql = 'UPDATE refresh_tokens SET revocado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND revocado_at IS NULL';
  if (conn) await conn.execute(sql, [usuarioId]);
  else await query(sql, [usuarioId]);
}
