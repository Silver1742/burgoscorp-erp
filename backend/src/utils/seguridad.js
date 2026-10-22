import crypto from 'node:crypto';

/** SHA-256 en hexadecimal (64 caracteres). Para guardar tokens y códigos sin dejarlos en claro. */
export function sha256(valor) {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

/** Token aleatorio apto para URL (por defecto 48 bytes = 64 caracteres). */
export function tokenAleatorio(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Comparación en tiempo constante de dos hashes hexadecimales. */
export function hashesIguales(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** IP del cliente (respeta TRUST_PROXY a través de req.ip). */
export function ipDe(req) {
  return (req.ip ?? '').slice(0, 45) || null;
}
