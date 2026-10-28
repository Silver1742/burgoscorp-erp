// Tests del circuito completo de un pedido: solicitud con foto → presupuesto → OT con operaciones y
// material reservado → producción → inspección con no conformidad y retrabajo → aprobación →
// factura y cobro. Además la factura del proveedor y el tablero según el rol.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  florencia: 'florencia.rios@burgoscorp.test',   // Comercial (empleada)
  diego: 'diego.acosta@burgoscorp.test',         // jefe Comercial
  valentina: 'valentina.castro@burgoscorp.test', // Ingeniería (presupuesta)
  marcelo: 'marcelo.ibanez@burgoscorp.test',     // jefe de Soldadura
  claudio: 'claudio.ortiz@burgoscorp.test',      // soldador
  ramon: 'ramon.gimenez@burgoscorp.test',        // tornero (otra área)
  leandro: 'leandro.paz@burgoscorp.test',        // inspector de Calidad
  pablo: 'pablo.sosa@burgoscorp.test',           // Administración
  natalia: 'natalia.quiroga@burgoscorp.test',    // jefa de Administración
  ricardo: 'ricardo.ferreyra@burgoscorp.test',   // gerencia
  gabriel: 'gabriel.ponce@burgoscorp.test',      // comprador
  mariana: 'mariana.ledesma@burgoscorp.test',    // jefa de Abastecimiento
  ruben: 'ruben.arias@burgoscorp.test',          // pañolero
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]);
const idDe = async (sql, p) => (await query(sql, p))[0].id;

let cliente;
let solicitudId;
let presupuestoId;
let ot;
let operacionId;
let facturaId;

const medicion = (medido) => ({ caracteristica: 'Diámetro de salida', valor_nominal: 150, tolerancia_mas: 1, tolerancia_menos: 1, valor_medido: medido });

/** Claudio hace la operación y Marcelo la aprueba (la OT pasa sola a calidad). */
async function hacerOperacion() {
  assert.equal((await api().post(`/api/v1/tareas/${operacionId}/iniciar`).set(como('claudio'))).status, 200);
  const t = await api().post(`/api/v1/tareas/${operacionId}/terminar`).set(como('claudio')).send({});
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const a = await api().post(`/api/v1/tareas/${operacionId}/aprobar`).set(como('marcelo')).send({});
  assert.equal(a.status, 200, JSON.stringify(a.body));
}

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
  // Claudio no puede tener otra tarea en curso de corridas anteriores.
  await query(`UPDATE tareas t JOIN tarea_asignaciones ta ON ta.tarea_id = t.id SET t.estado = 'pausada'
               WHERE t.estado = 'en_curso' AND ta.empleado_id = ?`, [s.claudio.usuario.empleadoId]);
  await query('UPDATE registros_horas SET fin_at = UTC_TIMESTAMP(), horas = 0 WHERE fin_at IS NULL AND empleado_id = ?', [s.claudio.usuario.empleadoId]);
  await query("UPDATE centros_trabajo SET estado = 'operativo' WHERE codigo = 'SOL-01'");
  cliente = await idDe("SELECT id FROM clientes WHERE razon_social = 'Agroindustrias San Jorge S.R.L.'");
});
after(() => pool.end());

