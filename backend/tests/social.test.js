// Tests del login social. No se llama a Google/GitHub/Facebook: se reemplaza `fetch`
// por un simulador que responde como cada proveedor.
// Requiere en el entorno: GOOGLE_CLIENT_IDS, GITHUB_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET
// y OAUTH_REDIRECT_URIS=burgoscorp://oauth (valores de prueba).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import env from '../src/config/env.js';

const app = crearApp();
const api = () => request(app);
const fetchOriginal = globalThis.fetch;

const claveGoogle = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const claveFalsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...claveGoogle.publicKey.export({ format: 'jwk' }), kid: 'clave-1', alg: 'RS256', use: 'sig' };

// Estado del simulador (cada test lo ajusta)
const sim = { github: {}, facebook: {} };

const respuesta = (cuerpo, status = 200, headers = {}) => new Response(JSON.stringify(cuerpo), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});

before(() => {
  globalThis.fetch = async (url, opciones = {}) => {
    const u = new URL(url);
    if (u.href === 'https://www.googleapis.com/oauth2/v3/certs') {
      return respuesta({ keys: [jwk] }, 200, { 'Cache-Control': 'public, max-age=3600' });
    }
    if (u.href === 'https://github.com/login/oauth/access_token') {
      const body = JSON.parse(opciones.body);
      const valido = body.code === 'codigo-github-valido' && body.client_secret === env.GITHUB_CLIENT_SECRET && body.code_verifier;
      return respuesta(valido ? { access_token: 'gho_token' } : { error: 'bad_verification_code' });
    }
    if (u.href === 'https://api.github.com/user') return respuesta(sim.github.usuario);
    if (u.href === 'https://api.github.com/user/emails') return respuesta(sim.github.emails);
    if (u.pathname === '/debug_token') return respuesta({ data: sim.facebook.debug });
    if (u.pathname === '/me') return respuesta(sim.facebook.yo);
    throw new Error(`URL no simulada: ${url}`);
  };
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  await pool.end();
});

const habilitar = (email) => query("UPDATE usuarios SET estado_cuenta = 'habilitada' WHERE email = ?", [email]);

function idTokenGoogle(datos, { clave = claveGoogle.privateKey, aud = env.googleClientIds[0] } = {}) {
  return jwt.sign({ email_verified: true, given_name: 'Ana', family_name: 'Paz', ...datos }, clave, {
    algorithm: 'RS256', keyid: 'clave-1', audience: aud, issuer: 'https://accounts.google.com', expiresIn: '5m',
  });
}

describe('proveedores', () => {
  test('expone solo los ids públicos, nunca los secretos', async () => {
    const res = await api().get('/api/v1/auth/social/proveedores');
    assert.equal(res.status, 200);
    const texto = JSON.stringify(res.body);
    assert.ok(res.body.data.google.clientIds.length > 0);
    assert.ok(!texto.includes(env.GITHUB_CLIENT_SECRET));
    assert.ok(!texto.includes(env.FACEBOOK_APP_SECRET));
  });

  test('proveedor desconocido → 400', async () => {
    assert.equal((await api().post('/api/v1/auth/social/twitter').send({ token: 'x' })).status, 400);
  });
});

