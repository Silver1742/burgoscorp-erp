// Tokens de acceso (JWT, 15 min) y de renovación (opacos, guardados como hash, con rotación).
// Una sesión (familia de refresh tokens) dura como máximo SESION_MAX_DIAS desde el login, aunque
// se use todos los días; si se reutiliza un token ya canjeado se cierran todas las sesiones.
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
const SESION_MAX_DIAS = 30;
const MAX_INTENTOS_PASO2 = 3;

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

const pasoVencido = () => errores.noAutenticado('El paso de verificación expiró. Iniciá sesión de nuevo.');

/**
 * Token de 5 minutos que solo sirve para completar el segundo paso del login. Lleva un id (jti)
 * guardado en `pasos_2fa`: se usa una sola vez y admite 3 códigos equivocados.
 */
export async function firmarTemporal(usuarioId, proposito) {
  const jti = crypto.randomUUID();
  await query('INSERT INTO pasos_2fa (jti, usuario_id, expira_at) VALUES (?, ?, ?)', [jti, usuarioId, new Date(Date.now() + 5 * 60 * 1000)]);
  return jwt.sign({ proposito }, env.JWT_TEMP_SECRET, {
    algorithm: 'HS256',
    subject: String(usuarioId),
    issuer: ISSUER,
    audience: AUD_TEMPORAL,
    expiresIn: '5m',
    jwtid: jti,
  });
}

/** Devuelve { usuarioId, jti } si el token es válido y el paso sigue abierto; si no, 401. */
export async function verificarTemporal(token, proposito) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_TEMP_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUD_TEMPORAL });
    if (payload.proposito !== proposito || !payload.jti) throw new Error('propósito incorrecto');
  } catch {
    throw pasoVencido();
  }
  const [paso] = await query('SELECT usuario_id, intentos, usado_at, expira_at FROM pasos_2fa WHERE jti = ?', [payload.jti]);
  if (!paso || paso.usado_at || paso.intentos >= MAX_INTENTOS_PASO2 || new Date(paso.expira_at) <= new Date()
      || paso.usuario_id !== Number(payload.sub)) throw pasoVencido();
  return { usuarioId: paso.usuario_id, jti: payload.jti };
}

/** Un código equivocado en el segundo paso: al tercero el token deja de servir. */
export async function fallarPaso2(jti) {
  await query('UPDATE pasos_2fa SET intentos = intentos + 1 WHERE jti = ?', [jti]);
}

/** Segundo paso completado: el token no se puede volver a usar. */
export async function consumirPaso2(jti) {
  const r = await query('UPDATE pasos_2fa SET usado_at = UTC_TIMESTAMP() WHERE jti = ? AND usado_at IS NULL', [jti]);
  if (r.affectedRows !== 1) throw pasoVencido();
  await query('DELETE FROM pasos_2fa WHERE expira_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
}

// ---------------------------------------------------------------- renovación

function fechaExpiracionRefresh() {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Crea un refresh token nuevo. `conn` permite usarlo dentro de una transacción.
 * En una rotación se pasa `familiaExpira` (la vida máxima de la sesión, que no se estira).
 */
export async function emitirRefresh(usuarioId, req, { familiaId = crypto.randomUUID(), familiaExpira, conn } = {}) {
  const token = tokenAleatorio();
  const ejecutor = conn ?? { execute: async (sql, p) => [await query(sql, p)] };
  const tope = familiaExpira ? new Date(familiaExpira) : new Date(Date.now() + SESION_MAX_DIAS * 24 * 60 * 60 * 1000);
  const expira = new Date(Math.min(fechaExpiracionRefresh().getTime(), tope.getTime()));
  const [res] = await ejecutor.execute(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, familia_id, expira_at, familia_expira_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [usuarioId, sha256(token), familiaId, expira, tope, ipDe(req),
      (req.get('user-agent') ?? '').slice(0, 255) || null],
  );
  return { token, id: res.insertId, familiaId };
}

/**
 * Canjea un refresh token por uno nuevo (rotación).
 * Si el token ya había sido usado, se asume robo: se cierran todas las sesiones del usuario.
 * Devuelve { usuarioId, refreshToken }.
 */
export async function rotarRefresh(token, req) {
  const hash = sha256(token);

  const resultado = await transaccion(async (conn) => {
    const [filas] = await conn.execute(
      'SELECT id, usuario_id, familia_id, expira_at, familia_expira_at, revocado_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE',
      [hash],
    );
    const actual = filas[0];
    if (!actual) return { error: 'inexistente' };

    if (actual.revocado_at) {
      await revocarTodas(actual.usuario_id, conn);
      return { error: 'reutilizado', usuarioId: actual.usuario_id };
    }
    if (new Date(actual.expira_at) <= new Date()) return { error: 'expirado' };

    const nuevo = await emitirRefresh(actual.usuario_id, req, { familiaId: actual.familia_id, familiaExpira: actual.familia_expira_at, conn });
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
