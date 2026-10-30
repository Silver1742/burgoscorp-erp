// Login con Google, GitHub y Discord.
//
// Los tres vuelven a la misma dirección: la página /oauth de la versión web (la que da la API en
// /auth/social/proveedores). Así alcanza con registrar una sola URL en cada proveedor.
//  - En la web: se va a la pantalla del proveedor en la misma pestaña y /oauth termina el ingreso.
//  - En el celular: se abre el navegador; /oauth ve que el pedido vino de la app (state "a.…") y le
//    pasa el resultado por burgoscorp://oauth, que recibe openAuthSessionAsync.
// La app nunca ve un secreto: Google devuelve un token firmado que la API verifica, y GitHub y
// Discord un código que la API canjea con su secreto y PKCE.
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export const VUELTA_APP = 'burgoscorp://oauth';
const CLAVE = 'burgoscorp.oauth';
const esWeb = Platform.OS === 'web';
let enCurso = null; // en el celular el pedido vive en memoria mientras el navegador está abierto

const base64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function azar(bytes = 32) {
  const b = Crypto.getRandomBytes(bytes);
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return base64url(globalThis.btoa(bin));
}

/** URL de la pantalla de cada proveedor. */
function urlProveedor(proveedor, config, redirectUri, pedido) {
  const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  if (proveedor === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?${q({
      client_id: config.clientIds[0], redirect_uri: redirectUri, response_type: 'id_token',
      scope: 'openid email profile', nonce: pedido.nonce, state: pedido.state, prompt: 'select_account',
    })}`;
  }
  if (proveedor === 'github') {
    return `https://github.com/login/oauth/authorize?${q({
      client_id: config.clientId, redirect_uri: redirectUri, scope: 'read:user user:email', state: pedido.state,
      code_challenge: pedido.desafio, code_challenge_method: 'S256', allow_signup: 'false',
    })}`;
  }
  return `https://discord.com/oauth2/authorize?${q({
    client_id: config.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'identify email', state: pedido.state,
    code_challenge: pedido.desafio, code_challenge_method: 'S256',
  })}`;
}

/** Lee los parámetros que devolvió el proveedor (en la query o en el fragmento #). */
export function leerRespuesta(url) {
  const u = new URL(url.replace(/^burgoscorp:\/\//, 'https://app/'));
  const p = new URLSearchParams(u.search);
  for (const [k, v] of new URLSearchParams(u.hash.replace(/^#/, ''))) p.set(k, v);
  return Object.fromEntries(p);
}

/** Pedido guardado (web: sessionStorage, para sobrevivir a la ida y vuelta de la página). */
function guardar(pedido) {
  if (!esWeb) { enCurso = pedido; return; }
  try { globalThis.sessionStorage.setItem(CLAVE, JSON.stringify(pedido)); } catch { /* sin almacenamiento */ }
}
export function tomarPedido() {
  if (!esWeb) { const p = enCurso; enCurso = null; return p; }
  try {
    const p = JSON.parse(globalThis.sessionStorage.getItem(CLAVE) ?? 'null');
    globalThis.sessionStorage.removeItem(CLAVE);
    return p;
  } catch { return null; }
}

/**
 * Convierte la respuesta del proveedor en lo que espera POST /auth/social/:proveedor. Comprueba
 * que el `state` sea el del pedido que hizo esta misma app (evita que alguien inyecte su login).
 */
export function datosParaApi(pedido, r) {
  if (!pedido || !r.state || r.state !== pedido.state) throw new Error('La respuesta no corresponde a este ingreso. Probá de nuevo.');
  if (r.error) {
    const cancelado = ['access_denied', 'user_cancelled_login', 'user_denied'].includes(r.error);
    throw new Error(cancelado ? 'Cancelaste el ingreso.' : 'El proveedor no permitió el ingreso. Probá de nuevo.');
  }
  if (pedido.proveedor === 'google' && r.id_token) return { idToken: r.id_token, nonce: pedido.nonce };
  if (pedido.proveedor === 'github' && r.code) return { code: r.code, codeVerifier: pedido.verificador, redirectUri: pedido.redirectUri };
  if (pedido.proveedor === 'discord' && r.code) return { code: r.code, codeVerifier: pedido.verificador, redirectUri: pedido.redirectUri };
  throw new Error('El proveedor no devolvió los datos esperados. Probá de nuevo.');
}

/**
 * Empieza el ingreso. En la web se va de la página (vuelve a /oauth) y no devuelve nada; en el
 * celular devuelve { proveedor, datos } listos para la API, o null si la persona cerró el navegador.
 */
export async function iniciarIngreso(proveedor, proveedores) {
  const config = proveedores[proveedor];
  const { redirectUri } = proveedores;
  if (!config || !redirectUri) throw new Error('Ese ingreso todavía no está configurado.');
  const pedido = { proveedor, redirectUri, state: `${esWeb ? 'w' : 'a'}.${azar(24)}`, nonce: azar(24) };
  if (proveedor === 'github' || proveedor === 'discord') {
    pedido.verificador = azar(48);
    pedido.desafio = base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pedido.verificador,
      { encoding: Crypto.CryptoEncoding.BASE64 }));
  }
  const url = urlProveedor(proveedor, config, redirectUri, pedido);
  guardar(pedido);

  if (esWeb) {
    globalThis.location.assign(url);
    return null;
  }
  const r = await WebBrowser.openAuthSessionAsync(url, VUELTA_APP);
  if (r.type !== 'success') { tomarPedido(); return null; }
  const p = tomarPedido();
  return { proveedor, datos: datosParaApi(p, leerRespuesta(r.url)) };
}
