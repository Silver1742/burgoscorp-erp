// Tests de RRHH: legajos por alcance, habilidades, fichaje, licencias con aprobación y EPP.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import { hoy, sumarDias } from '../src/utils/fechas.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';

const EMAILS = {
  ramon: 'ramon.gimenez@burgoscorp.test',      // empleado, Mecanizado
  jorge: 'jorge.dominguez@burgoscorp.test',    // jefe de Mecanizado
  marcelo: 'marcelo.ibanez@burgoscorp.test',   // jefe de Soldadura
  carolina: 'carolina.mendez@burgoscorp.test', // jefa de RRHH
  lucia: 'lucia.benitez@burgoscorp.test',      // empleada de RRHH
  admin: 'admin@burgoscorp.test',
};
const s = {}; // sesiones por persona

async function login(email) {
  const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}
const como = (quien) => ({ Authorization: `Bearer ${s[quien].accessToken}` });

/** Primer día hábil a partir de `fecha` (para que las licencias de un día no caigan en fin de semana). */
function habil(fecha) {
  let f = fecha;
  while ([0, 6].includes(new Date(`${f}T00:00:00Z`).getUTCDay())) f = sumarDias(f, 1);
  return f;
}

before(async () => {
  // Los tests se pueden repetir: se limpian las licencias y fichajes de las cuentas que usan.
  await query(`DELETE l FROM solicitudes_licencia l JOIN usuarios u ON u.empleado_id = l.empleado_id
               WHERE u.email IN (?, ?)`, [EMAILS.ramon, EMAILS.jorge]);
  await query(`DELETE a FROM asistencias a JOIN usuarios u ON u.empleado_id = a.empleado_id WHERE u.email = ?`, [EMAILS.ramon]);
  for (const [quien, email] of Object.entries(EMAILS)) s[quien] = await login(email);
});
after(() => pool.end());

describe('legajos', () => {
  test('cada rol ve los legajos de su alcance', async () => {
    const r1 = await api().get('/api/v1/empleados?limite=100').set(como('ramon'));
    assert.equal(r1.body.meta.total, 1, 'el empleado ve solo su legajo');
    assert.equal(r1.body.data[0].id, s.ramon.usuario.empleadoId);

    const r2 = await api().get('/api/v1/empleados?limite=100').set(como('jorge'));
    assert.ok(r2.body.meta.total > 1);
    assert.ok(r2.body.data.every((e) => e.area_nombre === 'Mecanizado'), 'el jefe ve solo su área');

    const r3 = await api().get('/api/v1/empleados?limite=100').set(como('carolina'));
    assert.ok(r3.body.meta.total >= 30, 'RRHH ve toda la empresa');
  });

  test('un empleado actualiza su teléfono pero no su costo ni su área', async () => {
    const id = s.ramon.usuario.empleadoId;
    const ok = await api().put(`/api/v1/empleados/${id}`).set(como('ramon')).send({ telefono: '11 5555-1234' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.telefono, '11 5555-1234');
    const costo = await api().put(`/api/v1/empleados/${id}`).set(como('ramon')).send({ costo_hora: 99999 });
    assert.equal(costo.status, 403);
    const otro = await api().put(`/api/v1/empleados/${s.jorge.usuario.empleadoId}`).set(como('ramon')).send({ telefono: '1' });
    assert.equal(otro.status, 404, 'un legajo ajeno no existe para él');
  });

  test('solo RRHH da de alta legajos, con datos válidos', async () => {
    const legajo = `L${String(Date.now()).slice(-6)}`;
    const datos = {
      legajo, nombre: 'Mirta', apellido: 'Salas', dni: String(Date.now()).slice(-8),
      area_id: s.jorge.usuario.area.id, fecha_ingreso: hoy(),
    };
    assert.equal((await api().post('/api/v1/empleados').set(como('jorge')).send(datos)).status, 403);
    const mal = await api().post('/api/v1/empleados').set(como('carolina')).send({ ...datos, dni: '12.345.678' });
    assert.equal(mal.status, 400);
    const ok = await api().post('/api/v1/empleados').set(como('carolina')).send(datos);
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.data.area_nombre, 'Mecanizado');
    assert.equal((await api().delete(`/api/v1/empleados/${ok.body.data.id}`).set(como('admin'))).status, 404, 'los legajos no se borran');
  });

  test('habilidades: certificación obligatoria y aviso de vencida', async () => {
    const [hab] = await query("SELECT id FROM habilidades WHERE codigo = 'SOLDADURA_MIG'");
    const id = s.ramon.usuario.empleadoId;
    const sinFecha = await api().put(`/api/v1/empleados/${id}/habilidades/${hab.id}`).set(como('carolina')).send({ nivel: 'basico' });
    assert.equal(sinFecha.status, 400);
    const vencida = await api().put(`/api/v1/empleados/${id}/habilidades/${hab.id}`).set(como('carolina'))
      .send({ nivel: 'basico', certificado_vence: sumarDias(hoy(), -1) });
    assert.equal(vencida.status, 200);
    const lista = await api().get(`/api/v1/empleados/${id}/habilidades`).set(como('ramon'));
    assert.equal(lista.body.data.find((h) => h.codigo === 'SOLDADURA_MIG').vencida, 1);
    assert.equal((await api().put(`/api/v1/empleados/${id}/habilidades/${hab.id}`).set(como('jorge')).send({ nivel: 'avanzado', certificado_vence: hoy() })).status, 403);
    assert.equal((await api().delete(`/api/v1/empleados/${id}/habilidades/${hab.id}`).set(como('carolina'))).status, 204);
  });
});

