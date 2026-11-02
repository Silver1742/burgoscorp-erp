// Inicio: tablón de avisos, pendientes y crear una tarea eligiendo a quién asignarla.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  admin: 'admin@burgoscorp.test',
  jorge: 'jorge.dominguez@burgoscorp.test',   // jefe de Mecanizado
  ramon: 'ramon.gimenez@burgoscorp.test',     // tornero de Mecanizado
  matias: 'matias.peralta@burgoscorp.test',   // operador CNC de Mecanizado
  claudio: 'claudio.ortiz@burgoscorp.test',   // soldador (otra área)
  ricardo: 'ricardo.ferreyra@burgoscorp.test', // gerencia
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const sello = Date.now() % 1e7;

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
});
after(() => pool.end());

describe('tablón de avisos', () => {
  let general;
  let deMecanizado;

  test('el administrador publica para toda la empresa y el jefe para su área', async () => {
    const a = await api().post('/api/v1/tablon').set(como('admin')).send({ titulo: `Feriado ${sello}`, texto: 'El lunes no se trabaja.', fijado: true });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    general = a.body.data.id;
    const j = await api().post('/api/v1/tablon').set(como('jorge')).send({ titulo: `Orden en el pañol ${sello}`, texto: 'Devuelvan las herramientas.', importante: true });
    assert.equal(j.status, 201, JSON.stringify(j.body));
    deMecanizado = j.body.data.id;
    const [aviso] = await query('SELECT area_id FROM avisos_tablon WHERE id = ?', [deMecanizado]);
    assert.equal(aviso.area_id, s.jorge.usuario.area?.id ?? aviso.area_id, 'queda en el área del jefe');
  });

  test('cada uno ve los generales y los de su área; los importantes llegan como aviso', async () => {
    const ramon = await api().get('/api/v1/tablon').set(como('ramon'));
    const ids = ramon.body.data.map((x) => x.id);
    assert.ok(ids.includes(general) && ids.includes(deMecanizado));
    assert.equal(ramon.body.data[0].fijado, true, 'los fijados van primero');
    assert.equal(ramon.body.meta.puede_publicar, false);
    const claudio = await api().get('/api/v1/tablon').set(como('claudio'));
    assert.ok(claudio.body.data.some((x) => x.id === general));
    assert.ok(!claudio.body.data.some((x) => x.id === deMecanizado), 'Soldadura no ve el aviso de Mecanizado');
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND tipo = 'aviso_tablon' AND entidad_id = ?", [s.ramon.usuario.id, deMecanizado]);
    assert.equal(Number(n), 1);
  });

  test('un empleado no publica, un jefe no publica en otra área ni borra lo ajeno', async () => {
    assert.equal((await api().post('/api/v1/tablon').set(como('ramon')).send({ titulo: 'x', texto: 'y' })).status, 403);
    const [{ id: sol }] = await query("SELECT id FROM areas WHERE codigo = 'SOL'");
    assert.equal((await api().post('/api/v1/tablon').set(como('jorge')).send({ titulo: 'x', texto: 'y', area_id: sol })).status, 403);
    assert.equal((await api().delete(`/api/v1/tablon/${general}`).set(como('jorge'))).status, 403);
    assert.equal((await api().put(`/api/v1/tablon/${deMecanizado}`).set(como('jorge')).send({ fijado: true })).status, 200);
  });

  test('marcar como leído; los vencidos no se muestran; el autor lo borra', async () => {
    assert.equal((await api().post(`/api/v1/tablon/${deMecanizado}/leido`).set(como('ramon'))).status, 204);
    const r = await api().get('/api/v1/tablon').set(como('ramon'));
    assert.equal(r.body.data.find((x) => x.id === deMecanizado).leido, true);
    await query('UPDATE avisos_tablon SET vence_el = ? WHERE id = ?', ['2020-01-01', general]);
    assert.ok(!(await api().get('/api/v1/tablon').set(como('ramon'))).body.data.some((x) => x.id === general));
    assert.equal((await api().delete(`/api/v1/tablon/${deMecanizado}`).set(como('jorge'))).status, 204);
    assert.equal((await api().delete(`/api/v1/tablon/${general}`).set(como('admin'))).status, 204);
  });
});

describe('pendientes', () => {
  test('el jefe ve lo que espera su decisión; un empleado no tiene pendientes', async () => {
    await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: `Pendiente de asignar ${sello}` });
    const j = await api().get('/api/v1/pendientes').set(como('jorge'));
    assert.equal(j.status, 200);
    assert.ok(j.body.data.some((g) => g.tipo === 'asignar' && g.total > 0));
    const e = await api().get('/api/v1/pendientes').set(como('ramon'));
    assert.deepEqual(e.body.data, []);
    const a = await api().get('/api/v1/pendientes').set(como('admin'));
    assert.ok(a.body.data.every((g) => g.items.length <= 5));
  });
});

describe('crear una tarea y asignarla ahí mismo', () => {
  test('los candidatos salen del área, la máquina y la habilidad', async () => {
    const [tor] = await query("SELECT id FROM centros_trabajo WHERE codigo = 'TOR-01'");
    const r = await api().get('/api/v1/tareas/candidatos').query({ centro_trabajo_id: tor.id }).set(como('jorge'));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.puede_asignar, true);
    assert.ok(r.body.data.candidatos.some((c) => c.id === s.ramon.usuario.empleadoId), 'Ramón es tornero');
    const [sol] = await query("SELECT id FROM centros_trabajo WHERE codigo = 'SOL-01'");
    assert.equal((await api().get('/api/v1/tareas/candidatos').query({ centro_trabajo_id: sol.id }).set(como('jorge'))).status, 400, 'máquina de otra área');
    const admin = await api().get('/api/v1/tareas/candidatos').query({ centro_trabajo_id: tor.id }).set(como('admin'));
    assert.equal(admin.body.data.puede_asignar, false, 'el área tiene jefe: la asigna él');
    assert.match(admin.body.data.jefe, /Jorge/);
  });

  test('crear con empleado_ids la deja asignada a esas personas', async () => {
    const r = await api().post('/api/v1/tareas').set(como('jorge')).send({
      titulo: `Limpieza de tornos ${sello}`, empleado_ids: [s.ramon.usuario.empleadoId, s.matias.usuario.empleadoId],
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.asignados_detalle.length, 2);
    const mal = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: `Otra ${sello}`, empleado_ids: [s.claudio.usuario.empleadoId] });
    assert.equal(mal.status, 201, 'la tarea se crea igual');
    assert.match(mal.body.data.aviso_asignacion, /no pertenece al área/);
    assert.equal(mal.body.data.asignados_detalle.length, 0);
  });
});
