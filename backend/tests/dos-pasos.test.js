// Tests de verificación de email, recuperación de contraseña y 2FA.
// En NODE_ENV=test sin SMTP los correos quedan en `bandejaDePrueba`.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import { bandejaDePrueba } from '../src/services/email.js';
import { hotp, base32Decodificar, pasoActual, verificarTotp, cifrar, descifrar } from '../src/services/totp.js';

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

async function registrar() {
  const email = `prueba.${Date.now()}.${Math.floor(Math.random() * 1e6)}@correo.test`;
  const res = await api().post('/api/v1/auth/registro')
    .send({ email, password: 'claveInicial123', nombre: 'Prueba', apellido: 'Test' });
  assert.equal(res.status, 201);
  return { email, ...res.body.data };
}

describe('TOTP (RFC 6238)', () => {
  test('vectores de prueba oficiales (SHA-1)', () => {
    const secreto = Buffer.from('12345678901234567890');
    // El RFC da 8 dígitos; con 6 dígitos son los últimos 6.
    assert.equal(hotp(secreto, Math.floor(59 / 30)), '287082');
    assert.equal(hotp(secreto, Math.floor(1111111109 / 30)), '081804');
    assert.equal(hotp(secreto, Math.floor(1234567890 / 30)), '005924');
    assert.equal(hotp(secreto, Math.floor(2000000000 / 30)), '279037');
  });

  test('no acepta reusar un código ni códigos de más de un intervalo de distancia', () => {
    const secreto = 'JBSWY3DPEHPK3PXP';
    const ahora = Date.now();
    const codigo = hotp(base32Decodificar(secreto), pasoActual(ahora));
    const paso = verificarTotp(secreto, codigo, null, ahora);
    assert.equal(paso, pasoActual(ahora));
    assert.equal(verificarTotp(secreto, codigo, paso, ahora), null, 'reuso');
    const viejo = hotp(base32Decodificar(secreto), pasoActual(ahora) - 3);
    assert.equal(verificarTotp(secreto, viejo, null, ahora), null, 'fuera de ventana');
  });

  test('el cifrado AES-GCM detecta alteraciones', () => {
    const guardado = cifrar('SECRETO');
    assert.equal(descifrar(guardado), 'SECRETO');
    const [iv, tag, datos] = guardado.split(':');
    const alterado = [iv, tag, Buffer.from('OTRO').toString('base64')].join(':');
    assert.notEqual(datos, Buffer.from('OTRO').toString('base64'));
    assert.throws(() => descifrar(alterado));
  });
});

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
    const despues = await api().get('/api/v1/productos').set(conToken(u.accessToken));
    assert.equal(despues.status, 200);

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

describe('verificación en dos pasos', () => {
  const email = 'julian.cabrera@burgoscorp.test';
  let secreto;
  let respaldo;
  let pasoActivacion; // intervalo de 30 s del código usado al activar

  const codigoDelPaso = (paso) => hotp(base32Decodificar(secreto), paso);

  test('configurar y activar con la app autenticadora', async () => {
    const { accessToken } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    const conf = await api().post('/api/v1/auth/2fa/configurar').set(conToken(accessToken));
    assert.equal(conf.status, 200);
    secreto = conf.body.data.secreto;
    assert.match(conf.body.data.otpauthUri, /^otpauth:\/\/totp\/.+secret=[A-Z2-7]+&issuer=/);

    const [fila] = await query('SELECT totp_secret_cifrado, totp_habilitado FROM usuarios WHERE email = ?', [email]);
    assert.ok(!fila.totp_secret_cifrado.includes(secreto), 'el secreto se guarda cifrado');
    assert.equal(fila.totp_habilitado, 0, 'no se activa hasta confirmar un código');

    pasoActivacion = pasoActual();
    const act = await api().post('/api/v1/auth/2fa/activar').set(conToken(accessToken)).send({ codigo: codigoDelPaso(pasoActivacion) });
    assert.equal(act.status, 200);
    respaldo = act.body.data.codigosRespaldo;
    assert.equal(respaldo.length, 10);
  });

  test('el login pide el segundo paso y el token temporal no sirve como sesión', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.requiere2fa, true);
    assert.equal(res.body.data.accessToken, undefined);
    assert.equal((await api().get('/api/v1/auth/yo').set(conToken(res.body.data.tokenTemporal))).status, 401);
  });

  test('segundo paso con TOTP: un código ya usado no sirve', async () => {
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    // El código de la activación ya se usó: sirve el del intervalo siguiente. Se toman los intervalos
    // fijos de la activación para que la prueba no falle si justo cambia el código de 30 segundos.
    const reuso = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, metodo: 'totp', codigo: codigoDelPaso(pasoActivacion) });
    assert.equal(reuso.status, 400);
    const ok = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, metodo: 'totp', codigo: codigoDelPaso(pasoActivacion + 1) });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.accessToken);
  });

  test('segundo paso con código de respaldo (un solo uso)', async () => {
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    const ok = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, metodo: 'respaldo', codigo: respaldo[0].toLowerCase() });
    assert.equal(ok.status, 200);
    const t2 = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data.tokenTemporal;
    const otraVez = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal: t2, metodo: 'respaldo', codigo: respaldo[0] });
    assert.equal(otraVez.status, 400);
    await query('UPDATE usuarios SET intentos_fallidos = 0 WHERE email = ?', [email]);
  });

  test('segundo paso con código por email', async () => {
    limpiarBandeja();
    // Si los tests se repiten seguido, evita el límite de un código por minuto.
    await query(`UPDATE codigos_verificacion SET created_at = created_at - INTERVAL 2 MINUTE
                 WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)`, [email]);
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    assert.equal((await api().post('/api/v1/auth/2fa/email').send({ tokenTemporal })).status, 200);
    const codigo = await ultimoCodigo(email);
    const ok = await api().post('/api/v1/auth/2fa/verificar').send({ tokenTemporal, metodo: 'email', codigo });
    assert.equal(ok.status, 200);
  });

  test('desactivar exige el segundo factor', async () => {
    const { tokenTemporal } = (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
    const { accessToken } = (await api().post('/api/v1/auth/2fa/verificar')
      .send({ tokenTemporal, metodo: 'respaldo', codigo: respaldo[1] })).body.data;
    const sinCodigo = await api().post('/api/v1/auth/2fa/desactivar').set(conToken(accessToken)).send({ codigo: '000000' });
    assert.equal(sinCodigo.status, 400);
    const ok = await api().post('/api/v1/auth/2fa/desactivar').set(conToken(accessToken)).send({ codigo: respaldo[2] });
    assert.equal(ok.status, 200);
    const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.ok(login.body.data.accessToken, 'sin 2FA el login vuelve a ser directo');
  });
});
