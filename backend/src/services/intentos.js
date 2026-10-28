// Límite de intentos de login (contraseña y segundo paso), por email e IP.
//
// Cada fallo queda en `intentos_login` con el SHA-256 del email (exista o no la cuenta), así que
// la respuesta es igual para emails registrados y no registrados (no se pueden enumerar cuentas).
// En una ventana de 15 minutos:
//   - 5 fallos desde la misma IP bloquean a esa IP para ese email;
//   - 20 fallos desde cualquier IP bloquean el email para todos (frena ataques distribuidos).
// Un atacante desde una sola IP no puede dejar afuera al dueño de la cuenta: necesita 20 fallos.
// El contador no se reinicia al acertar la contraseña, solo al completar el login (también el
// segundo paso), para que no se pueda alternar contraseña y códigos de 2FA sin límite.
import { query, queryOne } from '../config/db.js';
import { AppError } from '../utils/errores.js';
import { sha256, ipDe } from '../utils/seguridad.js';

export const VENTANA_MINUTOS = 15;
const MAX_POR_IP = 5;
const MAX_TOTAL = 20;

export const claveDe = (email) => sha256(String(email).trim().toLowerCase());

export const bloqueado = () => new AppError(423, 'CUENTA_BLOQUEADA',
  `Demasiados intentos fallidos. Probá de nuevo en ${VENTANA_MINUTOS} minutos.`);

async function contar(clave, ip) {
  return queryOne(
    `SELECT SUM(ip <=> ?) AS desde_ip, COUNT(*) AS total FROM intentos_login
     WHERE clave = ? AND created_at > UTC_TIMESTAMP() - INTERVAL ${VENTANA_MINUTOS} MINUTE`, [ip, clave]);
}

/** Lanza 423 si el email está bloqueado para esta IP. */
export async function exigirNoBloqueado(clave, req) {
  const c = await contar(clave, ipDe(req));
  if (Number(c.desde_ip) >= MAX_POR_IP || Number(c.total) >= MAX_TOTAL) throw bloqueado();
}

/** Registra un fallo. Es una fila por fallo (no se lee y se suma): dos fallos simultáneos cuentan los dos. */
export async function registrarFallo(clave, req, tipo) {
  await query('INSERT INTO intentos_login (clave, ip, tipo) VALUES (?, ?, ?)', [clave, ipDe(req), tipo]);
  if (Math.random() < 0.02) await purgarViejos();
}

/** Login completo: se borran los fallos de esta IP para ese email. */
export async function limpiar(clave, req) {
  await query('DELETE FROM intentos_login WHERE clave = ? AND ip <=> ?', [clave, ipDe(req)]);
}

/** Mantenimiento: borra lo que ya no cuenta (se llama de vez en cuando al registrar fallos). */
export async function purgarViejos() {
  await query(`DELETE FROM intentos_login WHERE created_at < UTC_TIMESTAMP() - INTERVAL ${VENTANA_MINUTOS * 4} MINUTE`);
}