describe('Google', () => {
  const sub = `g-${Date.now()}`;
  const email = `ana.${Date.now()}@gmail.test`;

  test('la primera vez es una solicitud de acceso: queda pendiente hasta que la habilite el admin', async () => {
    const res = await api().post('/api/v1/auth/social/google').send({ idToken: idTokenGoogle({ sub, email }) });
    assert.equal(res.status, 403, JSON.stringify(res.body));
    assert.equal(res.body.error.codigo, 'CUENTA_PENDIENTE');
    const [u] = await query('SELECT estado_cuenta, email_verificado_at IS NOT NULL AS verificado FROM usuarios WHERE email = ?', [email]);
    assert.equal(u.estado_cuenta, 'pendiente');
    assert.equal(u.verificado, 1);
  });

  test('ya habilitada, entra al mismo usuario', async () => {
    await habilitar(email);
    const a = await api().post('/api/v1/auth/social/google').send({ idToken: idTokenGoogle({ sub, email }) });
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM usuarios WHERE email = ?', [email]);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.data.usuario.rol, 'EMPLEADO');
    assert.equal(a.body.data.usuario.tienePassword, false);
    assert.equal(n, 1);
  });

  test('se vincula a un empleado existente por email verificado', async () => {
    const emailRamon = 'ramon.gimenez@burgoscorp.test';
    await query(`DELETE cs FROM cuentas_sociales cs JOIN usuarios u ON u.id = cs.usuario_id
                 WHERE u.email = ? AND cs.proveedor = 'google'`, [emailRamon]);
    const res = await api().post('/api/v1/auth/social/google')
      .send({ idToken: idTokenGoogle({ sub: `g-ramon-${Date.now()}`, email: emailRamon }) });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.usuario.area.codigo, 'MEC', 'conserva legajo, área y rol');

    // Otra cuenta de Google con el mismo email no puede adueñarse del usuario.
    const otra = await api().post('/api/v1/auth/social/google')
      .send({ idToken: idTokenGoogle({ sub: `g-otra-${Date.now()}`, email: emailRamon }) });
    assert.equal(otra.status, 409);
  });

  test('una cuenta registrada con el email de otro y sin verificar no se le queda al atacante', async () => {
    // El atacante pide acceso con el email de la víctima y su propia contraseña, y el admin la habilita
    // creyendo que es ella (el email nunca se confirmó).
    const email = `victima.${Date.now()}@correo.test`;
    const atacante = await api().post('/api/v1/auth/registro').send({ email, password: 'ClaveDelAtacante1', nombre: 'Eva', apellido: 'Mala' });
    assert.equal(atacante.status, 202, JSON.stringify(atacante.body));
    await habilitar(email);
    const sesionAtacante = (await api().post('/api/v1/auth/login').send({ email, password: 'ClaveDelAtacante1' })).body.data;
    // La víctima entra con Google (email verificado por Google): se vincula a esa cuenta.
    const victima = await api().post('/api/v1/auth/social/google').send({ idToken: idTokenGoogle({ sub: `g-victima-${Date.now()}`, email }) });
    assert.equal(victima.status, 200, JSON.stringify(victima.body));
    // La contraseña y la sesión del atacante ya no sirven.
    assert.equal((await api().post('/api/v1/auth/login').send({ email, password: 'ClaveDelAtacante1' })).status, 401);
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: sesionAtacante.refreshToken })).status, 401);
    await query('DELETE FROM intentos_login WHERE created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR AND tipo = ?', ['password']);
  });

  test('rechaza firma de otra clave, otra audiencia, email no verificado o vencido', async () => {
    const otraClave = idTokenGoogle({ sub: 'x1', email: 'x1@gmail.test' }, { clave: claveFalsa.privateKey });
    assert.equal((await api().post('/api/v1/auth/social/google').send({ idToken: otraClave })).status, 401);

    const otraApp = idTokenGoogle({ sub: 'x2', email: 'x2@gmail.test' }, { aud: 'otra-app.apps.googleusercontent.com' });
    assert.equal((await api().post('/api/v1/auth/social/google').send({ idToken: otraApp })).status, 401);

    const sinVerificar = idTokenGoogle({ sub: 'x3', email: 'admin@burgoscorp.test', email_verified: false });
    const r = await api().post('/api/v1/auth/social/google').send({ idToken: sinVerificar });
    assert.equal(r.status, 400, 'no se puede tomar la cuenta del admin con un email sin verificar');

    const vencido = jwt.sign({ sub: 'x4', email: 'x4@gmail.test', email_verified: true, exp: Math.floor(Date.now() / 1000) - 60 },
      claveGoogle.privateKey, { algorithm: 'RS256', keyid: 'clave-1', audience: env.googleClientIds[0], issuer: 'https://accounts.google.com' });
    assert.equal((await api().post('/api/v1/auth/social/google').send({ idToken: vencido })).status, 401);
  });
});

