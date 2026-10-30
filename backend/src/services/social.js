// Login con Google, GitHub y Facebook.
//
// La app hace el flujo OAuth (Authorization Code + PKCE con expo-auth-session) y manda al
// backend lo que obtuvo. El backend NUNCA confía en datos que mande la app: verifica con el
// proveedor (firma del id_token de Google, canje del código de GitHub, debug_token de Facebook)
// y recién ahí emite sus propios JWT.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { query, queryOne, transaccion } from '../config/db.js';
import { AppError, errores } from '../utils/errores.js';
import { auditar } from './auditoria.js';
import { buscarUsuarioPorId, exigirCuentaHabilitada } from './usuarios.js';
import { firmarTemporal, revocarTodas } from './tokens.js';
import { avisarSolicitud, emitirSesion } from './auth.js';
import { iniciarSegundoPaso } from './dosPasos.js';

const TIMEOUT_MS = 8000;
const noConfigurado = (p) => new AppError(503, 'PROVEEDOR_NO_CONFIGURADO', `El inicio de sesión con ${p} no está habilitado`);
const rechazado = (p) => errores.noAutenticado(`No se pudo verificar la cuenta de ${p}. Probá de nuevo.`);

async function pedirJson(url, opciones = {}) {
  const res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const cuerpo = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, cuerpo, headers: res.headers };
}

function separarNombre(completo, respaldo) {
  const partes = (completo || respaldo || 'Usuario').trim().split(/\s+/);
  const nombre = partes.shift().slice(0, 60);
  return { nombre, apellido: (partes.join(' ') || '-').slice(0, 60) };
}

// ---------------------------------------------------------------- Google (id_token firmado RS256)

let jwksGoogle = { claves: new Map(), venceEn: 0 };

async function claveGoogle(kid) {
  if (Date.now() > jwksGoogle.venceEn || !jwksGoogle.claves.has(kid)) {
    const r = await pedirJson('https://www.googleapis.com/oauth2/v3/certs');
    if (!r.ok || !Array.isArray(r.cuerpo.keys)) throw rechazado('Google');
    const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') ?? '')?.[1] ?? 3600);
    jwksGoogle = {
      claves: new Map(r.cuerpo.keys.map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])),
      venceEn: Date.now() + Math.min(maxAge, 86400) * 1000,
    };
  }
  return jwksGoogle.claves.get(kid);
}

async function perfilGoogle({ idToken }) {
  if (!env.googleClientIds.length) throw noConfigurado('Google');
  const kid = jwt.decode(idToken, { complete: true })?.header?.kid;
  const clave = kid && (await claveGoogle(kid));
  if (!clave) throw rechazado('Google');
  let p;
  try {
    p = jwt.verify(idToken, clave, {
      algorithms: ['RS256'],
      audience: env.googleClientIds,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });
  } catch {
    throw rechazado('Google');
  }
  return {
    uid: p.sub,
    email: p.email?.toLowerCase(),
    emailVerificado: p.email_verified === true,
    ...separarNombre(p.given_name && `${p.given_name} ${p.family_name ?? ''}`, p.name),
  };
}

// ---------------------------------------------------------------- GitHub (canje de código + PKCE)

async function perfilGithub({ code, codeVerifier, redirectUri }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw noConfigurado('GitHub');
  // Solo se aceptan redirect URIs conocidas (evita que se canjeen códigos emitidos para otra app).
  if (!env.oauthRedirectUris.includes(redirectUri)) throw errores.validacion([{ campo: 'body.redirectUri', mensaje: 'Redirect URI no permitida' }]);

  const token = await pedirJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  const accessToken = token.cuerpo.access_token;
  if (!token.ok || !accessToken) throw rechazado('GitHub');

  const cabeceras = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'BurgosCorp-ERP' };
  const [usuario, emails] = await Promise.all([
    pedirJson('https://api.github.com/user', { headers: cabeceras }),
    pedirJson('https://api.github.com/user/emails', { headers: cabeceras }),
  ]);
  if (!usuario.ok || !usuario.cuerpo.id) throw rechazado('GitHub');
  const principal = Array.isArray(emails.cuerpo) ? emails.cuerpo.find((e) => e.primary && e.verified) : null;

  return {
    uid: String(usuario.cuerpo.id),
    email: principal?.email?.toLowerCase(),
    emailVerificado: Boolean(principal),
    ...separarNombre(usuario.cuerpo.name, usuario.cuerpo.login),
  };
}