describe('fichaje', () => {
  test('entrada y salida, sin duplicados', async () => {
    const e1 = await api().post('/api/v1/asistencias/entrada').set(como('ramon'));
    assert.equal(e1.status, 201);
    assert.equal(e1.body.data.dentro, true);
    assert.equal((await api().post('/api/v1/asistencias/entrada').set(como('ramon'))).status, 409);
    const sal = await api().post('/api/v1/asistencias/salida').set(como('ramon'));
    assert.equal(sal.status, 200);
    assert.equal(sal.body.data.dentro, false);
    assert.equal((await api().post('/api/v1/asistencias/salida').set(como('ramon'))).status, 409);
  });

  test('sin legajo no se puede fichar', async () => {
    assert.equal((await api().post('/api/v1/asistencias/entrada').set(como('admin'))).status, 422);
  });

  test('el jefe ve los fichajes de su equipo; solo RRHH corrige', async () => {
    const lista = await api().get(`/api/v1/asistencias?empleado_id=${s.ramon.usuario.empleadoId}`).set(como('jorge'));
    assert.equal(lista.status, 200);
    assert.ok(lista.body.meta.total >= 1);
    const id = lista.body.data[0].id;
    const cuerpo = { observacion: 'Se olvidó de fichar la salida' };
    assert.equal((await api().put(`/api/v1/asistencias/${id}`).set(como('jorge')).send(cuerpo)).status, 403);
    const ok = await api().put(`/api/v1/asistencias/${id}`).set(como('carolina')).send(cuerpo);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.origen, 'manual');
  });
});

