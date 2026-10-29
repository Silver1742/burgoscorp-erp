// Tests de las correcciones de la auditoría OWASP del día 9: cuentas sin legajo, registro cerrado,
// catálogo de habilidades, parar máquinas ajenas, saltear Calidad, datos personales, reuso de
// refresh tokens, vinculación social de cuentas sin verificar y errores de la petición.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import env from '../src/config/env.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  jorge: 'jorge.dominguez@burgoscorp.test',    // jefe de Mecanizado
  ramon: 'ramon.gimenez@burgoscorp.test',      // tornero (Mecanizado)
  carolina: 'carolina.mendez@burgoscorp.test', // jefa de RRHH
  claudio: 'claudio.ortiz@burgoscorp.test',    // soldador (otra área)
  ricardo: 'ricardo.ferreyra@burgoscorp.test', // gerencia
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const sufijo = Date.now().toString(36);
const login = (email, password = PASSWORD) => api().post('/api/v1/auth/login').send({ email, password });

let sinLegajo;

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await login(email);
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
  // Una cuenta con el email confirmado pero sin legajo (como queda alguien que se registra solo).
  const email = `sin.legajo.${sufijo}@correo.test`;
  // Una cuenta habilitada por el admin pero todavía sin legajo vinculado.
  await query(`INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, email_verificado_at)
    VALUES (?, ?, 'Sin', 'Legajo', (SELECT id FROM roles WHERE codigo = 'EMPLEADO'), UTC_TIMESTAMP())`,
  [email, await bcrypt.hash(PASSWORD, 4)]);
  sinLegajo = (await login(email)).body.data;
});
after(() => pool.end());

describe('cuentas sin legajo y registro', () => {
  test('una cuenta sin legajo no entra a ningún módulo', async () => {
    const t = { Authorization: `Bearer ${sinLegajo.accessToken}` };
    const yo = await api().get('/api/v1/auth/yo').set(t);
    assert.equal(yo.status, 200);
    assert.deepEqual(yo.body.data.permisos, {});
    for (const ruta of ['/productos', '/inventario/stock', '/maquinas', '/organigrama', '/tablero', '/areas']) {
      assert.equal((await api().get(`/api/v1${ruta}`).set(t)).status, 403, ruta);
    }
    const maquina = (await query("SELECT id FROM centros_trabajo WHERE codigo = 'CNC-01'"))[0].id;
    assert.equal((await api().post('/api/v1/ordenes-mantenimiento').set(t)
      .send({ centro_trabajo_id: maquina, descripcion: 'Parar todo', detiene_maquina: true })).status, 403);
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'BC:MAQ:CNC-01' }).set(t)).status, 404);
  });

  test('con el registro cerrado (producción) nadie se registra, exista o no el email', async () => {
    const antes = env.registroAbierto;
    env.registroAbierto = false;
    try {
      for (const email of [`nuevo.${sufijo}@correo.test`, EMAILS.ramon]) {
        const r = await api().post('/api/v1/auth/registro').send({ email, password: 'ClaveSegura123', nombre: 'Ana', apellido: 'Gómez' });
        assert.equal(r.status, 403, email);
      }
    } finally {
      env.registroAbierto = antes;
    }
  });
});

describe('permisos de negocio', () => {
  test('el catálogo de habilidades lo modifica solo RRHH', async () => {
    const datos = { codigo: `T_${sufijo}`.toUpperCase().slice(0, 20), nombre: 'Habilidad de prueba' };
    assert.equal((await api().post('/api/v1/habilidades').set(como('jorge')).send(datos)).status, 403);
    assert.equal((await api().post('/api/v1/habilidades').set(como('carolina')).send(datos)).status, 201);
  });

  test('solo el área de la máquina o Mantenimiento la marca como parada', async () => {
    const plegadora = (await query("SELECT id FROM centros_trabajo WHERE codigo = 'PLE-01'"))[0].id;
    const r = await api().post('/api/v1/ordenes-mantenimiento').set(como('claudio'))
      .send({ centro_trabajo_id: plegadora, descripcion: 'Ruido raro al bajar', detiene_maquina: true });
    assert.equal(r.status, 403);
    const estado = (await query('SELECT estado FROM centros_trabajo WHERE id = ?', [plegadora]))[0].estado;
    assert.equal(estado, 'operativo');
  });

  test('Producción no puede saltearse Calidad: a "terminada" la pasa solo la inspección', async () => {
    const o = await api().post('/api/v1/ordenes-trabajo').set(como('jorge')).send({ titulo: `Eje de prueba ${sufijo}`, tipo_trabajo: 'mecanizado' });
    await query("UPDATE ordenes_trabajo SET estado = 'control_calidad' WHERE id = ?", [o.body.data.id]);
    const r = await api().put(`/api/v1/ordenes-trabajo/${o.body.data.id}`).set(como('jorge')).send({ estado: 'terminada' });
    assert.equal(r.status, 422);
    await query("UPDATE ordenes_trabajo SET estado = 'cancelada' WHERE id = ?", [o.body.data.id]);
  });
});

