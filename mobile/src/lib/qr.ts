// Etiquetas QR: llevan un enlace a la versión web (https://…/qr?c=BC:MAQ:CNC-02) para que la cámara
// común de cualquier teléfono abra la máquina, la pieza o el material. La app lee tanto ese enlace
// como el código interno (BC:MAQ:CNC-02). Solo se aceptan enlaces de nuestro propio dominio: un QR
// con otra dirección se rechaza (no se abre nada que venga de afuera).
const WEB = (process.env.EXPO_PUBLIC_WEB_URL || 'https://burgoscorp-erp.onrender.com').replace(/\/+$/, '');
const CODIGO = /^[A-Za-z0-9:._\-/]{1,100}$/;
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ENLACE = new RegExp(`^${escapar(WEB)}/qr\\?c=([^&#\\s]{1,300})$`);

/** Enlace que va impreso en la etiqueta. */
export function enlaceDeCodigo(codigo) {
  return `${WEB}/qr?c=${encodeURIComponent(codigo)}`;
}

/** Código interno a partir de lo que leyó la cámara (enlace nuestro o código suelto); null si no es nuestro. */
export function codigoDeQR(texto) {
  const s = String(texto ?? '').trim();
  const m = ENLACE.exec(s);
  let codigo = s;
  if (m) {
    try { codigo = decodeURIComponent(m[1]); } catch { return null; }
  } else if (/^https?:/i.test(s)) {
    return null;
  }
  return CODIGO.test(codigo) ? codigo : null;
}

// Si alguien escanea con la cámara del teléfono sin haber entrado, se guarda el código hasta que
// inicie sesión (solo en memoria: no sobrevive a cerrar la app ni a recargar la página).
let pendiente = null;
export const guardarQrPendiente = (codigo) => { pendiente = codigo; };
export function tomarQrPendiente() {
  const c = pendiente;
  pendiente = null;
  return c;
}