describe('licencias: circuito de aprobación', () => {
  const desde = sumarDias(hoy(), 20);
  const hasta = sumarDias(hoy(), 26);
  let idRamon;

  test('el empleado pide vacaciones y se calculan los días hábiles', async () => {
    const res = await api().post('/api/v1/licencias').set(como('ramon')).send({ tipo: 'vacaciones', fecha_desde: desde, fecha_hasta: hasta });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.estado, 'pendiente');
    assert.equal(res.body.data.dias, 5, '7 días corridos = 5 hábiles');
    idRamon = res.body.data.id;
    const otra = await api().post('/api/v1/licencias').set(como('ramon')).send({ tipo: 'personal', fecha_desde: habil(sumarDias(desde, 2)), fecha_hasta: hasta });
    assert.equal(otra.status, 409, 'no se superponen');
    const pasada = await api().post('/api/v1/licencias').set(como('ramon')).send({ tipo: 'vacaciones', fecha_desde: sumarDias(hoy(), -3), fecha_hasta: hoy() });
    assert.equal(pasada.status, 400);
  });

  test('primero el jefe del área, después RRHH', async () => {
    assert.equal((await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('ramon')).send({})).status, 403, 'el empleado no aprueba');
    assert.equal((await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('marcelo')).send({})).status, 403, 'un jefe de otra área no aprueba');
    assert.equal((await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('carolina')).send({})).status, 422, 'RRHH espera al jefe');

    const pendientesJorge = await api().get('/api/v1/licencias?para_aprobar=1').set(como('jorge'));
    assert.ok(pendientesJorge.body.data.some((l) => l.id === idRamon));

    const j = await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('jorge')).send({ comentario: 'Ok, cubre Hernán' });
    assert.equal(j.status, 200);
    assert.equal(j.body.data.estado, 'aprobada_jefe');
    assert.equal((await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('jorge')).send({})).status, 403, 'el jefe no aprueba dos veces');

    const r = await api().post(`/api/v1/licencias/${idRamon}/aprobar`).set(como('carolina')).send({});
    assert.equal(r.status, 200);
    assert.equal(r.body.data.estado, 'aprobada');
    assert.equal((await api().post(`/api/v1/licencias/${idRamon}/cancelar`).set(como('ramon'))).status, 409, 'ya resuelta');
  });

  test('el empleado recibe la notificación', async () => {
    const res = await api().get('/api/v1/notificaciones').set(como('ramon'));
    assert.ok(res.body.data.some((n) => n.tipo === 'licencia_aprobada' && n.entidad_id === idRamon));
    assert.ok(res.body.meta.sinLeer >= 1);
    assert.equal((await api().post('/api/v1/notificaciones/leidas').set(como('ramon'))).status, 204);
  });

  test('la licencia de un jefe la aprueba RRHH directamente; rechazar exige motivo', async () => {
    const pedido = await api().post('/api/v1/licencias').set(como('jorge'))
      .send({ tipo: 'estudio', fecha_desde: habil(sumarDias(hoy(), 40)), fecha_hasta: habil(sumarDias(hoy(), 40)) });
    assert.equal(pedido.status, 201);
    const id = pedido.body.data.id;
    const bandeja = await api().get('/api/v1/licencias?para_aprobar=1').set(como('carolina'));
    assert.ok(bandeja.body.data.some((l) => l.id === id));
    assert.equal((await api().post(`/api/v1/licencias/${id}/rechazar`).set(como('carolina')).send({})).status, 400);
    const ok = await api().post(`/api/v1/licencias/${id}/aprobar`).set(como('carolina')).send({});
    assert.equal(ok.body.data.estado, 'aprobada');
  });

  test('cancelar una pendiente propia', async () => {
    const pedido = await api().post('/api/v1/licencias').set(como('ramon'))
      .send({ tipo: 'personal', fecha_desde: habil(sumarDias(hoy(), 60)), fecha_hasta: habil(sumarDias(hoy(), 60)) });
    const id = pedido.body.data.id;
    assert.equal((await api().post(`/api/v1/licencias/${id}/cancelar`).set(como('jorge'))).status, 404, 'no es suya');
    const ok = await api().post(`/api/v1/licencias/${id}/cancelar`).set(como('ramon'));
    assert.equal(ok.body.data.estado, 'cancelada');
  });

  test('el empleado ve solo sus licencias', async () => {
    const res = await api().get('/api/v1/licencias').set(como('ramon'));
    assert.ok(res.body.data.every((l) => l.empleado_id === s.ramon.usuario.empleadoId));
  });
});

describe('EPP y organigrama', () => {
  test('solo RRHH registra entregas de EPP', async () => {
    const datos = { empleado_id: s.ramon.usuario.empleadoId, elemento: 'Careta de soldar fotosensible', fecha_entrega: hoy() };
    assert.equal((await api().post('/api/v1/epp-entregas').set(como('lucia')).send(datos)).status, 403);
    const ok = await api().post('/api/v1/epp-entregas').set(como('carolina')).send(datos);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.entregado_por, s.carolina.usuario.id);
    const propias = await api().get('/api/v1/epp-entregas').set(como('ramon'));
    assert.ok(propias.body.data.every((e) => e.empleado_id === s.ramon.usuario.empleadoId));
  });

  test('organigrama con jefe y cantidad de personas por área', async () => {
    const res = await api().get('/api/v1/organigrama').set(como('ramon'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].codigo, 'DIR');
    const mec = res.body.data.find((a) => a.codigo === 'MEC');
    assert.equal(mec.jefe_nombre, 'Jorge Domínguez');
    assert.ok(mec.empleados >= 5);
  });
});
