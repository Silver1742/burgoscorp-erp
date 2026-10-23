// Códigos de 6 dígitos de un solo uso (verificar email, recuperar contraseña, login por email).
// Se guarda un HMAC con un secreto del servidor: aunque se filtre la base, no se pueden
// recuperar los códigos probando el millón de combinaciones.
import crypto from 'node:crypto';
import env from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { AppError } from '../utils/errores.js';

const MINUTOS_VALIDEZ = 10;
const MAX_INTENTOS = 5;
const SEGUNDOS_ENTRE_ENVIOS = 60;

function hmac(usuarioId, tipo, codigo) {
  return crypto.createHmac('sha256', env.JWT_TEMP_SECRET).update(`${tipo}:${usuarioId}:${codigo}`).digest('hex');
}

/** Genera un código nuevo (invalida los anteriores del mismo tipo) y lo devuelve para enviarlo. */
export async function generarCodigo(usuarioId, tipo) {
  const ultimo = await queryOne(
    `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS hace FROM codigos_verificacion
     WHERE usuario_id = ? AND tipo = ? ORDER BY id DESC LIMIT 1`,
    [usuarioId, tipo],
  );
  if (ultimo && ultimo.hace < SEGUNDOS_ENTRE_ENVIOS) {
    throw new AppError(429, 'ESPERAR_REENVIO',
      `Ya te enviamos un código. Podés pedir otro en ${SEGUNDOS_ENTRE_ENVIOS - ultimo.hace} segundos.`);
  }

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await query(
    'UPDATE codigos_verificacion SET usado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND tipo = ? AND usado_at IS NULL',
    [usuarioId, tipo],
  );
  await query(
    'INSERT INTO codigos_verificacion (usuario_id, tipo, codigo_hash, expira_at) VALUES (?, ?, ?, ?)',
    [usuarioId, tipo, hmac(usuarioId, tipo, codigo), new Date(Date.now() + MINUTOS_VALIDEZ * 60 * 1000)],
  );
  return codigo;
}

/** true si el código es correcto (y lo consume). Cada código admite 5 intentos. */
export async function verificarCodigo(usuarioId, tipo, codigo) {
  const fila = await queryOne(
    `SELECT id, codigo_hash, intentos, expira_at FROM codigos_verificacion
     WHERE usuario_id = ? AND tipo = ? AND usado_at IS NULL ORDER BY id DESC LIMIT 1`,
    [usuarioId, tipo],
  );
  if (!fila || fila.intentos >= MAX_INTENTOS || new Date(fila.expira_at) <= new Date()) return false;

  const esperado = Buffer.from(fila.codigo_hash, 'hex');
  const recibido = Buffer.from(hmac(usuarioId, tipo, codigo), 'hex');
  if (!crypto.timingSafeEqual(esperado, recibido)) {
    await query('UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id = ?', [fila.id]);
    return false;
  }
  // El UPDATE condicionado evita que dos peticiones simultáneas usen el mismo código.
  const r = await query(
    'UPDATE codigos_verificacion SET usado_at = UTC_TIMESTAMP() WHERE id = ? AND usado_at IS NULL', [fila.id]);
  return r.affectedRows === 1;
}