describe('ventas', () => {
  test('Comercial carga la solicitud con la foto de la pieza', async () => {
    const datos = { cliente_id: cliente, titulo: 'Reducción 9×30 a manguera Ø15', tipo_trabajo: 'fabricacion', descripcion: 'Entrada de aire de cosechadora' };
    assert.equal((await api().post('/api/v1/solicitudes').set(como('ramon')).send(datos)).status, 403);
    const r = await api().post('/api/v1/solicitudes').set(como('florencia')).send(datos);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^SOL-\d{4}-\d{4}$/);
    assert.equal(r.body.data.estado, 'nueva');
    assert.ok(r.body.data.cliente_telefono);
    solicitudId = r.body.data.id;

    const f = await api().post('/api/v1/adjuntos').query({ entidad: 'solicitud', entidad_id: solicitudId, nombre: 'pieza.jpg' })
      .set(como('florencia')).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(f.status, 201, JSON.stringify(f.body));
  });

  test('el jefe la asigna a Ingeniería', async () => {
    assert.equal((await api().put(`/api/v1/solicitudes/${solicitudId}`).set(como('diego')).send({ asignada_a: s.claudio.usuario.empleadoId })).status, 400);
    const r = await api().put(`/api/v1/solicitudes/${solicitudId}`).set(como('diego')).send({ asignada_a: s.valentina.usuario.empleadoId });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.estado, 'en_analisis');
    assert.equal(r.body.data.asignada_a_nombre, 'Valentina Castro');
  });

  test('Ingeniería presupuesta: los importes los calcula el servidor', async () => {
    const soldadora = await idDe("SELECT id FROM centros_trabajo WHERE codigo = 'SOL-01'");
    const chapa = await idDe("SELECT id FROM productos WHERE codigo = 'MP-CH-16'");
    const chapaGruesa = await idDe("SELECT id FROM productos WHERE codigo = 'MP-CH-64'");
    const r = await api().post('/api/v1/presupuestos').set(como('valentina')).send({
      solicitud_id: solicitudId, plazo_entrega_dias: 7,
      items: [
        { tipo: 'maquina', descripcion: 'Rolado y soldadura MIG', centro_trabajo_id: soldadora, cantidad: 3, unidad: 'h', precio_unitario: 24000 },
        { tipo: 'material', descripcion: 'Chapa 1,6 mm', producto_id: chapa, cantidad: 0.5, unidad: 'm2', precio_unitario: 31200 },
        { tipo: 'material', descripcion: 'Chapa 6,4 mm (refuerzo)', producto_id: chapaGruesa, cantidad: 500, unidad: 'm2', precio_unitario: 100 },
      ],
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^PRE-\d{4}-\d{4}$/);
    assert.equal(r.body.data.subtotal, 137600);
    assert.equal(r.body.data.iva_monto, 28896);
    assert.equal(r.body.data.total, 166496);
    presupuestoId = r.body.data.id;
    assert.equal((await api().post('/api/v1/presupuestos').set(como('valentina')).send({ solicitud_id: solicitudId, items: [{ tipo: 'otro', descripcion: 'x', cantidad: 1, precio_unitario: 1 }] })).status, 409);
    const sol = await api().get(`/api/v1/solicitudes/${solicitudId}`).set(como('florencia'));
    assert.equal(sol.body.data.estado, 'presupuestada');
  });

  test('aceptado por el cliente: se crea la OT con su operación y el material reservado', async () => {
    const sol = await idDe("SELECT id FROM areas WHERE codigo = 'SOL'");
    assert.equal((await api().post(`/api/v1/presupuestos/${presupuestoId}/aprobar`).set(como('diego')).send({ area_id: sol })).status, 409); // todavía en borrador
    assert.equal((await api().post(`/api/v1/presupuestos/${presupuestoId}/enviar`).set(como('florencia'))).status, 200);
    const com = await idDe("SELECT id FROM areas WHERE codigo = 'COM'");
    assert.equal((await api().post(`/api/v1/presupuestos/${presupuestoId}/aprobar`).set(como('florencia')).send({ area_id: sol })).status, 403);
    assert.equal((await api().post(`/api/v1/presupuestos/${presupuestoId}/aprobar`).set(como('diego')).send({ area_id: com })).status, 400);

    const r = await api().post(`/api/v1/presupuestos/${presupuestoId}/aprobar`).set(como('diego')).send({ area_id: sol, prioridad: 'alta' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.estado, 'aprobado');
    assert.match(r.body.data.ot_numero, /^OT-/);
    assert.equal(r.body.data.faltantes.length, 1);

    const o = await api().get(`/api/v1/ordenes-trabajo/${r.body.data.orden_trabajo_id}`).set(como('marcelo'));
    ot = o.body.data;
    assert.equal(ot.cliente_nombre, 'Agroindustrias San Jorge S.R.L.');
    assert.equal(ot.tareas.length, 1);
    assert.equal(ot.tareas[0].centro_codigo, 'SOL-01');
    assert.equal(Number(ot.horas_estimadas), 3);
    operacionId = ot.tareas[0].id;
    const m = await api().get(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('marcelo'));
    assert.equal(m.body.data.length, 2);
    assert.ok(m.body.data.some((x) => x.faltante > 0));
    const s2 = await api().get(`/api/v1/solicitudes/${solicitudId}`).set(como('florencia'));
    assert.equal(s2.body.data.estado, 'aprobada');
    const aviso = await query("SELECT titulo FROM notificaciones WHERE usuario_id = ? AND tipo = 'ot_nueva' ORDER BY id DESC LIMIT 1", [s.marcelo.usuario.id]);
    assert.match(aviso[0]?.titulo ?? '', new RegExp(ot.numero));
  });
});