describe('GitHub', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');

  test('canje de código con PKCE y email principal verificado', async () => {
    const id = Date.now();
    sim.github = {
      usuario: { id, login: 'tornero-dev', name: 'Leo Martín' },
      emails: [{ email: `leo.${id}@github.test`, primary: true, verified: true }],
    };
    const res = await api().post('/api/v1/auth/social/github')
      .send({ code: 'codigo-github-valido', codeVerifier: verifier, redirectUri: 'burgoscorp://oauth' });
    assert.equal(res.body.error?.codigo, 'CUENTA_PENDIENTE', JSON.stringify(res.body));
    const [u] = await query('SELECT nombre FROM usuarios WHERE email = ?', [`leo.${id}@github.test`]);
    assert.equal(u.nombre, 'Leo');
  });

  test('redirect URI no registrada → 400 y código inválido → 401', async () => {
    const r1 = await api().post('/api/v1/auth/social/github')
      .send({ code: 'codigo-github-valido', codeVerifier: verifier, redirectUri: 'https://atacante.test/cb' });
    assert.equal(r1.status, 400);
    const r2 = await api().post('/api/v1/auth/social/github')
      .send({ code: 'codigo-inventado-123', codeVerifier: verifier, redirectUri: 'burgoscorp://oauth' });
    assert.equal(r2.status, 401);
  });

  test('sin email verificado no crea cuenta', async () => {
    sim.github = { usuario: { id: Date.now() + 1, login: 'sin-mail' }, emails: [{ email: 'x@github.test', primary: true, verified: false }] };
    const res = await api().post('/api/v1/auth/social/github')
      .send({ code: 'codigo-github-valido', codeVerifier: verifier, redirectUri: 'burgoscorp://oauth' });
    assert.equal(res.status, 400);
  });
});

describe('Facebook', () => {
  test('token válido de nuestra app', async () => {
    const id = String(Date.now());
    sim.facebook = {
      debug: { is_valid: true, app_id: env.FACEBOOK_APP_ID, user_id: id },
      yo: { id, first_name: 'Sofía', last_name: 'Ruiz', email: `sofia.${id}@facebook.test` },
    };
    const res = await api().post('/api/v1/auth/social/facebook').send({ accessToken: 'EAAtokendeprueba1234567890' });
    assert.equal(res.body.error?.codigo, 'CUENTA_PENDIENTE', JSON.stringify(res.body));
    await habilitar(`sofia.${id}@facebook.test`);
    const otraVez = await api().post('/api/v1/auth/social/facebook').send({ accessToken: 'EAAtokendeprueba1234567890' });
    assert.equal(otraVez.status, 200, JSON.stringify(otraVez.body));
    assert.equal(otraVez.body.data.usuario.apellido, 'Ruiz');
  });

  test('token emitido para OTRA app de Facebook → 401', async () => {
    sim.facebook.debug = { is_valid: true, app_id: '999999', user_id: sim.facebook.yo.id };
    const res = await api().post('/api/v1/auth/social/facebook').send({ accessToken: 'EAAtokendeotraapp1234567890' });
    assert.equal(res.status, 401);
  });
});

describe('desvincular', () => {
  test('no se puede quitar la única forma de entrar', async () => {
    const email = `solo.google.${Date.now()}@gmail.test`;
    await api().post('/api/v1/auth/social/google').send({ idToken: idTokenGoogle({ sub: `g-${email}`, email }) });
    await habilitar(email);
    const s = (await api().post('/api/v1/auth/social/google').send({ idToken: idTokenGoogle({ sub: `g-${email}`, email }) })).body.data;
    const res = await api().delete('/api/v1/auth/social/google').set({ Authorization: `Bearer ${s.accessToken}` });
    assert.equal(res.status, 422);
  });
});
