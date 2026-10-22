// Tests de integración de la API. Necesitan una base con schema.sql + seed.sql + `npm run seed`.
// ¡Modifican datos! Usar una base de prueba, nunca la de producción.
//
//   npm test
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';

const app = crearApp();
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const api = () => request(app);

async function login(email, password = PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login de ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}
const conToken = (token) => ({ Authorization: `Bearer ${token}` });

/** CUIT válido distinto en cada corrida (los tests dejan datos en la base). */
function cuitAleatorio() {
  const base = `30${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let dv = 11 - (pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0) % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return `${base.slice(0, 2)}-${base.slice(2)}-${dv}`;
}

after(() => pool.end());

describe('configuración segura', () => {
  test('health responde con cabeceras de seguridad y sin X-Powered-By', async () => {
    const res = await api().get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('ruta inexistente → 404 JSON', async () => {
    const res = await api().get('/api/v1/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
  });

  test('cuerpo que no es JSON → 415', async () => {
    const res = await api().post('/api/v1/auth/login').set('Content-Type', 'text/plain').send('email=a&password=b');
    assert.equal(res.status, 415);
  });

  test('JSON mal formado → 400', async () => {
    const res = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.codigo, 'JSON_INVALIDO');
  });
});

describe('login', () => {
  test('contraseña incorrecta y email inexistente dan el mismo mensaje', async () => {
    const a = await api().post('/api/v1/auth/login').send({ email: 'pablo.sosa@burgoscorp.test', password: 'mal' });
    const b = await api().post('/api/v1/auth/login').send({ email: 'nadie@burgoscorp.test', password: 'mal' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error.mensaje, b.body.error.mensaje);
  });

  test('login correcto devuelve tokens y el perfil sin datos sensibles', async () => {
    const s = await login('admin@burgoscorp.test');
    assert.ok(s.accessToken && s.refreshToken);
    assert.equal(s.usuario.rol, 'ADMIN');
    assert.equal(s.usuario.password_hash, undefined);
    const fila = await query('SELECT token_hash FROM refresh_tokens WHERE token_hash = ?', [s.refreshToken]);
    assert.equal(fila.length, 0, 'el refresh token no debe guardarse en claro');
  });

  test('bloqueo temporal después de 5 intentos fallidos', async () => {
    const email = 'gabriel.ponce@burgoscorp.test';
    for (let i = 0; i < 5; i++) {
      await api().post('/api/v1/auth/login').send({ email, password: 'incorrecta' });
    }
    const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(res.status, 423);
    await query('UPDATE usuarios SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE email = ?', [email]);
  });
});

describe('tokens', () => {
  test('sin token, token falso o con alg "none" → 401', async () => {
    assert.equal((await api().get('/api/v1/auth/yo')).status, 401);
    assert.equal((await api().get('/api/v1/auth/yo').set(conToken('abc.def.ghi'))).status, 401);
    const sinFirma = jwt.sign({ rol: 'ADMIN' }, null, { algorithm: 'none', subject: '1' });
    assert.equal((await api().get('/api/v1/auth/yo').set(conToken(sinFirma))).status, 401);
  });

  test('/auth/yo devuelve perfil y mapa de permisos', async () => {
    const s = await login('jorge.dominguez@burgoscorp.test');
    const res = await api().get('/api/v1/auth/yo').set(conToken(s.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.usuario.area.codigo, 'MEC');
    assert.equal(res.body.data.permisos.PROD.crear, true);
    assert.equal(res.body.data.permisos.SEG, undefined);
    assert.equal(res.body.data.permisos.FIN, undefined);
  });

  test('refresh rota el token y detecta reutilización', async () => {
    const s = await login('pablo.sosa@burgoscorp.test');
    const r1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    assert.equal(r1.status, 200);
    assert.notEqual(r1.body.data.refreshToken, s.refreshToken);

    // Reusar el viejo (como haría un atacante que lo robó) invalida toda la familia...
    const robo = await api().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    assert.equal(robo.status, 401);
    // ...incluido el token nuevo del usuario legítimo.
    const r2 = await api().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.data.refreshToken });
    assert.equal(r2.status, 401);
  });

  test('logout revoca el refresh token', async () => {
    const s = await login('pablo.sosa@burgoscorp.test');
    assert.equal((await api().post('/api/v1/auth/logout').send({ refreshToken: s.refreshToken })).status, 204);
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken })).status, 401);
  });
});

describe('registro', () => {
  const email = `nuevo.${Date.now()}@correo.test`;

  test('rechaza contraseña débil y campos de más (no se puede elegir el rol)', async () => {
    const debil = await api().post('/api/v1/auth/registro').send({ email, password: 'corta', nombre: 'Ana', apellido: 'Gómez' });
    assert.equal(debil.status, 400);
    const conRol = await api().post('/api/v1/auth/registro')
      .send({ email, password: 'unaClaveLarga123', nombre: 'Ana', apellido: 'Gómez', rol: 'ADMIN' });
    assert.equal(conRol.status, 400);
  });

  test('alta correcta como EMPLEADO y duplicado → 409', async () => {
    const ok = await api().post('/api/v1/auth/registro')
      .send({ email: email.toUpperCase(), password: 'unaClaveLarga123', nombre: 'Ana', apellido: 'Gómez' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.usuario.rol, 'EMPLEADO');
    assert.equal(ok.body.data.usuario.email, email, 'el email se normaliza a minúsculas');
    const dup = await api().post('/api/v1/auth/registro')
      .send({ email, password: 'unaClaveLarga123', nombre: 'Ana', apellido: 'Gómez' });
    assert.equal(dup.status, 409);
  });
});

describe('permisos por rol y área', () => {
  test('empleado de Mecanizado: ve productos, no puede crearlos ni ver clientes ni usuarios', async () => {
    const { accessToken } = await login('ramon.gimenez@burgoscorp.test');
    assert.equal((await api().get('/api/v1/productos').set(conToken(accessToken))).status, 200);
    const alta = await api().post('/api/v1/productos').set(conToken(accessToken))
      .send({ codigo: 'X-1', nombre: 'Prueba', tipo: 'insumo' });
    assert.equal(alta.status, 403);
    assert.equal((await api().get('/api/v1/clientes').set(conToken(accessToken))).status, 403);
    assert.equal((await api().get('/api/v1/usuarios').set(conToken(accessToken))).status, 403);
  });

  test('jefa de Abastecimiento sí puede dar de alta productos', async () => {
    const { accessToken } = await login('mariana.ledesma@burgoscorp.test');
    const res = await api().post('/api/v1/productos').set(conToken(accessToken))
      .send({ codigo: `TEST-${Date.now() % 100000}`, nombre: 'Electrodo 7018 2,5 mm', tipo: 'insumo', unidad: 'kg' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.unidad, 'kg');
  });

  test('alcance de área: un operario solo ve las máquinas de su área; el jefe dueño ve todas', async () => {
    const op = await login('ramon.gimenez@burgoscorp.test');
    const r1 = await api().get('/api/v1/centros-trabajo?limite=100').set(conToken(op.accessToken));
    assert.equal(r1.status, 200);
    assert.ok(r1.body.data.length > 0);
    assert.ok(r1.body.data.every((c) => c.area_nombre === 'Mecanizado'));

    const jefe = await login('jorge.dominguez@burgoscorp.test');
    const r2 = await api().get('/api/v1/centros-trabajo?limite=100').set(conToken(jefe.accessToken));
    assert.ok(r2.body.meta.total > r1.body.meta.total);
  });

  test('gerencia ve todo pero no modifica', async () => {
    const { accessToken } = await login('ricardo.ferreyra@burgoscorp.test');
    assert.equal((await api().get('/api/v1/clientes').set(conToken(accessToken))).status, 200);
    const res = await api().post('/api/v1/clientes').set(conToken(accessToken)).send({ razon_social: 'Otra SA' });
    assert.equal(res.status, 403);
  });

  test('los accesos denegados quedan auditados', async () => {
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'acceso_denegado'");
    assert.ok(n > 0);
  });
});

describe('administración de usuarios', () => {
  test('el admin no puede cambiarse su propio rol', async () => {
    const s = await login('admin@burgoscorp.test');
    const res = await api().put(`/api/v1/usuarios/${s.usuario.id}`).set(conToken(s.accessToken)).send({ rol: 'EMPLEADO' });
    assert.equal(res.status, 403);
  });

  test('cambiar el rol de alguien cierra sus sesiones', async () => {
    const admin = await login('admin@burgoscorp.test');
    const victima = await login('nestor.romero@burgoscorp.test');
    const res = await api().put(`/api/v1/usuarios/${victima.usuario.id}`).set(conToken(admin.accessToken)).send({ rol: 'JEFE' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.rol, 'JEFE');
    assert.equal(res.body.data.password_hash, undefined);
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: victima.refreshToken })).status, 401);
    await api().put(`/api/v1/usuarios/${victima.usuario.id}`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO' });
  });
});

describe('validación de entrada', () => {
  test('inyección SQL en búsqueda y orden no tiene efecto', async () => {
    const { accessToken } = await login('admin@burgoscorp.test');
    const q = await api().get('/api/v1/clientes').query({ q: "' OR 1=1 -- " }).set(conToken(accessToken));
    assert.equal(q.status, 200);
    assert.equal(q.body.data.length, 0);
    const orden = await api().get('/api/v1/clientes').query({ orden: 'id; DROP TABLE clientes' }).set(conToken(accessToken));
    assert.equal(orden.status, 400);
    const filtro = await api().get('/api/v1/clientes').query({ password_hash: 'x' }).set(conToken(accessToken));
    assert.equal(filtro.status, 400);
  });

  test('id no numérico → 400 y CUIT con dígito verificador incorrecto → 400', async () => {
    const { accessToken } = await login('admin@burgoscorp.test');
    assert.equal((await api().get('/api/v1/clientes/abc').set(conToken(accessToken))).status, 400);
    const res = await api().post('/api/v1/clientes').set(conToken(accessToken))
      .send({ razon_social: 'Cuit Malo SA', cuit: '30-12345678-0' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.detalles[0].campo, 'body.cuit');
  });

  test('referencia a un registro inexistente → 400, no 500', async () => {
    const { accessToken } = await login('admin@burgoscorp.test');
    const res = await api().post('/api/v1/puestos').set(conToken(accessToken)).send({ area_id: 9999, nombre: 'Fantasma' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.codigo, 'REFERENCIA_INVALIDA');
    // Fuera del rango de la columna (SMALLINT): también 400.
    const rango = await api().post('/api/v1/puestos').set(conToken(accessToken)).send({ area_id: 99999, nombre: 'Fantasma' });
    assert.equal(rango.status, 400);
  });

  test('CRUD completo de cliente con baja lógica', async () => {
    const { accessToken } = await login('diego.acosta@burgoscorp.test');
    const alta = await api().post('/api/v1/clientes').set(conToken(accessToken))
      .send({ razon_social: 'Talleres Prueba SRL', cuit: cuitAleatorio(), condicion_iva: 'RI' });
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    const id = alta.body.data.id;
    const mod = await api().put(`/api/v1/clientes/${id}`).set(conToken(accessToken)).send({ telefono: '011 4444-5555' });
    assert.equal(mod.body.data.telefono, '011 4444-5555');
    assert.equal((await api().delete(`/api/v1/clientes/${id}`).set(conToken(accessToken))).status, 204);
    const det = await api().get(`/api/v1/clientes/${id}`).set(conToken(accessToken));
    assert.equal(det.body.data.activo, 0);
  });
});
