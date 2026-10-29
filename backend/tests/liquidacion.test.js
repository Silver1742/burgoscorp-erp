// Liquidación de sueldos: tardanzas, horas, extras, faltantes y ausencias con una semana armada a mano,
// y quién puede verla. Necesita la base de prueba con `npm run seed`.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query, queryOne } from '../src/config/db.js';

const app = crearApp();
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const api = () => request(app);
const conToken = (token) => ({ Authorization: `Bearer ${token}` });

async function login(email) {
  const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, `login de ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
}

// Semana del lunes 7 al domingo 13 de septiembre de 2026. Horas de la Argentina (UTC-3).
const DESDE = '2026-09-07';
const HASTA = '2026-09-13';
const utc = (fecha, hora) => {
  const [h, m] = hora.split(':').map(Number);
  return `${fecha} ${String(h + 3).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};
let empleadoId;

before(async () => {
  await query("UPDATE jornada_laboral SET hora_entrada = '08:00:00', tolerancia_min = 10, horas_diarias = 8, recargo_extra_habil = 50, recargo_extra_finde = 100 WHERE id = 1");
  const area = await queryOne("SELECT id FROM areas WHERE codigo = 'ADM'");
  const legajo = `L7${String(Date.now()).slice(-6)}`;
  const [r] = await pool.execute(
    "INSERT INTO empleados (legajo, nombre, apellido, area_id, fecha_ingreso, costo_hora) VALUES (?, 'Liqui', 'Dación', ?, '2026-01-01', 1000)",
    [legajo, area.id]);
  empleadoId = r.insertId;
  const fichajes = [
    ['2026-09-07', '08:00', '16:00'], // lunes: normal
    ['2026-09-08', '08:25', '16:00'], // martes: 25 min tarde → 25 min faltantes
    ['2026-09-09', '08:00', '19:10'], // miércoles: 3 h 10 de más → 3 h extra (bloques de media hora)
    // jueves 10: no vino → ausencia
    // viernes 11: licencia aprobada
    ['2026-09-12', '09:00', '13:20'], // sábado: 4 h 20 → 4 h extra al 100 %
  ];
  for (const [f, e, s] of fichajes) {
    await pool.execute('INSERT INTO asistencias (empleado_id, fecha, entrada_at, salida_at, origen) VALUES (?, ?, ?, ?, \'manual\')',
      [empleadoId, f, utc(f, e), utc(f, s)]);
  }
  await pool.execute(
    "INSERT INTO solicitudes_licencia (empleado_id, tipo, fecha_desde, fecha_hasta, dias, estado) VALUES (?, 'personal', '2026-09-11', '2026-09-11', 1, 'aprobada')",
    [empleadoId]);
});

after(async () => {
  await query('DELETE FROM asistencias WHERE empleado_id = ?', [empleadoId]);
  await query('DELETE FROM solicitudes_licencia WHERE empleado_id = ?', [empleadoId]);
  await query('DELETE FROM empleados WHERE id = ?', [empleadoId]);
  await pool.end();
});

describe('liquidación de sueldos', () => {
  test('calcula tardanzas, horas extra, faltantes, ausencias y el total', async () => {
    const token = await login('pablo.sosa@burgoscorp.test'); // Administración y Finanzas
    const res = await api().get(`/api/v1/liquidacion/${empleadoId}`).query({ desde: DESDE, hasta: HASTA }).set(conToken(token));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const l = res.body.data;
    assert.equal(l.dias_habiles, 5);
    assert.equal(l.dias_trabajados, 3);
    assert.equal(l.dias_licencia, 1);
    assert.equal(l.ausencias, 1);
    assert.equal(l.llegadas_tarde, 1);
    assert.equal(l.minutos_tarde, 25);
    assert.equal(l.horas_extra_habil, 3);
    assert.equal(l.horas_extra_finde, 4);
    assert.equal(l.horas_faltantes, 0.42);
    assert.equal(l.sueldo_base, 40000);          // 5 días × 8 h × $1000
    assert.equal(l.adicional_extras, 12500);     // 3 h × 1500 + 4 h × 2000
    assert.equal(l.descuento_ausencias, 8000);   // 1 día × 8 h × $1000
    assert.equal(l.descuento_horas, 416.67);     // 25 min
    assert.equal(l.total, 44083.33);
    assert.deepEqual(l.dias.map((d) => d.estado), ['trabajado', 'trabajado', 'trabajado', 'ausente', 'licencia', 'trabajado', 'franco']);
  });

  test('la jornada cambia el cálculo', async () => {
    const token = await login('pablo.sosa@burgoscorp.test');
    const cambio = await api().put('/api/v1/jornada').set(conToken(token))
      .send({ hora_entrada: '08:30', tolerancia_min: 0, horas_diarias: 8, recargo_extra_habil: 50, recargo_extra_finde: 100 });
    assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
    const res = await api().get(`/api/v1/liquidacion/${empleadoId}`).query({ desde: DESDE, hasta: HASTA }).set(conToken(token));
    assert.equal(res.body.data.llegadas_tarde, 0, 'entrando 08:30 nadie llegó tarde');
    await query("UPDATE jornada_laboral SET hora_entrada = '08:00:00', tolerancia_min = 10 WHERE id = 1");
  });

  test('el resumen trae a todos con totales; período inválido o muy largo → 400', async () => {
    const token = await login('pablo.sosa@burgoscorp.test');
    const res = await api().get('/api/v1/liquidacion').query({ desde: DESDE, hasta: HASTA }).set(conToken(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.empleados.some((e) => e.empleado_id === empleadoId));
    assert.ok(res.body.data.totales.empleados >= 30);
    assert.equal((await api().get('/api/v1/liquidacion').query({ desde: HASTA, hasta: DESDE }).set(conToken(token))).status, 400);
    assert.equal((await api().get('/api/v1/liquidacion').query({ desde: '2026-01-01', hasta: '2026-06-30' }).set(conToken(token))).status, 400);
  });

  test('solo Administración, gerencia y el admin ven sueldos; gerencia no cambia la jornada', async () => {
    const empleado = await login('ramon.gimenez@burgoscorp.test');
    assert.equal((await api().get('/api/v1/liquidacion').set(conToken(empleado))).status, 403);
    const jefe = await login('jorge.dominguez@burgoscorp.test');
    assert.equal((await api().get('/api/v1/liquidacion').set(conToken(jefe))).status, 403);
    const gerencia = await login('ricardo.ferreyra@burgoscorp.test');
    assert.equal((await api().get('/api/v1/liquidacion').query({ desde: DESDE, hasta: HASTA }).set(conToken(gerencia))).status, 200);
    const jornada = { hora_entrada: '07:00', tolerancia_min: 0, horas_diarias: 8, recargo_extra_habil: 50, recargo_extra_finde: 100 };
    assert.equal((await api().put('/api/v1/jornada').set(conToken(gerencia)).send(jornada)).status, 403);
  });
});