describe('datos personales', () => {
  test('DNI, CUIL, domicilio y costo los ven RRHH y el propio empleado, no el jefe ni Gerencia', async () => {
    const id = s.ramon.usuario.empleadoId;
    for (const q of ['jorge', 'ricardo']) {
      const r = await api().get(`/api/v1/empleados/${id}`).set(como(q));
      assert.equal(r.status, 200, q);
      for (const c of ['dni', 'cuil', 'fecha_nacimiento', 'direccion', 'costo_hora']) assert.equal(r.body.data[c], undefined, `${q}: ${c}`);
      assert.ok(r.body.data.apellido);
    }
    assert.ok((await api().get(`/api/v1/empleados/${id}`).set(como('ramon'))).body.data.dni);
    assert.ok((await api().get(`/api/v1/empleados/${id}`).set(como('carolina'))).body.data.dni);
    const lista = await api().get('/api/v1/empleados').query({ limite: 50 }).set(como('jorge'));
    assert.ok(lista.body.data.every((e) => e.dni === undefined || e.id === s.jorge.usuario.empleadoId));
  });

  test('cada uno cambia solo su propio teléfono (ni el jefe el de su equipo)', async () => {
    const id = s.ramon.usuario.empleadoId;
    assert.equal((await api().put(`/api/v1/empleados/${id}`).set(como('jorge')).send({ telefono: '11 5555-0000' })).status, 403);
    assert.equal((await api().put(`/api/v1/empleados/${id}`).set(como('ramon')).send({ telefono: '11 5555-1234' })).status, 200);
  });
});

describe('sesiones', () => {
  test('reusar un refresh token ya canjeado cierra todas las sesiones del usuario', async () => {
    const a = (await login(EMAILS.claudio)).body.data;
    const b = (await login(EMAILS.claudio)).body.data;
    const rotado = await api().post('/api/v1/auth/refresh').send({ refreshToken: a.refreshToken });
    assert.equal(rotado.status, 200);
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: a.refreshToken })).status, 401, 'reuso');
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: b.refreshToken })).status, 401, 'la otra sesión también');
    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: rotado.body.data.refreshToken })).status, 401);
  });

  test('la sesión tiene vida máxima: rotar no la estira', async () => {
    const r = (await login(EMAILS.claudio)).body.data;
    const [fila] = await query("SELECT familia_id FROM refresh_tokens WHERE usuario_id = ? ORDER BY id DESC LIMIT 1", [s.claudio.usuario.id]);
    // Se simula que la sesión empezó hace casi 30 días.
    await query('UPDATE refresh_tokens SET familia_expira_at = UTC_TIMESTAMP() + INTERVAL 1 HOUR WHERE familia_id = ?', [fila.familia_id]);
    const rotado = await api().post('/api/v1/auth/refresh').send({ refreshToken: r.refreshToken });
    assert.equal(rotado.status, 200);
    const [nuevo] = await query('SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expira_at) AS minutos FROM refresh_tokens WHERE familia_id = ? ORDER BY id DESC LIMIT 1', [fila.familia_id]);
    assert.ok(Number(nuevo.minutos) <= 60, 'el token nuevo vence con la sesión, no en 7 días');
  });
});

describe('peticiones inválidas', () => {
  test('un charset no soportado es un 4xx, no un 500', async () => {
    const r = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json; charset=utf-7').send('{"email":"a@b.c"}');
    assert.ok(r.status >= 400 && r.status < 500, String(r.status));
  });
});