describe('calidad', () => {
  test('la OT llega a calidad cuando se aprueba su operación', async () => {
    assert.equal((await api().post(`/api/v1/tareas/${operacionId}/asignaciones`).set(como('marcelo')).send({ empleado_id: s.claudio.usuario.empleadoId })).status, 201);
    await hacerOperacion();
    const p = await api().get('/api/v1/calidad/pendientes').set(como('leandro'));
    const pendiente = p.body.data.find((x) => x.id === ot.id);
    assert.ok(pendiente, 'la OT tiene que estar en la lista de Calidad');
    assert.equal(pendiente.operaciones[0].id, operacionId);
  });

  test('no se aprueba con mediciones fuera de tolerancia; el rechazo pide qué rehacer', async () => {
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/inspecciones`).set(como('claudio')).send({ resultado: 'aprobada' })).status, 403);
    const fuera = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/inspecciones`).set(como('leandro'))
      .send({ resultado: 'aprobada', mediciones: [medicion(152.3)] });
    assert.equal(fuera.status, 422);
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/inspecciones`).set(como('leandro'))
      .send({ resultado: 'rechazada', observaciones: 'Diámetro de salida grande' })).status, 400);
  });

  test('no conformidad: la operación vuelve a rehacerse y se avisa al soldador', async () => {
    const r = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/inspecciones`).set(como('leandro')).send({
      resultado: 'rechazada', observaciones: 'Diámetro de salida 152,3 mm: la manguera no ajusta', mediciones: [medicion(152.3)],
      cantidad_inspeccionada: 1, cantidad_rechazada: 1, retrabajo_tarea_id: operacionId,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^INSP-/);
    assert.equal(r.body.data.mediciones[0].conforme, 0);
    const t = await api().get(`/api/v1/tareas/${operacionId}`).set(como('claudio'));
    assert.equal(t.body.data.estado, 'rechazada');
    assert.match(t.body.data.historial.at(-1).comentario, /No conformidad INSP-/);
    const o = await api().get(`/api/v1/ordenes-trabajo/${ot.id}`).set(como('marcelo'));
    assert.equal(o.body.data.estado, 'en_proceso');
    const aviso = await query("SELECT titulo FROM notificaciones WHERE usuario_id = ? AND tipo = 'no_conformidad' ORDER BY id DESC LIMIT 1", [s.claudio.usuario.id]);
    assert.match(aviso[0]?.titulo ?? '', /^Rehacer/);

    const foto = await api().post('/api/v1/adjuntos').query({ entidad: 'inspeccion', entidad_id: r.body.data.id, nombre: 'medicion.jpg' })
      .set(como('leandro')).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(foto.status, 201, JSON.stringify(foto.body));
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'inspeccion', entidad_id: r.body.data.id }).set(como('ramon'))).status, 404);
  });

  test('rehecha y aprobada: la OT queda terminada y se avisa a Finanzas', async () => {
    await hacerOperacion();
    const r = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/inspecciones`).set(como('leandro'))
      .send({ resultado: 'aprobada', mediciones: [medicion(150.4)] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.mediciones[0].conforme, 1);
    const o = await api().get(`/api/v1/ordenes-trabajo/${ot.id}`).set(como('marcelo'));
    assert.equal(o.body.data.estado, 'terminada');
    const aviso = await query("SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ? AND tipo = 'ot_terminada' AND entidad_id = ?", [s.pablo.usuario.id, ot.id]);
    assert.equal(aviso[0].n, 1);
  });
});

describe('finanzas', () => {
  test('solo Administración factura; la factura sale del presupuesto con letra A', async () => {
    assert.equal((await api().post('/api/v1/comprobantes/factura-venta').set(como('florencia')).send({ orden_trabajo_id: ot.id })).status, 403);
    const p = await api().get('/api/v1/comprobantes/pendientes').set(como('pablo'));
    assert.ok(p.body.data.ordenes_trabajo.some((x) => x.id === ot.id));

    const r = await api().post('/api/v1/comprobantes/factura-venta').set(como('pablo')).send({ orden_trabajo_id: ot.id });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.letra, 'A');
    assert.equal(r.body.data.items.length, 3);
    assert.equal(r.body.data.total, 166496);
    assert.equal(r.body.data.saldo, 166496);
    assert.equal(r.body.data.ot_numero, ot.numero);
    facturaId = r.body.data.id;
    assert.equal((await api().post('/api/v1/comprobantes/factura-venta').set(como('pablo')).send({ orden_trabajo_id: ot.id })).status, 409);
  });

  test('cobro parcial y total; no se cobra de más ni se anula lo cobrado', async () => {
    const parcial = await api().post(`/api/v1/comprobantes/${facturaId}/pagos`).set(como('pablo')).send({ monto: 66496, medio: 'transferencia', referencia: 'Op. 4471' });
    assert.equal(parcial.status, 201, JSON.stringify(parcial.body));
    assert.equal(parcial.body.data.estado, 'parcial');
    assert.equal(parcial.body.data.saldo, 100000);
    assert.equal((await api().post(`/api/v1/comprobantes/${facturaId}/pagos`).set(como('pablo')).send({ monto: 100000.01, medio: 'efectivo' })).status, 422);
    assert.equal((await api().post(`/api/v1/comprobantes/${facturaId}/anular`).set(como('natalia')).send({})).status, 409);
    const total = await api().post(`/api/v1/comprobantes/${facturaId}/pagos`).set(como('pablo')).send({ monto: 100000, medio: 'cheque' });
    assert.equal(total.body.data.estado, 'pagado');
    assert.equal(total.body.data.pagos.length, 2);
    assert.equal(total.body.data.pagos[0].tipo, 'cobro');
  });

  test('factura del proveedor de una OC recibida, con su foto', async () => {
    const proveedor = await idDe("SELECT id FROM proveedores WHERE razon_social = 'Chapas y Perfiles Norte S.R.L.'");
    const chapa = await idDe("SELECT id FROM productos WHERE codigo = 'MP-CH-64'");
    const oc = await api().post('/api/v1/ordenes-compra').set(como('gabriel')).send({ proveedor_id: proveedor, orden_trabajo_id: ot.id, items: [{ producto_id: chapa, cantidad: 2, precio_unitario: 80000 }] });
    const ocId = oc.body.data.id;
    const datos = { orden_compra_id: ocId, letra: 'A', punto_venta: 3, numero: Number(String(Date.now()).slice(-7)) };
    assert.equal((await api().post('/api/v1/comprobantes/factura-compra').set(como('pablo')).send(datos)).status, 422); // no recibida
    await api().post(`/api/v1/ordenes-compra/${ocId}/enviar-aprobacion`).set(como('gabriel'));
    await api().post(`/api/v1/ordenes-compra/${ocId}/aprobar`).set(como('mariana'));
    const dep = await idDe("SELECT id FROM depositos WHERE codigo = 'DEP-MP'");
    const rec = await api().post(`/api/v1/ordenes-compra/${ocId}/recibir`).set(como('ruben')).send({ deposito_id: dep, items: [{ item_id: oc.body.data.items[0].id, cantidad: 2 }] });
    assert.equal(rec.body.data.estado, 'recibida');

    const r = await api().post('/api/v1/comprobantes/factura-compra').set(como('pablo')).send(datos);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.tipo, 'factura_compra');
    assert.equal(r.body.data.total, 193600);
    assert.equal(r.body.data.contraparte, 'Chapas y Perfiles Norte S.R.L.');
    assert.equal((await api().post('/api/v1/comprobantes/factura-compra').set(como('pablo')).send(datos)).status, 409);

    const foto = await api().post('/api/v1/adjuntos').query({ entidad: 'comprobante', entidad_id: r.body.data.id, nombre: 'factura.jpg' })
      .set(como('pablo')).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(foto.status, 201, JSON.stringify(foto.body));
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'comprobante', entidad_id: r.body.data.id }).set(como('gabriel'))).status, 404);
  });
});

describe('tablero', () => {
  test('Gerencia ve todo; un jefe de producción no ve Finanzas', async () => {
    const g = await api().get('/api/v1/tablero').set(como('ricardo'));
    assert.equal(g.status, 200, JSON.stringify(g.body));
    for (const k of ['produccion', 'ventas', 'calidad', 'mantenimiento', 'inventario', 'finanzas']) assert.ok(g.body.data[k], k);
    assert.equal(g.body.data.alcance, 'todo');
    assert.ok(g.body.data.finanzas.facturado_mes >= 166496);
    assert.ok(g.body.data.calidad.inspecciones_mes >= 2);

    const j = await api().get('/api/v1/tablero').set(como('marcelo'));
    assert.equal(j.status, 200);
    assert.ok(j.body.data.produccion);
    assert.equal(j.body.data.finanzas, undefined);
  });
});
