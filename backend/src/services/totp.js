// TOTP (RFC 6238): los códigos de 6 dígitos de Google Authenticator, Authy, Microsoft Authenticator.
// El secreto se guarda cifrado con AES-256-GCM; nunca en claro.
import crypto from 'node:crypto';
import env from '../config/env.js';

const PERIODO = 30;   // segundos
const DIGITOS = 6;
const VENTANA = 1;    // acepta el intervalo anterior y el siguiente (relojes desfasados)
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Codificar(buffer) {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buffer) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decodificar(texto) {
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const c of texto.replace(/=+$/, '').toUpperCase()) {
    const i = BASE32.indexOf(c);
    if (i === -1) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Código HOTP para un contador (RFC 4226). */
export function hotp(secreto, contador) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(contador));
  const h = crypto.createHmac('sha1', secreto).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const numero = (h.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITOS;
  return String(numero).padStart(DIGITOS, '0');
}

export const pasoActual = (ahora = Date.now()) => Math.floor(ahora / 1000 / PERIODO);

/** Secreto nuevo de 160 bits, en base32 (lo que se carga en la app autenticadora). */
export function generarSecreto() {
  return base32Codificar(crypto.randomBytes(20));
}

/** URI para el QR (otpauth://...). */
export function uriOtpauth(secretoBase32, email) {
  const etiqueta = encodeURIComponent(`${env.APP_NOMBRE}:${email}`);
  const emisor = encodeURIComponent(env.APP_NOMBRE);
  return `otpauth://totp/${etiqueta}?secret=${secretoBase32}&issuer=${emisor}&algorithm=SHA1&digits=${DIGITOS}&period=${PERIODO}`;
}

/**
 * Verifica un código. Devuelve el número de paso que coincidió, o null.
 * `ultimoPaso` impide reutilizar un código (o uno anterior) ya aceptado.
 */
export function verificarTotp(secretoBase32, codigo, ultimoPaso = null, ahora = Date.now()) {
  if (!/^\d{6}$/.test(codigo)) return null;
  const secreto = base32Decodificar(secretoBase32);
  const actual = pasoActual(ahora);
  for (let d = -VENTANA; d <= VENTANA; d++) {
    const paso = actual + d;
    if (ultimoPaso !== null && paso <= ultimoPaso) continue;
    const esperado = Buffer.from(hotp(secreto, paso));
    if (crypto.timingSafeEqual(esperado, Buffer.from(codigo))) return paso;
  }
  return null;
}

// ---------------------------------------------------------------- cifrado del secreto

/** 64 hex o 32 bytes en base64 se usan tal cual; cualquier otro valor largo se pasa por SHA-256. */
function clave() {
  const v = env.TOTP_ENC_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  const b64 = Buffer.from(v, 'base64');
  if (b64.length === 32 && /^[A-Za-z0-9+/]+={0,2}$/.test(v)) return b64;
  return crypto.createHash('sha256').update(v, 'utf8').digest();
}

export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), datos].map((b) => b.toString('base64')).join(':');
}

export function descifrar(guardado) {
  const [iv, tag, datos] = guardado.split(':').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
}
