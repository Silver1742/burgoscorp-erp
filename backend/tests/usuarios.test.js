// Administración de usuarios (como en R3): listado con filtros, edición, baja, eliminación y
// envío del código para crear la contraseña. Necesita la base de prueba con `npm run seed`.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query, queryOne } from '../src/config/db.js';
import { bandejaDePrueba } from '../src/services/email.js';

const app = crearApp();
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const api = () => request(app);
const conToken = (token) => ({ Authorization: `Bearer ${token}` });

async function login(email) {
  const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, `login de ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Solicitud de acceso nueva (queda pendiente), con un email distinto en cada corrida. */
async function nuevaSolicitud(nombre = 'Prueba') {
  const email = `usr.${Date.now()}.${Math.floor(Math.random() * 1e6)}@correo.test`;
  const res = await api().post('/api/v1/auth/registro').send({ email, password: 'PruebaUsuarios2026', nombre, apellido: 'Usuarios' });
  assert.equal(res.status, 202);
  return queryOne('SELECT id, email FROM usuarios WHERE email = ?', [email]);
}

const areaId = async (codigo) => (await queryOne('SELECT id FROM areas WHERE codigo = ?', [codigo])).id;
const habilidadId = async (codigo) => (await queryOne('SELECT id FROM habilidades WHERE codigo = ?', [codigo])).id;

after(() => pool.end());

describe('administración de usuarios', () => {
  test('filtra por estado y busca por legajo', async () => {
    const admin = await login('admin@burgoscorp.test');
    const pendiente = await nuevaSolicitud();

    const pendientes = await api().get('/api/v1/usuarios').query({ estado: 'pendientes', limite: 100 }).set(conToken(admin.accessToken));
    assert.equal(pendientes.status, 200);
    assert.ok(pendientes.body.data.some((u) => u.id === pendiente.id));
    assert.ok(pendientes.body.data.every((u) => u.estado_cuenta === 'pendiente'));

    const activos = await api().get('/api/v1/usuarios').query({ estado: 'activos', limite: 100 }).set(conToken(admin.accessToken));
    assert.ok(activos.body.data.every((u) => u.estado_cuenta === 'habilitada' && u.activo));

    const porLegajo = await api().get('/api/v1/usuarios').query({ q: 'L0011' }).set(conToken(admin.accessToken));
    assert.equal(porLegajo.body.data[0]?.legajo, 'L0011');

    const malOrden = await api().get('/api/v1/usuarios').query({ orden: 'u.id; DROP' }).set(conToken(admin.accessToken));
    assert.equal(malOrden.status, 400);
  });

  test('edita el nombre y da de baja a otro administrador', async () => {
    const admin = await login('admin@burgoscorp.test');
    const solicitud = await nuevaSolicitud();
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO', area_id: await areaId('MEC') });

    const editado = await api().put(`/api/v1/usuarios/${solicitud.id}`).set(conToken(admin.accessToken)).send({ nombre: 'Renombrado' });
    assert.equal(editado.status, 200);
    assert.equal(editado.body.data.nombre, 'Renombrado');

    // Si el admin de prueba fuera el único, no se lo puede dar de baja (lo protege también "no a uno mismo").
    const otrosAdmins = await query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.codigo = 'ADMIN' AND u.activo = 1 AND u.estado_cuenta = 'habilitada' AND u.email <> 'admin@burgoscorp.test'`);
    if (otrosAdmins.length === 0) {
      const segundo = await nuevaSolicitud('Segundo');
      await api().post(`/api/v1/usuarios/${segundo.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'ADMIN' });
      // Ahora hay dos: bajar al segundo sí se puede; y entonces el primero queda como único.
      const baja = await api().put(`/api/v1/usuarios/${segundo.id}`).set(conToken(admin.accessToken)).send({ activo: false });
      assert.equal(baja.status, 200);
    }
  });

  test('la baja cierra las sesiones y se puede reactivar', async () => {
    const admin = await login('admin@burgoscorp.test');
    const solicitud = await nuevaSolicitud();
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO', area_id: await areaId('MEC') });

    const baja = await api().put(`/api/v1/usuarios/${solicitud.id}`).set(conToken(admin.accessToken)).send({ activo: false });
    assert.equal(baja.status, 200);
    const intento = await api().post('/api/v1/auth/login').send({ email: solicitud.email, password: 'PruebaUsuarios2026' });
    assert.equal(intento.status, 403);

    const alta = await api().put(`/api/v1/usuarios/${solicitud.id}`).set(conToken(admin.accessToken)).send({ activo: true });
    assert.equal(alta.status, 200);
    assert.equal(alta.body.data.activo, 1);
  });

  test('elimina una solicitud, pero no una cuenta con actividad ni la propia', async () => {
    const admin = await login('admin@burgoscorp.test');
    const solicitud = await nuevaSolicitud();
    const borrada = await api().delete(`/api/v1/usuarios/${solicitud.id}`).set(conToken(admin.accessToken));
    assert.equal(borrada.status, 200);
    assert.equal(await queryOne('SELECT id FROM usuarios WHERE id = ?', [solicitud.id]), null);

    const conHistoria = await queryOne('SELECT u.id FROM usuarios u WHERE u.email = ?', ['jorge.dominguez@burgoscorp.test']);
    const res = await api().delete(`/api/v1/usuarios/${conHistoria.id}`).set(conToken(admin.accessToken));
    assert.equal(res.status, 409);
    assert.match(res.body.error.mensaje, /dala de baja/);

    const propia = await api().delete(`/api/v1/usuarios/${admin.usuario.id}`).set(conToken(admin.accessToken));
    assert.equal(propia.status, 403);
  });

  test('manda el código para crear la contraseña sin mostrarlo al admin', async () => {
    const admin = await login('admin@burgoscorp.test');
    const solicitud = await nuevaSolicitud();
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO', area_id: await areaId('MEC') });

    const antes = bandejaDePrueba.length;
    const res = await api().post(`/api/v1/usuarios/${solicitud.id}/restablecer-password`).set(conToken(admin.accessToken));
    assert.equal(res.status, 200);
    const mail = bandejaDePrueba.slice(antes).find((m) => m.para === solicitud.email);
    assert.ok(mail, 'tiene que llegarle el email con el código');
    const codigo = /\b(\d{6})\b/.exec(mail.texto)[1];
    assert.ok(!JSON.stringify(res.body).includes(codigo), 'el código no viaja en la respuesta al admin');
  });

  test('crear un usuario le arma el legajo; después se le cambia de área y habilidades', async () => {
    const admin = await login('admin@burgoscorp.test');
    const email = `nuevo.${Date.now()}@correo.test`;
    const sinArea = await api().post('/api/v1/usuarios').set(conToken(admin.accessToken))
      .send({ email, nombre: 'Nora', apellido: 'Nueva', rol: 'EMPLEADO' });
    assert.equal(sinArea.status, 400, 'un empleado necesita área');

    const creado = await api().post('/api/v1/usuarios').set(conToken(admin.accessToken)).send({
      email, nombre: 'Nora', apellido: 'Nueva', rol: 'EMPLEADO', area_id: await areaId('SOL'),
      habilidades: [{ habilidad_id: await habilidadId('SOLDADURA_MIG'), nivel: 'avanzado' }],
    });
    assert.equal(creado.status, 201, JSON.stringify(creado.body));
    assert.equal(creado.body.data.area_nombre, 'Soldadura y Herrería');
    assert.match(creado.body.data.legajo, /^L\d+$/);

    const puestoCal = await queryOne("SELECT p.id FROM puestos p JOIN areas a ON a.id = p.area_id WHERE a.codigo = 'CAL' LIMIT 1");
    const puestoAjeno = await queryOne("SELECT p.id FROM puestos p JOIN areas a ON a.id = p.area_id WHERE a.codigo = 'MEC' LIMIT 1");
    const malPuesto = await api().put(`/api/v1/usuarios/${creado.body.data.id}/legajo`).set(conToken(admin.accessToken))
      .send({ area_id: await areaId('CAL'), puesto_id: puestoAjeno.id });
    assert.equal(malPuesto.status, 400, 'el puesto tiene que ser del área');

    const cambio = await api().put(`/api/v1/usuarios/${creado.body.data.id}/legajo`).set(conToken(admin.accessToken)).send({
      area_id: await areaId('CAL'), puesto_id: puestoCal.id,
      habilidades: [{ habilidad_id: await habilidadId('METROLOGIA'), nivel: 'intermedio' }],
    });
    assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
    assert.equal(cambio.body.data.area_nombre, 'Calidad');
    assert.equal(cambio.body.data.legajo, creado.body.data.legajo, 'mismo legajo, otra área');
    const ficha = await api().get(`/api/v1/usuarios/${creado.body.data.id}`).set(conToken(admin.accessToken));
    assert.deepEqual(ficha.body.data.habilidades.map((h) => h.nombre), ['Metrología e inspección dimensional']);
  });

  test('personal: el admin ve toda la empresa, un jefe solo su área y un empleado no entra', async () => {
    const admin = await login('admin@burgoscorp.test');
    const todo = await api().get('/api/v1/personal/resumen').set(conToken(admin.accessToken));
    assert.equal(todo.status, 200, JSON.stringify(todo.body));
    assert.ok(todo.body.data.totales.personal >= 30);
    assert.ok(todo.body.data.areas.length >= 11);
    assert.ok(todo.body.data.areas.every((a) => a.jefe_nombre), 'cada área tiene jefe');

    const jefe = await login('jorge.dominguez@burgoscorp.test');
    const suArea = await api().get('/api/v1/personal/resumen').set(conToken(jefe.accessToken));
    assert.equal(suArea.status, 200);
    assert.deepEqual(suArea.body.data.areas.map((a) => a.codigo), ['MEC']);
    assert.deepEqual(suArea.body.data.cuentas_sin_area, []);

    const empleado = await login('ramon.gimenez@burgoscorp.test');
    assert.equal((await api().get('/api/v1/personal/resumen').set(conToken(empleado.accessToken))).status, 403);
  });

  test('un jefe no administra usuarios', async () => {
    const jefe = await login('jorge.dominguez@burgoscorp.test');
    const res = await api().get('/api/v1/usuarios').set(conToken(jefe.accessToken));
    assert.equal(res.status, 403);
    const borrar = await api().delete('/api/v1/usuarios/1').set(conToken(jefe.accessToken));
    assert.equal(borrar.status, 403);
  });
});
