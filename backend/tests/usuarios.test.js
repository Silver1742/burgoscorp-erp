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
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO' });

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
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO' });

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
    await api().post(`/api/v1/usuarios/${solicitud.id}/habilitar`).set(conToken(admin.accessToken)).send({ rol: 'EMPLEADO' });

    const antes = bandejaDePrueba.length;
    const res = await api().post(`/api/v1/usuarios/${solicitud.id}/restablecer-password`).set(conToken(admin.accessToken));
    assert.equal(res.status, 200);
    const mail = bandejaDePrueba.slice(antes).find((m) => m.para === solicitud.email);
    assert.ok(mail, 'tiene que llegarle el email con el código');
    const codigo = /\b(\d{6})\b/.exec(mail.texto)[1];
    assert.ok(!JSON.stringify(res.body).includes(codigo), 'el código no viaja en la respuesta al admin');
  });

  test('un jefe no administra usuarios', async () => {
    const jefe = await login('jorge.dominguez@burgoscorp.test');
    const res = await api().get('/api/v1/usuarios').set(conToken(jefe.accessToken));
    assert.equal(res.status, 403);
    const borrar = await api().delete('/api/v1/usuarios/1').set(conToken(jefe.accessToken));
    assert.equal(borrar.status, 403);
  });
});
