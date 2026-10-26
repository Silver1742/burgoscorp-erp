// Tests de Mantenimiento: reporte de falla que detiene la máquina, quién ve y avanza cada orden,
// repuestos que salen del stock, cierre que la vuelve a poner operativa y planes preventivos.
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
  oscar: 'oscar.figueroa@burgoscorp.test',    // jefe de Mantenimiento
  daniel: 'daniel.correa@burgoscorp.test',    // técnico de Mantenimiento
  matias: 'matias.peralta@burgoscorp.test',   // operador CNC (reporta la falla)
  jorge: 'jorge.dominguez@burgoscorp.test',   // jefe de Mecanizado (la máquina es de su área)
  marcelo: 'marcelo.ibanez@burgoscorp.test',  // jefe de Soldadura (otra área)
  claudio: 'claudio.ortiz@burgoscorp.test',   // soldador
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]);

let plegadora;
let omId;

const estadoMaquina = async () => (await query('SELECT estado FROM centros_trabajo WHERE id = ?', [plegadora]))[0].estado;
const om = (q, id = omId) => api().get(`/api/v1/ordenes-mantenimiento/${id}`).set(como(q));
const estado = (q, cuerpo, id = omId) => api().post(`/api/v1/ordenes-mantenimiento/${id}/estado`).set(como(q)).send(cuerpo);

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
  plegadora = (await query("SELECT id FROM centros_trabajo WHERE codigo = 'PLE-01'"))[0].id;
  await query("UPDATE ordenes_mantenimiento SET estado = 'cancelada' WHERE centro_trabajo_id = ? AND estado IN ('abierta','en_curso','esperando_repuesto')", [plegadora]);
  await query("UPDATE centros_trabajo SET estado = 'operativo' WHERE id = ?", [plegadora]);
  // Cada corrida usa aceite del stock: se repone para que la prueba no dependa de las anteriores.
  await query(`UPDATE stock s JOIN productos p ON p.id = s.producto_id SET s.cantidad = GREATEST(s.cantidad, 3)
               WHERE p.codigo = 'RE-ACE-ISO68'`);
});
after(async () => {
  await query("UPDATE centros_trabajo SET estado = 'operativo' WHERE id = ?", [plegadora]);
  await pool.end();
});

describe('reporte de falla', () => {
  test('el operario reporta que la máquina se paró: queda en mantenimiento y se avisa al área', async () => {
    assert.equal((await api().post('/api/v1/ordenes-mantenimiento').set(como('matias')).send({ centro_trabajo_id: plegadora, descripcion: 'x' })).status, 400);
    const r = await api().post('/api/v1/ordenes-mantenimiento').set(como('matias'))
      .send({ centro_trabajo_id: plegadora, descripcion: 'Pierde aceite el cilindro izquierdo y no baja el punzón', detiene_maquina: true });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^OM-\d{4}-\d{4}$/);
    assert.equal(r.body.data.tipo, 'correctivo');
    assert.equal(r.body.data.prioridad, 'alta');
    assert.equal(r.body.data.estado, 'abierta');
    omId = r.body.data.id;
    assert.equal(await estadoMaquina(), 'mantenimiento');

    const avisos = await query("SELECT usuario_id FROM notificaciones WHERE tipo = 'falla_maquina' AND entidad_id = ?", [omId]);
    const ids = avisos.map((a) => a.usuario_id);
    assert.ok(ids.includes(s.oscar.usuario.id) && ids.includes(s.daniel.usuario.id));
  });

  test('con la máquina parada no se pueden iniciar operaciones en ella', async () => {
    const t = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: 'Plegado de prueba', centro_trabajo_id: plegadora });
    assert.equal(t.status, 201, JSON.stringify(t.body));
    const asignar = await api().post(`/api/v1/tareas/${t.body.data.id}/asignaciones`).set(como('jorge')).send({ empleado_id: s.jorge.usuario.empleadoId });
    assert.equal(asignar.status, 422);
    assert.match(JSON.stringify(asignar.body), /PLE-01 está en mantenimiento/);
    await api().post(`/api/v1/tareas/${t.body.data.id}/cancelar`).set(como('jorge')).send({});
  });

  test('solo el jefe de Mantenimiento genera órdenes preventivas', async () => {
    const r = await api().post('/api/v1/ordenes-mantenimiento').set(como('daniel'))
      .send({ centro_trabajo_id: plegadora, descripcion: 'Revisión general', tipo: 'preventivo' });
    assert.equal(r.status, 403);
  });

  test('ve la orden quien la reportó, Mantenimiento y el jefe del área de la máquina', async () => {
    for (const q of ['matias', 'daniel', 'oscar', 'jorge']) assert.equal((await om(q)).status, 200, q);
    for (const q of ['marcelo', 'claudio']) assert.equal((await om(q)).status, 404, q);
    const l = await api().get('/api/v1/ordenes-mantenimiento').query({ abiertas: '1' }).set(como('claudio'));
    assert.ok(!l.body.data.some((o) => o.id === omId));
  });

  test('foto de la falla desde el teléfono', async () => {
    const r = await api().post('/api/v1/adjuntos').query({ entidad: 'orden_mantenimiento', entidad_id: omId, nombre: 'cilindro.jpg' })
      .set(como('matias')).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const l = await api().get('/api/v1/adjuntos').query({ entidad: 'orden_mantenimiento', entidad_id: omId }).set(como('daniel'));
    assert.equal(l.body.data.length, 1);
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'orden_mantenimiento', entidad_id: omId }).set(como('marcelo'))).status, 404);
  });
});

