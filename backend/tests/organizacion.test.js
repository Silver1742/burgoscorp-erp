// Búsqueda general, integrantes de cada área y "un solo jefe por área".
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
  ricardo: 'ricardo.ferreyra@burgoscorp.test', // gerencia
  jorge: 'jorge.dominguez@burgoscorp.test',    // jefe de Mecanizado
  ramon: 'ramon.gimenez@burgoscorp.test',      // tornero de Mecanizado
  mariana: 'mariana.ledesma@burgoscorp.test',  // jefa de Abastecimiento
  diego: 'diego.acosta@burgoscorp.test',       // jefe Comercial
  matias: 'matias.peralta@burgoscorp.test',    // operador CNC de Mecanizado
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const area = async (codigo) => (await query('SELECT id FROM areas WHERE codigo = ?', [codigo]))[0].id;
const sello = Date.now() % 1e7;
const areasDePrueba = [];

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
});
after(async () => {
  for (const id of areasDePrueba) await query('UPDATE areas SET activo = 0 WHERE id = ?', [id]);
  await pool.end();
});

async function areaNueva(nombre) {
  const r = await query('INSERT INTO areas (codigo, nombre) VALUES (?, ?)', [`Z${sello}${areasDePrueba.length}`, `${nombre} ${sello}`]);
  areasDePrueba.push(r.insertId);
  return r.insertId;
}
const crearJefe = (nombre, areaId, jefeActual) => api().post('/api/v1/usuarios').set(como('admin')).send({
  email: `${nombre.toLowerCase()}.${sello}@correo.test`, nombre, apellido: 'Prueba', rol: 'JEFE', area_id: areaId,
  ...(jefeActual ? { jefe_actual: jefeActual } : {}),
});
const rolDe = async (usuarioId) => (await query('SELECT r.codigo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [usuarioId]))[0].codigo;
const jefeDeArea = async (areaId) => (await query('SELECT jefe_empleado_id FROM areas WHERE id = ?', [areaId]))[0].jefe_empleado_id;

describe('un solo jefe por área', () => {
  test('el primero queda a cargo; el segundo pide decidir qué hacer con el actual', async () => {
    const t = await areaNueva('Taller A');
    const a = await crearJefe('Ana', t);
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(await jefeDeArea(t), a.body.data.empleado_id);

    const b = await crearJefe('Beto', t);
    assert.equal(b.status, 409);
    assert.equal(b.body.error.codigo, 'JEFE_OCUPADO');
    assert.match(b.body.error.mensaje, /ya tiene jefe: Ana Prueba/);
    assert.equal(b.body.error.detalles[0].jefes[0].nombre, 'Ana Prueba');
    assert.ok(Array.isArray(b.body.error.detalles[0].areas_libres));
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM usuarios WHERE email = ?', [`beto.${sello}@correo.test`]);
    assert.equal(Number(n), 0, 'no se creó nada a medias');
  });

  test('destituir: el anterior pasa a empleado y el nuevo queda a cargo', async () => {
    const t = await areaNueva('Taller B');
    const a = await crearJefe('Carla', t);
    const b = await crearJefe('Dario', t, { accion: 'destituir' });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.equal(await jefeDeArea(t), b.body.data.empleado_id);
    assert.equal(await rolDe(a.body.data.id), 'EMPLEADO');
    const [sup] = await query('SELECT supervisor_id FROM empleados WHERE id = ?', [a.body.data.empleado_id]);
    assert.equal(sup.supervisor_id, b.body.data.empleado_id, 'Carla ahora reporta a Darío');
  });

  test('mover: el anterior pasa a ser jefe de otra área sin jefe', async () => {
    const t = await areaNueva('Taller C');
    const libre = await areaNueva('Taller libre');
    const a = await crearJefe('Elsa', t);
    const ocupada = await crearJefe('Fito', t, { accion: 'mover', area_id: t });
    assert.equal(ocupada.status, 400, 'no se puede mover a la misma área');
    const b = await crearJefe('Gabi', t, { accion: 'mover', area_id: libre });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.equal(await jefeDeArea(t), b.body.data.empleado_id);
    assert.equal(await jefeDeArea(libre), a.body.data.empleado_id);
    assert.equal(await rolDe(a.body.data.id), 'JEFE');
  });

  test('cambiar el rol a jefe también respeta la regla', async () => {
    const t = await areaNueva('Taller D');
    await crearJefe('Hugo', t);
    const emp = await api().post('/api/v1/usuarios').set(como('admin')).send({
      email: `ines.${sello}@correo.test`, nombre: 'Ines', apellido: 'Prueba', rol: 'EMPLEADO', area_id: t,
    });
    assert.equal(emp.status, 201);
    const sinDecidir = await api().put(`/api/v1/usuarios/${emp.body.data.id}`).set(como('admin')).send({ rol: 'JEFE' });
    assert.equal(sinDecidir.status, 409);
    assert.equal(sinDecidir.body.error.codigo, 'JEFE_OCUPADO');
    const ok = await api().put(`/api/v1/usuarios/${emp.body.data.id}`).set(como('admin')).send({ rol: 'JEFE', jefe_actual: { accion: 'destituir' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(await jefeDeArea(t), emp.body.data.empleado_id);
  });
});

describe('integrantes de cada área', () => {
  test('gerencia y el administrador ven cualquier área con sus datos', async () => {
    const mec = await area('MEC');
    for (const q of ['ricardo', 'admin']) {
      const r = await api().get(`/api/v1/personal/area/${mec}`).set(como(q));
      assert.equal(r.status, 200, `${q}: ${JSON.stringify(r.body)}`);
      assert.equal(r.body.data.area.nombre, 'Mecanizado');
      const jorge = r.body.data.integrantes.find((i) => i.email === EMAILS.jorge);
      assert.equal(jorge.es_jefe, true);
      const ramon = r.body.data.integrantes.find((i) => i.email === EMAILS.ramon);
      assert.match(ramon.habilidades, /Tornería/);
      assert.equal(typeof ramon.tareas_abiertas, 'number');
    }
  });

  test('un jefe ve su área pero no las otras; un empleado no ve el personal', async () => {
    assert.equal((await api().get(`/api/v1/personal/area/${await area('MEC')}`).set(como('jorge'))).status, 200);
    assert.equal((await api().get(`/api/v1/personal/area/${await area('SOL')}`).set(como('jorge'))).status, 403);
    assert.equal((await api().get(`/api/v1/personal/area/${await area('MEC')}`).set(como('ramon'))).status, 403);
  });
});

describe('búsqueda general', () => {
  test('el administrador encuentra personas y cuentas en una sola búsqueda', async () => {
    const r = await api().get('/api/v1/buscar').query({ q: 'Domínguez' }).set(como('admin'));
    assert.equal(r.status, 200);
    const tipos = r.body.data.grupos.map((g) => g.tipo);
    assert.ok(tipos.includes('persona'));
    assert.ok(tipos.includes('usuario'));
  });

  test('cada uno solo ve lo que su rol permite', async () => {
    const r = await api().get('/api/v1/buscar').query({ q: 'Domínguez' }).set(como('ramon'));
    assert.equal(r.status, 200);
    const tipos = r.body.data.grupos.map((g) => g.tipo);
    assert.ok(!tipos.includes('usuario'), 'un empleado no busca cuentas de usuario');
    assert.ok(!(r.body.data.grupos.find((g) => g.tipo === 'persona')?.items ?? []).some((i) => /Domínguez/.test(i.titulo)),
      'un empleado no ve el legajo de otros');
  });

  test('máquinas, materiales y clientes por código o nombre; menos de 2 letras → 400', async () => {
    const maq = await api().get('/api/v1/buscar').query({ q: 'CNC-01' }).set(como('ricardo'));
    assert.ok(maq.body.data.grupos.some((g) => g.tipo === 'maquina'));
    const cli = await api().get('/api/v1/buscar').query({ q: 'Metalúrgica' }).set(como('ricardo'));
    assert.ok(cli.body.data.grupos.some((g) => g.tipo === 'cliente'));
    assert.equal((await api().get('/api/v1/buscar').query({ q: 'a' }).set(como('admin'))).status, 400);
    const raro = await api().get('/api/v1/buscar').query({ q: "%' OR 1=1 --" }).set(como('admin'));
    assert.equal(raro.status, 200);
    assert.equal(raro.body.data.grupos.length, 0, 'los comodines y comillas se buscan como texto');
  });
});

describe('cada área ve lo suyo', () => {
  test('Ventas (clientes, pedidos y presupuestos) solo la ven Comercial, Ingeniería, gerencia y el admin', async () => {
    assert.equal((await api().get('/api/v1/solicitudes').set(como('mariana'))).status, 403, 'Abastecimiento no ve pedidos de clientes');
    assert.equal((await api().get('/api/v1/clientes').set(como('mariana'))).status, 403);
    assert.equal((await api().get('/api/v1/solicitudes').set(como('jorge'))).status, 403, 'Mecanizado tampoco');
    assert.equal((await api().get('/api/v1/solicitudes').set(como('diego'))).status, 200);
    assert.equal((await api().get('/api/v1/solicitudes').set(como('ricardo'))).status, 200);
    const busca = await api().get('/api/v1/buscar').query({ q: 'Metalúrgica' }).set(como('mariana'));
    assert.ok(!busca.body.data.grupos.some((g) => ['cliente', 'pedido'].includes(g.tipo)), 'ni en el buscador');
    const yo = await api().get('/api/v1/auth/yo').set(como('mariana'));
    assert.equal(yo.body.data.permisos.VEN, undefined, 'ni en el menú de la app');
  });

  test('habilidades de un área: solo las que tiene alguien de esa área', async () => {
    const mec = await area('MEC');
    const r = await api().get('/api/v1/habilidades').query({ area_id: mec, limite: 100 }).set(como('jorge'));
    assert.equal(r.status, 200);
    const codigos = r.body.data.map((h) => h.codigo);
    assert.ok(codigos.includes('TORNERIA'));
    assert.ok(!codigos.includes('SOLDADURA_TIG'), 'nadie de Mecanizado suelda TIG');
    const maq = await api().get('/api/v1/centros-trabajo').query({ area_id: mec, limite: 100 }).set(como('jorge'));
    assert.ok(maq.body.data.length && maq.body.data.every((m) => m.area_id === mec), 'máquinas solo de Mecanizado');
  });

  test('una tarea se puede asignar a varias personas a la vez (todo o nada)', async () => {
    const t = await api().post('/api/v1/tareas').set(como('jorge')).send({ titulo: `Mover el torno ${sello}` });
    assert.equal(t.status, 201);
    const [{ id: ajeno }] = await query("SELECT e.id FROM empleados e JOIN areas a ON a.id = e.area_id WHERE a.codigo = 'SOL' AND e.estado = 'activo' LIMIT 1");
    const mal = await api().post(`/api/v1/tareas/${t.body.data.id}/asignaciones`).set(como('jorge'))
      .send({ empleado_ids: [s.ramon.usuario.empleadoId, ajeno] });
    assert.equal(mal.status, 422, 'alguien de otra área: no se asigna a nadie');
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM tarea_asignaciones WHERE tarea_id = ?', [t.body.data.id]);
    assert.equal(Number(n), 0);
    const ok = await api().post(`/api/v1/tareas/${t.body.data.id}/asignaciones`).set(como('jorge'))
      .send({ empleado_ids: [s.ramon.usuario.empleadoId, s.matias.usuario.empleadoId] });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.data.asignados_detalle.length, 2);
  });
});

describe('ficha de una persona', () => {
  test('lo que se puede hacer depende de quién mira', async () => {
    const ramon = s.ramon.usuario.empleadoId;
    const admin = await api().get(`/api/v1/personas/${ramon}`).set(como('admin'));
    assert.equal(admin.status, 200, JSON.stringify(admin.body));
    assert.deepEqual(admin.body.data.acciones, { editar_cuenta: true, eliminar_cuenta: true, editar_area: true, asignar_tarea: true });
    assert.equal(admin.body.data.cuenta.email, EMAILS.ramon);
    assert.ok(admin.body.data.habilidades.some((h) => /Torner/.test(h.nombre)));

    const jefe = await api().get(`/api/v1/personas/${ramon}`).set(como('jorge'));
    assert.deepEqual(jefe.body.data.acciones, { editar_cuenta: false, eliminar_cuenta: false, editar_area: false, asignar_tarea: true }, 'el jefe asigna tareas, no edita cuentas');

    const gerencia = await api().get(`/api/v1/personas/${ramon}`).set(como('ricardo'));
    assert.deepEqual(gerencia.body.data.acciones, { editar_cuenta: false, eliminar_cuenta: false, editar_area: false, asignar_tarea: false }, 'gerencia solo consulta');

    const [{ id: soldador }] = await query("SELECT e.id FROM empleados e JOIN areas a ON a.id = e.area_id WHERE a.codigo = 'SOL' LIMIT 1");
    assert.equal((await api().get(`/api/v1/personas/${soldador}`).set(como('jorge'))).status, 403, 'un jefe no ve la ficha de otra área');
    assert.equal((await api().get(`/api/v1/personas/${s.jorge.usuario.empleadoId}`).set(como('ramon'))).status, 403, 'un empleado no ve la de otros');
  });
});

describe('Personas cuenta lo mismo que Inicio', () => {
  test('el listado de vigentes coincide con el total del resumen (licencias incluidas)', async () => {
    for (const q of ['admin', 'ricardo', 'jorge']) {
      const resumen = await api().get('/api/v1/personal/resumen').set(como(q));
      const lista = await api().get('/api/v1/empleados').query({ vigentes: '1', limite: 1 }).set(como(q));
      assert.equal(lista.status, 200);
      assert.equal(lista.body.meta.total, resumen.body.data.totales.personal, `${q}: Personas e Inicio deben dar lo mismo`);
    }
  });
  test('el filtro solo acepta 1', async () => {
    const r = await api().get('/api/v1/empleados').query({ vigentes: '0' }).set(como('admin'));
    assert.equal(r.status, 400);
  });
});

describe('el personal de RRHH gestiona los legajos', () => {
  const login = async (email) => (await api().post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data;
  const legajoNuevo = () => ({
    legajo: `L9${String(Date.now()).slice(-6)}`, nombre: 'Prueba', apellido: 'Legajo',
    dni: String(30000000 + (Date.now() % 9999999)), area_id: 1, fecha_ingreso: '2026-11-02',
  });

  test('una empleada de RRHH ve todos los legajos y da de alta uno nuevo, pero no aprueba licencias', async () => {
    const lucia = await login('lucia.benitez@burgoscorp.test');
    const yo = { Authorization: `Bearer ${lucia.accessToken}` };
    const suyos = await api().get('/api/v1/empleados').query({ limite: 1 }).set(yo);
    const todos = await api().get('/api/v1/empleados').query({ limite: 1 }).set(como('admin'));
    assert.equal(suyos.body.meta.total, todos.body.meta.total);
    const r = await api().post('/api/v1/empleados').set(yo).send(legajoNuevo());
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const { legajo: _, dni: __, ...sinNumero } = legajoNuevo();
    const auto = await api().post('/api/v1/empleados').set(yo).send(sinNumero);
    assert.equal(auto.status, 201, JSON.stringify(auto.body));
    assert.match(auto.body.data.legajo, /^L\d{4,}$/, 'sin número, la API asigna el siguiente');
    assert.equal((await api().get('/api/v1/personal/resumen').set(yo)).status, 200);
    const permisos = (await api().get('/api/v1/auth/yo').set(yo)).body.data.permisos;
    assert.equal(permisos.RRHH.alcance, 'todo');
    assert.ok(!permisos.RRHH.aprobar, 'aprobar licencias sigue siendo del jefe');
  });

  test('un empleado de otra área sigue viendo solo su legajo y no da de alta', async () => {
    const r = await api().post('/api/v1/empleados').set(como('ramon')).send(legajoNuevo());
    assert.equal(r.status, 403);
    const suyos = await api().get('/api/v1/empleados').query({ limite: 1 }).set(como('ramon'));
    assert.equal(suyos.body.meta.total, 1);
  });
});

describe('el administrador crea áreas', () => {
  test('crea un área y elige qué trabaja (solo módulos compartibles)', async () => {
    const r = await api().post('/api/v1/areas').set(como('admin')).send({ codigo: `PIN${sello}`.slice(0, 10), nombre: `Pintura ${sello}` });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const areaId = r.body.data.id;
    areasDePrueba.push(areaId);
    const m = await api().put(`/api/v1/areas/${areaId}/modulos`).set(como('admin')).send({ modulos: ['PROD'] });
    assert.equal(m.status, 200, JSON.stringify(m.body));
    const vista = await api().get(`/api/v1/areas/${areaId}`).set(como('admin'));
    assert.equal(vista.body.data.modulos, 'PROD');
    // RRHH, Calidad, Finanzas... tienen una sola área dueña: no se ofrecen.
    assert.equal((await api().put(`/api/v1/areas/${areaId}/modulos`).set(como('admin')).send({ modulos: ['RRHH'] })).status, 400);
    assert.equal((await api().put(`/api/v1/areas/${areaId}/modulos`).set(como('jorge')).send({ modulos: [] })).status, 403);
    assert.equal((await api().put('/api/v1/areas/999999/modulos').set(como('admin')).send({ modulos: [] })).status, 404);
  });
});

describe('acciones del administrador en la ficha de una persona', () => {
  test('editar el nombre cambia la cuenta y el legajo; eliminar aparece solo para el administrador', async () => {
    const empleadoId = s.matias.usuario.empleadoId;
    const ficha = await api().get(`/api/v1/personas/${empleadoId}`).set(como('admin'));
    assert.equal(ficha.body.data.acciones.eliminar_cuenta, true);
    assert.equal((await api().get(`/api/v1/personas/${empleadoId}`).set(como('ricardo'))).body.data.acciones.eliminar_cuenta, false, 'gerencia solo consulta');
    const cuentaId = ficha.body.data.cuenta.id;
    const original = { nombre: ficha.body.data.nombre, apellido: ficha.body.data.apellido };
    const r = await api().put(`/api/v1/usuarios/${cuentaId}`).set(como('admin')).send({ nombre: 'Matías Ezequiel', apellido: 'Peralta' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const [legajo] = await query('SELECT nombre, apellido FROM empleados WHERE id = ?', [empleadoId]);
    assert.equal(legajo.nombre, 'Matías Ezequiel', 'el legajo toma el nombre nuevo');
    await api().put(`/api/v1/usuarios/${cuentaId}`).set(como('admin')).send(original);
  });
});
