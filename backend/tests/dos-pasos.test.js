// Tests de verificación de email, recuperación de contraseña y 2FA.
// En NODE_ENV=test sin SMTP los correos quedan en `bandejaDePrueba`.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import { bandejaDePrueba } from '../src/services/email.js';
import { claveDe } from '../src/services/intentos.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const conToken = (t) => ({ Authorization: `Bearer ${t}` });

after(() => pool.end());

/** Espera el último correo enviado a `para` (algunos se mandan en segundo plano). */
async function ultimoCodigo(para) {
  for (let i = 0; i < 50; i++) {
    const correo = bandejaDePrueba.filter((c) => c.para === para).at(-1);
    if (correo) return /\b(\d{6})\b/.exec(correo.texto)[1];
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`No llegó ningún correo a ${para}`);
}
const limpiarBandeja = () => bandejaDePrueba.splice(0);

/**
 * Solicitud de acceso + habilitación (como si lo hiciera el admin) + primer login. Igual que la app
 * al abrir la pantalla de confirmar email, pide el código de verificación.
 */
async function registrar() {
  const email = `prueba.${Date.now()}.${Math.floor(Math.random() * 1e6)}@correo.test`;
  const res = await api().post('/api/v1/auth/registro')
    .send({ email, password: 'claveInicial123', nombre: 'Prueba', apellido: 'Test' });
  assert.equal(res.status, 202);
  await query("UPDATE usuarios SET estado_cuenta = 'habilitada' WHERE email = ?", [email]);
  const sesion = await api().post('/api/v1/auth/login').send({ email, password: 'claveInicial123' });
  assert.equal(sesion.status, 200, JSON.stringify(sesion.body));
  await api().post('/api/v1/auth/email/enviar').set(conToken(sesion.body.data.accessToken));
  return { email, ...sesion.body.data };
}

describe('verificación de email', () => {
  test('hasta confirmar el email no se accede a los módulos', async () => {
    limpiarBandeja();
    const u = await registrar();
    const antes = await api().get('/api/v1/productos').set(conToken(u.accessToken));
    assert.equal(antes.status, 403);
    assert.equal(antes.body.error.codigo, 'EMAIL_NO_VERIFICADO');

    const mal = await api().post('/api/v1/auth/email/verificar').set(conToken(u.accessToken)).send({ codigo: '000000' });
    // (podría coincidir por azar: 1 en un millón)
    assert.equal(mal.status, 400);

    const reenvio = await api().post('/api/v1/auth/email/enviar').set(conToken(u.accessToken));
    assert.equal(reenvio.status, 429, 'no se puede pedir otro código antes de 60 s');

    const codigo = await ultimoCodigo(u.email);
    const ok = await api().post('/api/v1/auth/email/verificar').set(conToken(u.accessToken)).send({ codigo });
    assert.equal(ok.status, 200);
    // Con el email confirmado sigue sin ver módulos hasta que RRHH le vincule un legajo.
    const despues = await api().get('/api/v1/productos').set(conToken(u.accessToken));
    assert.equal(despues.status, 403);
    assert.equal(despues.body.error.codigo, 'PROHIBIDO');

    const otraVez = await api().post('/api/v1/auth/email/verificar').set(conToken(u.accessToken)).send({ codigo });
    assert.equal(otraVez.status, 409);
  });

  test('el código se guarda como HMAC, no en claro', async () => {
    const filas = await query('SELECT codigo_hash FROM codigos_verificacion ORDER BY id DESC LIMIT 5');
    assert.ok(filas.every((f) => /^[0-9a-f]{64}$/.test(f.codigo_hash)));
  });

  test('un código admite solo 5 intentos', async () => {
    limpiarBandeja();
    const u = await registrar();
    const codigo = await ultimoCodigo(u.email);
    const otro = codigo === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) {
      await api().post('/api/v1/auth/email/verificar').set(conToken(u.accessToken)).send({ codigo: otro });
    }
    const res = await api().post('/api/v1/auth/email/verificar').set(conToken(u.accessToken)).send({ codigo });
    assert.equal(res.status, 400, 'después de 5 fallos ni el código correcto sirve');
  });
});

describe('recuperación de contraseña', () => {
  test('misma respuesta exista o no el email', async () => {
    const a = await api().post('/api/v1/auth/password/olvide').send({ email: 'no.existe@correo.test' });
    const b = await api().post('/api/v1/auth/password/olvide').send({ email: 'pablo.sosa@burgoscorp.test' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body, b.body);
  });

  test('restablecer con el código cambia la contraseña y cierra las sesiones', async () => {
    const u = await registrar();
    limpiarBandeja(); // descarta el correo de verificación del registro
    await api().post('/api/v1/auth/password/olvide').send({ email: u.email });
    const codigo = await ultimoCodigo(u.email);

    const mal = await api().post('/api/v1/auth/password/restablecer')
      .send({ email: u.email, codigo: codigo === '123456' ? '654321' : '123456', nueva: 'claveNueva456789' });
    assert.equal(mal.status, 400);

    const ok = await api().post('/api/v1/auth/password/restablecer')
      .send({ email: u.email, codigo, nueva: 'claveNueva456789' });
    assert.equal(ok.status, 200);
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).status, 401);
    assert.equal((await api().post('/api/v1/auth/login').send({ email: u.email, password: 'claveInicial123' })).status, 401);
    assert.equal((await api().post('/api/v1/auth/login').send({ email: u.email, password: 'claveNueva456789' })).status, 200);
  });
});