describe('reparación', () => {
  test('el técnico la toma al iniciarla; el operario no la avanza', async () => {
    assert.equal((await estado('matias', { estado: 'en_curso' })).status, 403);
    const r = await estado('daniel', { estado: 'en_curso' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.responsable_nombre, 'Daniel Correa');
    assert.equal(r.body.data.es_responsable, true);
    assert.deepEqual(r.body.data.transiciones, ['esperando_repuesto', 'cerrada']);
  });

  test('los repuestos salen del stock y suman al costo', async () => {
    const aceite = (await query("SELECT id, costo_promedio FROM productos WHERE codigo = 'RE-ACE-ISO68'"))[0];
    const antes = (await query('SELECT SUM(cantidad) AS n FROM stock WHERE producto_id = ?', [aceite.id]))[0].n;
    assert.equal((await api().post(`/api/v1/ordenes-mantenimiento/${omId}/repuestos`).set(como('matias')).send({ producto_id: aceite.id, cantidad: 1 })).status, 403);
    assert.equal((await api().post(`/api/v1/ordenes-mantenimiento/${omId}/repuestos`).set(como('daniel')).send({ producto_id: aceite.id, cantidad: 9999 })).status, 422);
    const r = await api().post(`/api/v1/ordenes-mantenimiento/${omId}/repuestos`).set(como('daniel')).send({ producto_id: aceite.id, cantidad: 1 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.costo, Number(aceite.costo_promedio));
    assert.equal(r.body.data.repuestos[0].producto_codigo, 'RE-ACE-ISO68');
    const despues = (await query('SELECT SUM(cantidad) AS n FROM stock WHERE producto_id = ?', [aceite.id]))[0].n;
    assert.equal(Number(antes) - Number(despues), 1);
  });

  test('para cerrarla hay que contar qué se hizo; la máquina vuelve a operar y se avisa', async () => {
    assert.equal((await estado('daniel', { estado: 'cancelada' })).status, 403);
    assert.equal((await estado('daniel', { estado: 'cerrada' })).status, 400);
    const r = await estado('daniel', { estado: 'cerrada', solucion: 'Cambio de retenes del cilindro y reposición de aceite', costo: 15000 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.estado, 'cerrada');
    assert.ok(r.body.data.fecha_cierre);
    assert.equal(await estadoMaquina(), 'operativo');
    const aviso = await query("SELECT titulo FROM notificaciones WHERE usuario_id = ? AND tipo = 'om_cerrada' ORDER BY id DESC LIMIT 1", [s.matias.usuario.id]);
    assert.match(aviso[0]?.titulo ?? '', /^PLE-01 reparada/);
    assert.equal((await estado('daniel', { estado: 'en_curso' })).status, 409);
  });
});

describe('asignación y preventivos', () => {
  test('el jefe asigna a un técnico de su área', async () => {
    const r = await api().post('/api/v1/ordenes-mantenimiento').set(como('jorge')).send({ centro_trabajo_id: plegadora, descripcion: 'Ruido en la bomba hidráulica' });
    assert.equal(r.status, 201);
    const id = r.body.data.id;
    assert.equal(await estadoMaquina(), 'operativo'); // no detiene la máquina
    assert.equal((await api().put(`/api/v1/ordenes-mantenimiento/${id}`).set(como('daniel')).send({ responsable_id: s.daniel.usuario.empleadoId })).status, 403);
    assert.equal((await api().put(`/api/v1/ordenes-mantenimiento/${id}`).set(como('oscar')).send({ responsable_id: s.matias.usuario.empleadoId })).status, 400);
    const a = await api().put(`/api/v1/ordenes-mantenimiento/${id}`).set(como('oscar')).send({ responsable_id: s.daniel.usuario.empleadoId, detiene_maquina: true });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.data.responsable_nombre, 'Daniel Correa');
    assert.equal(await estadoMaquina(), 'mantenimiento');
    const c = await estado('oscar', { estado: 'cancelada' }, id);
    assert.equal(c.status, 200);
    assert.equal(await estadoMaquina(), 'operativo');
  });

  test('los planes los arma Mantenimiento; al cerrar el preventivo se reprograma', async () => {
    const datos = { centro_trabajo_id: plegadora, nombre: 'Engrase de bulones de la cortina', frecuencia_dias: 60 };
    assert.equal((await api().post('/api/v1/planes-mantenimiento').set(como('jorge')).send(datos)).status, 403);
    const p = await api().post('/api/v1/planes-mantenimiento').set(como('oscar')).send(datos);
    assert.equal(p.status, 201, JSON.stringify(p.body));
    assert.equal(p.body.data.proxima_fecha, sumarDias(hoy(), 60));

    const ficha = await api().get(`/api/v1/maquinas/${plegadora}`).set(como('matias'));
    assert.equal(ficha.status, 200);
    assert.ok(ficha.body.data.planes.some((x) => x.id === p.body.data.id));
    assert.equal(ficha.body.data.puede_generar_preventivo, false);
    assert.ok(ficha.body.data.ultimas.some((x) => x.id === omId));

    const otraMaquina = (await query("SELECT id FROM centros_trabajo WHERE codigo = 'TOR-01'"))[0].id;
    assert.equal((await api().post('/api/v1/ordenes-mantenimiento').set(como('oscar'))
      .send({ centro_trabajo_id: otraMaquina, plan_id: p.body.data.id, tipo: 'preventivo', descripcion: 'Engrase' })).status, 400);
    const pv = await api().post('/api/v1/ordenes-mantenimiento').set(como('oscar'))
      .send({ centro_trabajo_id: plegadora, plan_id: p.body.data.id, tipo: 'preventivo', descripcion: 'Engrase de bulones de la cortina' });
    assert.equal(pv.status, 201, JSON.stringify(pv.body));
    await estado('oscar', { estado: 'en_curso' }, pv.body.data.id);
    const cierre = await estado('oscar', { estado: 'cerrada', solucion: 'Engrasado' }, pv.body.data.id);
    assert.equal(cierre.status, 200, JSON.stringify(cierre.body));
    const plan = (await query('SELECT ultima_ejecucion, proxima_fecha FROM planes_mantenimiento WHERE id = ?', [p.body.data.id]))[0];
    assert.equal(plan.ultima_ejecucion, hoy());
    assert.equal(plan.proxima_fecha, sumarDias(hoy(), 60));
  });

  test('el escaneo del QR de la máquina lleva a su ficha', async () => {
    const r = await api().get('/api/v1/escaneo').query({ codigo: 'BC:MAQ:PLE-01' }).set(como('daniel'));
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.data.tipo, r.body.data.id], ['maquina', plegadora]);
  });
});
