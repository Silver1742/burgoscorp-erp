// Tests de Producción y Tareas: órdenes de trabajo, asignación por habilidad y máquina,
// circuito de estados, horas y revisión.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  jorge: 'jorge.dominguez@burgoscorp.test',     // jefe de Mecanizado
  marcelo: 'marcelo.ibanez@burgoscorp.test',    // jefe de Soldadura (MIG certificado)
  claudio: 'claudio.ortiz@burgoscorp.test',     // soldador MIG certificado
  walter: 'walter.medina@burgoscorp.test',      // soldador con la certificación MIG vencida
  nestor: 'nestor.romero@burgoscorp.test',      // herrero, sin MIG
  ramon: 'ramon.gimenez@burgoscorp.test',       // tornero (Mecanizado)
  matias: 'matias.peralta@burgoscorp.test',     // operador CNC
  diego: 'diego.acosta@burgoscorp.test',        // jefe Comercial
  ricardo: 'ricardo.ferreyra@burgoscorp.test',  // gerencia
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const empleado = (q) => s[q].usuario.empleadoId;
let otId;
let opSoldadura;
let opCnc;

before(async () => {
  // Que nadie de las pruebas quede con horas abiertas de corridas anteriores.
  await query(`UPDATE registros_horas r JOIN usuarios u ON u.empleado_id = r.empleado_id
               SET r.fin_at = UTC_TIMESTAMP(), r.horas = 0 WHERE r.fin_at IS NULL AND u.email IN (?, ?)`, [EMAILS.claudio, EMAILS.marcelo]);
  await query("UPDATE centros_trabajo SET estado = 'mantenimiento' WHERE codigo = 'CNC-02'");
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
});
after(() => pool.end());

const maquina = async (codigo) => (await query('SELECT id FROM centros_trabajo WHERE codigo = ?', [codigo]))[0].id;

