// Notificaciones en el teléfono (push), aunque la app esté cerrada.
//
// Cada teléfono con la app instalada registra su "token" de Expo al iniciar sesión (tabla
// dispositivos_push). Para avisar, la API le manda el mensaje al servicio de Expo, que lo entrega
// por Firebase (Android) o Apple (iOS).
//
// Reglas:
//  - Solo se avisa de lo que el usuario puede ver: el que decide a quién es siempre el código que
//    ya arma la notificación de la campanita (tarea asignada, aviso de su área…).
//  - El mensaje lleva título, texto corto y a qué pantalla ir; nunca datos sensibles.
//  - Nunca frena la operación: si Expo no responde, se registra en la consola y sigue.
//  - Si Expo avisa que un teléfono ya no existe (se desinstaló la app), se borra su token.
//  - En los tests no sale nada a internet: se guarda en `bandejaPush`.
import env from '../config/env.js';
import { query } from '../config/db.js';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const POR_TANDA = 100; // Expo acepta hasta 100 mensajes por pedido
export const bandejaPush = [];

/** Formato de los tokens de Expo: ExponentPushToken[xxxxxxxx] (o ExpoPushToken[...]). */
export const FORMATO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,120}\]$/;

/** Guarda (o mueve) el token de este teléfono al usuario que inició sesión. */
export async function registrarDispositivo(usuarioId, token, plataforma) {
  await query(
    `INSERT INTO dispositivos_push (usuario_id, token, plataforma) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), plataforma = VALUES(plataforma), actualizado_at = UTC_TIMESTAMP()`,
    [usuarioId, token, plataforma],
  );
}

/** Al cerrar sesión, ese teléfono deja de recibir avisos de esa cuenta. */
export async function quitarDispositivo(usuarioId, token) {
  await query('DELETE FROM dispositivos_push WHERE usuario_id = ? AND token = ?', [usuarioId, token]);
}

/**
 * Manda la notificación a todos los teléfonos de esos usuarios.
 * `datos` dice a qué pantalla ir al tocarla: { tipo, entidad, entidadId }.
 */
export async function enviarPush(usuarioIds, { titulo, mensaje, datos = {} }) {
  const ids = [...new Set((Array.isArray(usuarioIds) ? usuarioIds : [usuarioIds]).filter(Boolean))];
  if (!ids.length) return;
  try {
    const filas = await query(
      `SELECT token FROM dispositivos_push WHERE usuario_id IN (${ids.map(() => '?').join(', ')})`, ids);
    if (!filas.length) return;
    const mensajes = filas.map(({ token }) => ({
      to: token, title: String(titulo).slice(0, 120), body: String(mensaje ?? '').slice(0, 200),
      data: datos, sound: 'default', priority: 'high', channelId: 'avisos',
    }));
    if (env.NODE_ENV === 'test') {
      bandejaPush.push(...mensajes);
      return;
    }
    for (let i = 0; i < mensajes.length; i += POR_TANDA) {
      await mandarTanda(mensajes.slice(i, i + POR_TANDA));
    }
  } catch (err) {
    console.error('[push] no se pudo avisar:', err.message);
  }
}

async function mandarTanda(tanda) {
  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), 10_000);
  try {
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json',
        // Opcional: con "Enhanced push security" de Expo, solo nuestra API puede mandar a estos tokens.
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(tanda),
      signal: controlador.signal,
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[push] Expo respondió', res.status);
      return;
    }
    // Un "ticket" por mensaje, en el mismo orden: se limpian los teléfonos que ya no existen.
    const muertos = (cuerpo.data ?? [])
      .map((t, i) => (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' ? tanda[i].to : null))
      .filter(Boolean);
    if (muertos.length) {
      await query(`DELETE FROM dispositivos_push WHERE token IN (${muertos.map(() => '?').join(', ')})`, muertos);
    }
  } finally {
    clearTimeout(corte);
  }
}