describe('verificación en dos pasos por email', () => {
  const email = 'julian.cabrera@burgoscorp.test';
  let accessToken;

  // Si una corrida anterior se cortó a la mitad, Julián puede haber quedado con 2FA activo.
  before(async () => {
    await query('UPDATE usuarios SET totp_habilitado = 0 WHERE email = ?', [email]);
    await query('DELETE FROM intentos_login WHERE clave = ?', [claveDe(email)]);
  });
  // Cada prueba pide códigos nuevos: se saltea la espera de un minuto entre envíos.
  const sinEspera = () => query(`UPDATE codigos_verificacion SET created_at = created_at - INTERVAL 2 MINUTE
    WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)`, [email]);
  const otroQue = (c) => (c === '000000' ? '111111' : '000000');

  test('activar: llega un código al email y hay que escribirlo', async () => {
    accessToken = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data.accessToken;
    await sinEspera();
    limpiarBandeja();
    const pedido = await api().post('/api/v1/auth/2fa/codigo').set(conToken(accessToken));
    assert.equal(pedido.status, 200);
    assert.equal(pedido.body.data.email, 'ju***@burgoscorp.test', 'dice a dónde lo mandó, sin mostrar todo el email');
    const codigo = await ultimoCodigo(email);
    assert.match(bandejaDePrueba.at(-1).asunto, /Activá la verificación en dos pasos/);

    const mal = await api().post('/api/v1/auth/2fa/activar').set(conToken(accessToken)).send({ codigo: otroQue(codigo) });
    assert.equal(mal.status, 400);
    const [antes] = await query('SELECT totp_habilitado FROM usuarios WHERE email = ?', [email]);
    assert.equal(antes.totp_habilitado, 0, 'con un código incorrecto no se activa');

    const ok = await api().post('/api/v1/auth/2fa/activar').set(conToken(accessToken)).send({ codigo });
    assert.equal(ok.status, 200);
    const yo = await api().get('/api/v1/auth/yo').set(conToken(accessToken));
    assert.equal(yo.body.data.usuario.dosPasosActivo, true);
  });

  test('el login manda el código solo y el token temporal no sirve como sesión', async () => {
    await sinEspera();
    limpiarBandeja();
    const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.requiere2fa, true);
    assert.equal(res.body.data.codigoEnviado, true);
    assert.equal(res.body.data.accessToken, undefined);
    assert.equal((await api().get('/api/v1/auth/yo').set(conToken(res.body.data.tokenTemporal))).status, 401);

    const codigo = await ultimoCodigo(email);
    assert.match(bandejaDePrueba.at(-1).asunto, /Tu código para ingresar/);
    const ok = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal: res.body.data.tokenTemporal, codigo });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.accessToken);
    const otraVez = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal: res.body.data.tokenTemporal, codigo });
    assert.equal(otraVez.status, 401, 'el token temporal sirve una sola vez');
  });

  test('el segundo paso admite 3 errores; después hay que volver a poner la contraseña', async () => {
    await sinEspera();
    limpiarBandeja();
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    const codigo = await ultimoCodigo(email);
    for (let i = 0; i < 3; i++) {
      const mal = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, codigo: otroQue(codigo) });
      assert.equal(mal.status, 400);
    }
    const vencido = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, codigo });
    assert.equal(vencido.status, 401);
    // Acertar la contraseña no borra los fallos del segundo paso (se borran al completar el login).
    const fallos = await query('SELECT COUNT(*) AS n FROM intentos_login WHERE clave = ?', [claveDe(email)]);
    assert.equal(Number(fallos[0].n), 3);
    await query('DELETE FROM intentos_login WHERE clave = ?', [claveDe(email)]);
  });

  test('reenviar el código del login respeta la espera de un minuto', async () => {
    await sinEspera();
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    assert.equal((await api().post('/api/v1/auth/2fa/email').send({ tokenTemporal })).status, 429);
    await sinEspera();
    assert.equal((await api().post('/api/v1/auth/2fa/email').send({ tokenTemporal })).status, 200);
  });

  test('desactivar pide la contraseña y un código nuevo del email', async () => {
    await sinEspera();
    limpiarBandeja();
    await api().post('/api/v1/auth/2fa/codigo').set(conToken(accessToken));
    const codigo = await ultimoCodigo(email);
    const sinPassword = await api().post('/api/v1/auth/2fa/desactivar').set(conToken(accessToken)).send({ codigo });
    assert.equal(sinPassword.status, 400, 'también pide la contraseña');
    const malCodigo = await api().post('/api/v1/auth/2fa/desactivar').set(conToken(accessToken)).send({ codigo: otroQue(codigo), password: PASSWORD });
    assert.equal(malCodigo.status, 400);
    await query('DELETE FROM intentos_login WHERE clave = ?', [claveDe(email)]);
    const ok = await api().post('/api/v1/auth/2fa/desactivar').set(conToken(accessToken)).send({ codigo, password: PASSWORD });
    assert.equal(ok.status, 200);
    const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.ok(login.body.data.accessToken, 'sin 2FA el login vuelve a ser directo');
  });
});
