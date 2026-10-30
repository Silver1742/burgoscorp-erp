// Tareas que crea el administrador: elige el área (o la sugiere el sistema), se crea una tarea por
// área y la asigna el jefe de cada área, no el administrador.
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
  marcelo: 'marcelo.ibanez@burgoscorp.test',  // jefe de Soldadura
  ramon: 'ramon.gimenez@burgoscorp.test',     // tornero de Mecanizado
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const area = async (codigo) => (await query('SELECT id FROM areas WHERE codigo = ?', [codigo]))[0].id;
const avisos = async (usuarioId, tareaId) => (await query(
  "SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND tipo = 'tarea_para_asignar' AND entidad_id = ?", [usuarioId, tareaId]))[0].n;

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
});
after(() => pool.end());

describe('tareas del administrador', () => {
  test('sin área ni máquina, pide elegir el área (el admin no tiene área propia)', async () => {
    const r = await api().post('/api/v1/tareas').set(como('admin')).send({ titulo: 'Ordenar el depósito' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.detalles[0].campo, 'body.area_ids');
    assert.equal(r.body.error.detalles[0].mensaje, 'Elegí a qué área va la tarea');
  });

  test('sugiere el área de la máquina, o la que tiene gente con la habilidad', async () => {
    const [cnc] = await query("SELECT id FROM centros_trabajo WHERE codigo = 'TOR-01'");
    const conMaquina = await api().get('/api/v1/tareas/destinos').query({ centro_trabajo_id: cnc.id }).set(como('admin'));
    assert.equal(conMaquina.status, 200);
    assert.deepEqual(conMaquina.body.data.sugeridas, [await area('MEC')]);
    assert.match(conMaquina.body.data.motivo, /TOR-01 es de Mecanizado/);

    const [mig] = await query("SELECT id FROM habilidades WHERE codigo = 'SOLDADURA_MIG'");
    const conHabilidad = await api().get('/api/v1/tareas/destinos').query({ habilidad_requerida_id: mig.id }).set(como('admin'));
    const idSol = await area('SOL');
    assert.deepEqual(conHabilidad.body.data.sugeridas, [idSol]);
    const sol = conHabilidad.body.data.areas.find((a) => a.id === idSol);
    assert.ok(sol.pueden >= 1 && sol.jefe, 'muestra cuántos pueden hacerla y quién la asigna');

    const jefe = await api().get('/api/v1/tareas/destinos').set(como('jorge'));
    assert.equal(jefe.status, 403, 'un jefe crea solo en su área: no elige destinos');
  });

  test('una tarea por área elegida; cada jefe recibe el aviso y es quien la asigna', async () => {
    const mec = await area('MEC');
    const sol = await area('SOL');
    const r = await api().post('/api/v1/tareas').set(como('admin')).send({ titulo: 'Orden y limpieza 5S', prioridad: 'alta', area_ids: [mec, sol] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.creadas.length, 2);
    const tMec = r.body.data.creadas.find((c) => c.area_id === mec);
    const tSol = r.body.data.creadas.find((c) => c.area_id === sol);
    assert.match(tMec.jefe, /Jorge/);
    assert.equal(await avisos(s.jorge.usuario.id, tMec.id), 1, 'le llega a Jorge la de Mecanizado');
    assert.equal(await avisos(s.marcelo.usuario.id, tSol.id), 1, 'le llega a Marcelo la de Soldadura');
    assert.equal(await avisos(s.jorge.usuario.id, tSol.id), 0, 'a cada uno solo la de su área');

    const vistaAdmin = await api().get(`/api/v1/tareas/${tMec.id}`).set(como('admin'));
    assert.equal(vistaAdmin.body.data.puede_asignar, false);
    assert.match(vistaAdmin.body.data.jefe_area, /Jorge/);
    const porAdmin = await api().post(`/api/v1/tareas/${tMec.id}/asignaciones`).set(como('admin')).send({ empleado_id: s.ramon.usuario.empleadoId });
    assert.equal(porAdmin.status, 403, 'el administrador no asigna si el área tiene jefe');
    assert.match(porAdmin.body.error.mensaje, /La asigna Jorge/);

    const pendientes = await api().get('/api/v1/tareas').query({ sin_asignar: 1 }).set(como('jorge'));
    assert.ok(pendientes.body.data.some((t) => t.id === tMec.id), 'aparece en "Para asignar" del jefe');
    const porJefe = await api().post(`/api/v1/tareas/${tMec.id}/asignaciones`).set(como('jorge')).send({ empleado_id: s.ramon.usuario.empleadoId });
    assert.equal(porJefe.status, 201);
    const despues = await api().get('/api/v1/tareas').query({ sin_asignar: 1 }).set(como('jorge'));
    assert.ok(!despues.body.data.some((t) => t.id === tMec.id));
  });

  test('con máquina va al área de la máquina; no se puede mandar a otra', async () => {
    const [tor] = await query("SELECT id FROM centros_trabajo WHERE codigo = 'TOR-01'");
    const ok = await api().post('/api/v1/tareas').set(como('admin')).send({ titulo: 'Cambiar el aceite', centro_trabajo_id: tor.id });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.area_id, await area('MEC'));
    const mal = await api().post('/api/v1/tareas').set(como('admin')).send({ titulo: 'Cambiar el aceite', centro_trabajo_id: tor.id, area_ids: [await area('SOL')] });
    assert.equal(mal.status, 400);
    assert.equal(mal.body.error.detalles[0].campo, 'body.centro_trabajo_id');
  });

  test('si el área no tiene jefe, la asigna el administrador', async () => {
    const codigo = `T${Date.now() % 1e8}`;
    const a = await query("INSERT INTO areas (codigo, nombre) VALUES (?, 'Área sin jefe (prueba)')", [codigo]);
    const e = await query(`INSERT INTO empleados (legajo, nombre, apellido, area_id, fecha_ingreso)
      VALUES (?, 'Sin', 'Jefe', ?, CURDATE())`, [`X${Date.now() % 1e8}`, a.insertId]);
    try {
      const r = await api().post('/api/v1/tareas').set(como('admin')).send({ titulo: 'Tarea suelta', area_ids: [a.insertId] });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.creadas[0].jefe, null);
      assert.equal(r.body.data.puede_asignar, true);
      const asig = await api().post(`/api/v1/tareas/${r.body.data.id}/asignaciones`).set(como('admin')).send({ empleado_id: e.insertId });
      assert.equal(asig.status, 201);
    } finally {
      await query('UPDATE empleados SET estado = ? WHERE id = ?', ['baja', e.insertId]);
      await query('UPDATE areas SET activo = 0 WHERE id = ?', [a.insertId]);
    }
  });

  test('un jefe sigue creando en su área y no puede mandar a otra', async () => {
    const propia = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: 'Afilar herramientas' });
    assert.equal(propia.status, 201);
    assert.equal(propia.body.data.puede_asignar, true);
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'tarea_para_asignar' AND entidad_id = ?", [propia.body.data.id]);
    assert.equal(n, 0, 'si la crea el jefe no se avisa a nadie: la asigna él');
    const ajena = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: 'Otra', area_ids: [await area('SOL')] });
    assert.equal(ajena.status, 403);
  });

  test('los errores de validación dicen qué campo y en castellano', async () => {
    const r = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: '', horas_estimadas: -2, prioridad: 'altisima' });
    assert.equal(r.status, 400);
    const m = Object.fromEntries(r.body.error.detalles.map((d) => [d.campo, d.mensaje]));
    assert.equal(m['body.titulo'], 'Campo obligatorio');
    assert.match(m['body.horas_estimadas'], /^Tiene que ser mayor/);
    assert.match(m['body.prioridad'], /^Opción inválida/);
  });
});