describe('órdenes de trabajo', () => {
  test('un jefe de producción crea una OT con numeración SAP', async () => {
    const r = await api().post('/api/v1/ordenes-trabajo').set(como('marcelo')).send({
      titulo: 'Baranda de acero para escalera', tipo_trabajo: 'fabricacion', prioridad: 'alta', cantidad: 2,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^OT-\d{4}-\d{4}$/);
    assert.equal(r.body.data.estado, 'planificada');
    assert.equal(r.body.data.area_nombre, 'Soldadura y Herrería');
    otId = r.body.data.id;
  });

  test('un área que no produce no puede crear OT y las fechas se validan', async () => {
    assert.equal((await api().post('/api/v1/ordenes-trabajo').set(como('diego')).send({ titulo: 'X', tipo_trabajo: 'reparacion' })).status, 403);
    const fechas = await api().post('/api/v1/ordenes-trabajo').set(como('marcelo'))
      .send({ titulo: 'X', tipo_trabajo: 'reparacion', fecha_inicio_plan: '2026-12-10', fecha_entrega_plan: '2026-12-01' });
    assert.equal(fechas.status, 400);
  });

  test('cada operación toma el área y la habilidad de su máquina', async () => {
    const r = await api().post(`/api/v1/ordenes-trabajo/${otId}/operaciones`).set(como('marcelo'))
      .send({ titulo: 'Soldadura MIG de la baranda', centro_trabajo_id: await maquina('SOL-01'), horas_estimadas: 6, checklist: ['Punteado', 'Cordones'] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.secuencia, 10);
    assert.equal(r.body.data.habilidad_nombre, 'Soldadura MIG/MAG');
    assert.equal(r.body.data.checklist.length, 2);
    opSoldadura = r.body.data.id;

    const cnc = await api().post(`/api/v1/ordenes-trabajo/${otId}/operaciones`).set(como('marcelo'))
      .send({ titulo: 'Fresado de soportes', centro_trabajo_id: await maquina('CNC-02') });
    assert.equal(cnc.body.data.secuencia, 20);
    assert.equal(cnc.body.data.area_nombre, 'Mecanizado');
    opCnc = cnc.body.data.id;
  });
});

describe('asignación por habilidad y máquina', () => {
  test('no se asigna sin la habilidad, con la certificación vencida ni de otra área', async () => {
    const asignar = (q) => api().post(`/api/v1/tareas/${opSoldadura}/asignaciones`).set(como('marcelo')).send({ empleado_id: empleado(q) });
    const vencida = await asignar('walter');
    assert.equal(vencida.status, 422);
    assert.match(vencida.body.error.mensaje, /certificación .* vencida/);
    const sinHabilidad = await asignar('nestor');
    assert.equal(sinHabilidad.status, 422);
    assert.match(sinHabilidad.body.error.mensaje, /no tiene la habilidad/);
    assert.equal((await asignar('ramon')).status, 422, 'otra área');
    assert.equal((await asignar('claudio')).status, 201);
    assert.equal((await asignar('claudio')).status, 409, 'ya asignado');
  });

  test('los candidatos son solo los aptos', async () => {
    const r = await api().get(`/api/v1/tareas/${opSoldadura}/candidatos`).set(como('marcelo'));
    const ids = r.body.data.map((e) => e.id);
    assert.ok(ids.includes(empleado('claudio')));
    assert.ok(!ids.includes(empleado('walter')));
    assert.ok(!ids.includes(empleado('nestor')));
  });

  test('no se asigna una operación de una máquina en mantenimiento', async () => {
    const r = await api().post(`/api/v1/tareas/${opCnc}/asignaciones`).set(como('jorge')).send({ empleado_id: empleado('matias') });
    assert.equal(r.status, 422);
    assert.match(r.body.error.mensaje, /mantenimiento/);
  });

  test('el empleado recibe el aviso y gerencia no puede asignar', async () => {
    const n = await api().get('/api/v1/notificaciones').set(como('claudio'));
    assert.ok(n.body.data.some((x) => x.tipo === 'tarea_asignada' && x.entidad_id === opSoldadura));
    const g = await api().post(`/api/v1/tareas/${opSoldadura}/asignaciones`).set(como('ricardo')).send({ empleado_id: empleado('claudio') });
    assert.equal(g.status, 403);
  });
});

describe('avance de la tarea', () => {
  test('solo el asignado la ve en "mis tareas" y puede iniciarla', async () => {
    const mias = await api().get('/api/v1/tareas?mias=1&abiertas=1').set(como('claudio'));
    assert.ok(mias.body.data.some((t) => t.id === opSoldadura));
    assert.equal((await api().post(`/api/v1/tareas/${opSoldadura}/iniciar`).set(como('ramon'))).status, 404, 'no la ve');
    // Un empleado ve solo sus tareas (alcance propio): para Néstor, aunque sea de su área, no existe.
    assert.equal((await api().post(`/api/v1/tareas/${opSoldadura}/iniciar`).set(como('nestor'))).status, 404);
  });

  test('iniciar pone la OT en proceso y no deja tener dos tareas en curso', async () => {
    const r = await api().post(`/api/v1/tareas/${opSoldadura}/iniciar`).set(como('claudio'));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.estado, 'en_curso');
    const ot = await api().get(`/api/v1/ordenes-trabajo/${otId}`).set(como('marcelo'));
    assert.equal(ot.body.data.estado, 'en_proceso');

    const otra = await api().post(`/api/v1/ordenes-trabajo/${otId}/operaciones`).set(como('marcelo'))
      .send({ titulo: 'Repaso de soldaduras', centro_trabajo_id: await maquina('SOL-02') });
    await api().post(`/api/v1/tareas/${otra.body.data.id}/asignaciones`).set(como('marcelo')).send({ empleado_id: empleado('claudio') });
    const doble = await api().post(`/api/v1/tareas/${otra.body.data.id}/iniciar`).set(como('claudio'));
    assert.equal(doble.status, 409);
    assert.match(doble.body.error.mensaje, /Pausala/);
  });

  test('pausar cierra las horas y no se termina con la lista de control pendiente', async () => {
    const p = await api().post(`/api/v1/tareas/${opSoldadura}/pausar`).set(como('claudio'));
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(p.body.data.estado, 'pausada');
    assert.ok(p.body.data.horas.every((h) => h.fin_at), 'sin registros abiertos');

    const t = await api().post(`/api/v1/tareas/${opSoldadura}/terminar`).set(como('claudio')).send({});
    assert.equal(t.status, 422);
    for (const item of p.body.data.checklist) {
      await api().put(`/api/v1/tareas/${opSoldadura}/checklist/${item.id}`).set(como('claudio')).send({ hecho: true });
    }
    const ok = await api().post(`/api/v1/tareas/${opSoldadura}/terminar`).set(como('claudio')).send({ comentario: 'Lista' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.estado, 'en_revision');
  });

  test('comentarios: los asignados y el jefe pueden comentar', async () => {
    const r = await api().post(`/api/v1/tareas/${opSoldadura}/comentarios`).set(como('claudio')).send({ texto: 'Usé alambre 1,0 mm' });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.comentarios.at(-1).texto, 'Usé alambre 1,0 mm');
  });
});

describe('revisión del jefe', () => {
  test('rechazar exige motivo; la tarea vuelve al asignado', async () => {
    assert.equal((await api().post(`/api/v1/tareas/${opSoldadura}/rechazar`).set(como('marcelo')).send({})).status, 400);
    const r = await api().post(`/api/v1/tareas/${opSoldadura}/rechazar`).set(como('marcelo')).send({ comentario: 'Falta un cordón en la esquina' });
    assert.equal(r.body.data.estado, 'rechazada');
    await api().post(`/api/v1/tareas/${opSoldadura}/iniciar`).set(como('claudio'));
    await api().post(`/api/v1/tareas/${opSoldadura}/terminar`).set(como('claudio')).send({});
  });

  test('el empleado no aprueba; el jefe sí; y nadie aprueba lo que hizo', async () => {
    assert.equal((await api().post(`/api/v1/tareas/${opSoldadura}/aprobar`).set(como('claudio')).send({})).status, 403);
    const ok = await api().post(`/api/v1/tareas/${opSoldadura}/aprobar`).set(como('marcelo')).send({ comentario: 'Bien' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.estado, 'aprobada');
    assert.ok(ok.body.data.historial.length >= 6, 'queda el historial de cada cambio');

    // Marcelo tiene MIG vigente: si se asigna a sí mismo, no puede aprobarse.
    const propia = await api().post(`/api/v1/ordenes-trabajo/${otId}/operaciones`).set(como('marcelo'))
      .send({ titulo: 'Retoque final', centro_trabajo_id: await maquina('SOL-01') });
    const idPropia = propia.body.data.id;
    await api().post(`/api/v1/tareas/${idPropia}/asignaciones`).set(como('marcelo')).send({ empleado_id: empleado('marcelo') });
    await api().post(`/api/v1/tareas/${idPropia}/iniciar`).set(como('marcelo'));
    await api().post(`/api/v1/tareas/${idPropia}/terminar`).set(como('marcelo')).send({});
    const auto = await api().post(`/api/v1/tareas/${idPropia}/aprobar`).set(como('marcelo')).send({});
    assert.equal(auto.status, 403);
  });

  test('la OT muestra el avance y no pasa a calidad con operaciones pendientes', async () => {
    const ot = await api().get(`/api/v1/ordenes-trabajo/${otId}`).set(como('marcelo'));
    assert.ok(ot.body.data.operaciones_aprobadas >= 1);
    assert.ok(ot.body.data.operaciones > ot.body.data.operaciones_aprobadas);
    const r = await api().put(`/api/v1/ordenes-trabajo/${otId}`).set(como('marcelo')).send({ estado: 'control_calidad' });
    assert.equal(r.status, 422);
    const mal = await api().put(`/api/v1/ordenes-trabajo/${otId}`).set(como('marcelo')).send({ estado: 'entregada' });
    assert.equal(mal.status, 422, 'no se salta estados');
  });

  test('alcance: un tornero no ve las OT de Soldadura en las que no trabaja', async () => {
    const r = await api().get('/api/v1/ordenes-trabajo?limite=100').set(como('ramon'));
    assert.ok(!r.body.data.some((o) => o.id === otId));
  });
});