// ---------------------------------------------------------------- Facebook (validación del access token)

async function perfilFacebook({ accessToken }) {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) throw noConfigurado('Facebook');
  const tokenApp = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

  // Confirma que el token es válido y fue emitido para NUESTRA app (no para otra app de Facebook).
  const debug = await pedirJson(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}`,
    { headers: { Authorization: `Bearer ${tokenApp}` } },
  );
  const d = debug.cuerpo.data;
  if (!debug.ok || !d?.is_valid || String(d.app_id) !== env.FACEBOOK_APP_ID) throw rechazado('Facebook');

  const prueba = crypto.createHmac('sha256', env.FACEBOOK_APP_SECRET).update(accessToken).digest('hex');
  const yo = await pedirJson(
    `https://graph.facebook.com/me?fields=id,first_name,last_name,email&appsecret_proof=${prueba}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!yo.ok || String(yo.cuerpo.id) !== String(d.user_id)) throw rechazado('Facebook');

  return {
    uid: String(yo.cuerpo.id),
    email: yo.cuerpo.email?.toLowerCase(),
    emailVerificado: Boolean(yo.cuerpo.email), // Facebook solo devuelve emails confirmados
    nombre: (yo.cuerpo.first_name || 'Usuario').slice(0, 60),
    apellido: (yo.cuerpo.last_name || '-').slice(0, 60),
  };
}

const PROVEEDORES = {
  google: { nombre: 'Google', perfil: perfilGoogle, configurado: () => env.googleClientIds.length > 0 },
  github: { nombre: 'GitHub', perfil: perfilGithub, configurado: () => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) },
  facebook: { nombre: 'Facebook', perfil: perfilFacebook, configurado: () => Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) },
};

/** Qué botones mostrar en la app y con qué ids públicos (nunca los secretos). */
export function proveedoresDisponibles() {
  return {
    google: PROVEEDORES.google.configurado() ? { clientIds: env.googleClientIds } : null,
    github: PROVEEDORES.github.configurado() ? { clientId: env.GITHUB_CLIENT_ID } : null,
    facebook: PROVEEDORES.facebook.configurado() ? { appId: env.FACEBOOK_APP_ID } : null,
  };
}

/**
 * Inicia sesión con una red social.
 *   1. Si la cuenta social ya está vinculada → ese usuario.
 *   2. Si no, y el proveedor confirma el email → se vincula al usuario con ese email
 *      (así un empleado dado de alta por RRHH entra con su Google corporativo), o se crea uno nuevo.
 * Si el usuario tiene 2FA, igual se le pide el segundo paso.
 */
export async function loginSocial(proveedor, datos, req) {
  const p = PROVEEDORES[proveedor];
  let perfil;
  try {
    perfil = await p.perfil(datos);
  } catch (err) {
    if (!(err instanceof AppError)) console.error(`[social] error consultando ${p.nombre}`, err.message);
    await auditar(req, { accion: 'login_fallido', usuarioId: null, detalle: { metodo: proveedor } });
    throw err instanceof AppError ? err : rechazado(p.nombre);
  }

  const cuenta = await queryOne('SELECT usuario_id FROM cuentas_sociales WHERE proveedor = ? AND proveedor_uid = ?',
    [proveedor, perfil.uid]);
  let usuarioId = cuenta?.usuario_id;

  if (!usuarioId) {
    if (!perfil.email || !perfil.emailVerificado) {
      throw errores.validacion([], `Tu cuenta de ${p.nombre} no tiene un email verificado. Usá otro método para ingresar.`);
    }
    let nueva = false;
    usuarioId = await transaccion(async (conn) => {
      const [existentes] = await conn.execute('SELECT id FROM usuarios WHERE email = ? FOR UPDATE', [perfil.email]);
      let id = existentes[0]?.id;
      if (id) {
        const [yaVinculada] = await conn.execute(
          'SELECT 1 FROM cuentas_sociales WHERE usuario_id = ? AND proveedor = ?', [id, proveedor]);
        if (yaVinculada.length) {
          throw errores.conflicto(`Tu usuario ya tiene otra cuenta de ${p.nombre} vinculada. Ingresá con esa o con tu contraseña.`);
        }
        // Si la cuenta existente nunca confirmó el email, pudo crearla otra persona con el email de la
        // víctima: se le saca la contraseña y se cierran sus sesiones antes de vincularla.
        const [[previa]] = await conn.execute('SELECT email_verificado_at FROM usuarios WHERE id = ?', [id]);
        if (!previa.email_verificado_at) {
          await conn.execute(`UPDATE usuarios SET password_hash = NULL, totp_habilitado = 0, totp_secret_cifrado = NULL,
            totp_ultimo_paso = NULL WHERE id = ?`, [id]);
          await conn.execute('DELETE FROM codigos_respaldo_2fa WHERE usuario_id = ?', [id]);
          await conn.execute('UPDATE codigos_verificacion SET usado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND usado_at IS NULL', [id]);
          await revocarTodas(id, conn);
        }
        await conn.execute('UPDATE usuarios SET email_verificado_at = COALESCE(email_verificado_at, UTC_TIMESTAMP()) WHERE id = ?', [id]);
      } else {
        if (!env.registroAbierto) throw errores.prohibido('No hay una cuenta con ese email. Pedile la cuenta a un administrador.');
        // Primera vez con una red social: es una solicitud de acceso, igual que registrarse.
        const [r] = await conn.execute(
          `INSERT INTO usuarios (email, nombre, apellido, rol_id, email_verificado_at, estado_cuenta)
           VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), UTC_TIMESTAMP(), 'pendiente')`,
          [perfil.email, perfil.nombre, perfil.apellido],
        );
        id = r.insertId;
        nueva = true;
      }
      await conn.execute('INSERT INTO cuentas_sociales (usuario_id, proveedor, proveedor_uid, email) VALUES (?, ?, ?, ?)',
        [id, proveedor, perfil.uid, perfil.email]);
      return id;
    });
    await auditar(req, { accion: 'cuenta_social_vinculada', usuarioId, detalle: { proveedor } });
    if (nueva) await avisarSolicitud(usuarioId, perfil.nombre, perfil.apellido);
  }

  const usuario = await buscarUsuarioPorId(usuarioId);
  exigirCuentaHabilitada(usuario);
  if (usuario.totp_habilitado) return iniciarSegundoPaso(usuario, firmarTemporal);

  await auditar(req, { accion: 'login_ok', usuarioId, detalle: { metodo: proveedor } });
  return emitirSesion(usuario, req);
}

/** Desvincula una red social, siempre que le quede otra forma de entrar. */
export async function desvincular(usuario, proveedor, req) {
  const [{ otras }] = await query(
    'SELECT COUNT(*) AS otras FROM cuentas_sociales WHERE usuario_id = ? AND proveedor <> ?', [usuario.id, proveedor]);
  if (!usuario.tiene_password && otras === 0) {
    throw errores.negocio('Definí una contraseña o vinculá otra red social antes de quitar esta');
  }
  const r = await query('DELETE FROM cuentas_sociales WHERE usuario_id = ? AND proveedor = ?', [usuario.id, proveedor]);
  if (!r.affectedRows) throw errores.noEncontrado('Esa red social no está vinculada');
  await auditar(req, { accion: 'cuenta_social_desvinculada', detalle: { proveedor } });
}
