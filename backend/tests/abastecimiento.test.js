// Tests de Inventario y Compras: stock disponible y reservado, reserva y consumo de material
// de una OT, orden de compra con aprobación y recepción, y escaneo de códigos.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  mariana: 'mariana.ledesma@burgoscorp.test', // jefa de Abastecimiento (aprueba compras)
  gabriel: 'gabriel.ponce@burgoscorp.test',   // comprador
  ruben: 'ruben.arias@burgoscorp.test',       // pañolero (recibe y ajusta stock)
  jorge: 'jorge.dominguez@burgoscorp.test',   // jefe de Mecanizado (reserva material de sus OT)
  ramon: 'ramon.gimenez@burgoscorp.test',     // tornero asignado a la OT
  claudio: 'claudio.ortiz@burgoscorp.test',   // soldador, no trabaja en la OT
  diego: 'diego.acosta@burgoscorp.test',      // jefe Comercial
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });
const sufijo = Date.now().toString(36).toUpperCase().slice(-6);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]);

let productoId;
let depositos;
let ot;
let reservaId;
let ocId;

const stockDe = async (id) => (await api().get(`/api/v1/inventario/stock/${id}`).set(como('jorge'))).body.data;

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
  depositos = Object.fromEntries((await query('SELECT id, codigo FROM depositos')).map((d) => [d.codigo, d.id]));

  // Un producto nuevo sin stock, para controlar las cuentas.
  const p = await api().post('/api/v1/productos').set(como('mariana')).send({
    codigo: `T-BR-${sufijo}`, nombre: `Barra de prueba ${sufijo}`, tipo: 'materia_prima', unidad: 'm', costo_promedio: 1000, stock_minimo: 2,
  });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  productoId = p.body.data.id;

  // Una OT de Mecanizado con una operación de torno asignada a Ramón.
  const o = await api().post('/api/v1/ordenes-trabajo').set(como('jorge')).send({ titulo: `Buje de prueba ${sufijo}`, tipo_trabajo: 'mecanizado' });
  assert.equal(o.status, 201, JSON.stringify(o.body));
  ot = o.body.data;
  const torno = (await query("SELECT id FROM centros_trabajo WHERE codigo = 'TOR-01'"))[0].id;
  const op = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/operaciones`).set(como('jorge')).send({ titulo: 'Torneado del buje', centro_trabajo_id: torno });
  assert.equal(op.status, 201, JSON.stringify(op.body));
  const a = await api().post(`/api/v1/tareas/${op.body.data.id}/asignaciones`).set(como('jorge')).send({ empleado_id: s.ramon.usuario.empleadoId });
  assert.equal(a.status, 201, JSON.stringify(a.body));
});
after(() => pool.end());

describe('stock', () => {
  test('el listado muestra total, reservado y disponible, con lo bajo el mínimo primero', async () => {
    const r = await api().get('/api/v1/inventario/stock').set(como('jorge')).query({ limite: 100 });
    assert.equal(r.status, 200);
    const primero = r.body.data[0];
    assert.equal(primero.bajo_minimo, true);
    const caño = r.body.data.find((p) => p.codigo === 'MP-CE-80');
    assert.ok('reservado' in caño && 'disponible' in caño && 'en_camino' in caño);
    assert.equal(caño.disponible, Math.max(0, caño.stock_total - caño.reservado));
  });

  test('solo Abastecimiento ajusta stock, con motivo', async () => {
    const ajuste = { producto_id: productoId, deposito_id: depositos['DEP-MP'], tipo: 'ajuste_positivo', cantidad: 3, observacion: 'Conteo físico' };
    assert.equal((await api().post('/api/v1/inventario/ajustes').set(como('jorge')).send(ajuste)).status, 403);
    assert.equal((await api().post('/api/v1/inventario/ajustes').set(como('ruben')).send({ ...ajuste, observacion: '' })).status, 400);
    const r = await api().post('/api/v1/inventario/ajustes').set(como('ruben')).send(ajuste);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.stock_total, 3);
    assert.equal(r.body.data.movimientos[0].tipo, 'ajuste_positivo');
    assert.equal(r.body.data.movimientos[0].usuario_nombre, 'Rubén Arias');
  });

  test('una transferencia mueve entre depósitos y no deja sacar más de lo que hay', async () => {
    const base = { producto_id: productoId, desde_deposito_id: depositos['DEP-MP'], hacia_deposito_id: depositos['DEP-PAN'] };
    assert.equal((await api().post('/api/v1/inventario/transferencias').set(como('ruben')).send({ ...base, hacia_deposito_id: depositos['DEP-MP'], cantidad: 1 })).status, 400);
    assert.equal((await api().post('/api/v1/inventario/transferencias').set(como('ruben')).send({ ...base, cantidad: 50 })).status, 422);
    const r = await api().post('/api/v1/inventario/transferencias').set(como('ruben')).send({ ...base, cantidad: 1 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const pan = r.body.data.depositos.find((d) => d.codigo === 'DEP-PAN');
    assert.equal(pan.cantidad, 1);
    assert.equal(r.body.data.stock_total, 3);
  });
});

describe('materiales de una orden de trabajo', () => {
  test('el jefe reserva más de lo que hay: queda el faltante y se avisa a Abastecimiento', async () => {
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('ramon')).send({ producto_id: productoId, cantidad: 5 })).status, 403);
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('diego')).send({ producto_id: productoId, cantidad: 5 })).status, 403);

    const r = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('jorge')).send({ producto_id: productoId, cantidad: 5 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.meta.faltante, 2);
    const fila = r.body.data.find((x) => x.producto_id === productoId);
    assert.equal(fila.pendiente, 5);
    assert.equal(fila.faltante, 2);
    reservaId = fila.id;

    const aviso = await query(`SELECT n.titulo FROM notificaciones n WHERE n.usuario_id = ? AND n.tipo = 'material_faltante' ORDER BY n.id DESC LIMIT 1`, [s.mariana.usuario.id]);
    assert.equal(aviso[0]?.titulo, `Falta material para ${ot.numero}`);

    const p = await stockDe(productoId);
    assert.equal(p.reservado, 5);
    assert.equal(p.disponible, 0);
    assert.equal(p.reservas[0].ot_numero, ot.numero);
  });

  test('no se puede ajustar para abajo lo que está reservado', async () => {
    const r = await api().post('/api/v1/inventario/ajustes').set(como('ruben'))
      .send({ producto_id: productoId, deposito_id: depositos['DEP-MP'], tipo: 'ajuste_negativo', cantidad: 1, observacion: 'Rotura' });
    assert.equal(r.status, 422);
  });

  test('el operario asignado consume; quien no trabaja en la OT ni la ve', async () => {
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales/${reservaId}/consumir`).set(como('claudio')).send({ cantidad: 1 })).status, 404);
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales/${reservaId}/consumir`).set(como('ramon')).send({ cantidad: 6 })).status, 422);
    // En DEP-MP quedan 2: pedir 3 de ese depósito no alcanza.
    assert.equal((await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales/${reservaId}/consumir`).set(como('ramon'))
      .send({ cantidad: 3, deposito_id: depositos['DEP-MP'] })).status, 422);

    const r = await api().post(`/api/v1/ordenes-trabajo/${ot.id}/materiales/${reservaId}/consumir`).set(como('ramon')).send({ cantidad: 2 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const fila = r.body.data.find((x) => x.id === reservaId);
    assert.equal(fila.cantidad_consumida, 2);
    assert.equal(fila.pendiente, 3);
    assert.equal(r.body.meta.puede_consumir, true);
    assert.equal(r.body.meta.puede_reservar, false);

    const o = await api().get(`/api/v1/ordenes-trabajo/${ot.id}`).set(como('jorge'));
    assert.equal(o.body.data.costo_real, 2000);
    assert.equal(o.body.data.costo_material, 2000);
    const p = await stockDe(productoId);
    assert.equal(p.stock_total, 1);
    assert.equal(p.movimientos[0].tipo, 'consumo_ot');
    assert.equal(p.movimientos[0].ref_numero, ot.numero);
  });
});

describe('órdenes de compra', () => {
  test('el comprador arma la OC para la OT y el servidor calcula los importes', async () => {
    const proveedor = (await query("SELECT id FROM proveedores WHERE razon_social = 'Aceros del Litoral S.A.'"))[0].id;
    const cuerpo = { proveedor_id: proveedor, orden_trabajo_id: ot.id, items: [{ producto_id: productoId, cantidad: 10, precio_unitario: 1300 }] };
    assert.equal((await api().post('/api/v1/ordenes-compra').set(como('jorge')).send(cuerpo)).status, 403);
    assert.equal((await api().post('/api/v1/ordenes-compra').set(como('gabriel')).send({ ...cuerpo, items: [] })).status, 400);
    assert.equal((await api().post('/api/v1/ordenes-compra').set(como('gabriel')).send({ ...cuerpo, total: 1 })).status, 400);

    const r = await api().post('/api/v1/ordenes-compra').set(como('gabriel')).send(cuerpo);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.numero, /^OC-\d{4}-\d{4}$/);
    assert.equal(r.body.data.estado, 'borrador');
    assert.equal(r.body.data.subtotal, 13000);
    assert.equal(r.body.data.iva_monto, 2730);
    assert.equal(r.body.data.total, 15730);
    assert.equal(r.body.data.items[0].descripcion, `Barra de prueba ${sufijo}`);
    assert.equal(r.body.data.ot_numero, ot.numero);
    ocId = r.body.data.id;

    const ed = await api().put(`/api/v1/ordenes-compra/${ocId}`).set(como('gabriel')).send({ items: [{ producto_id: productoId, cantidad: 10, precio_unitario: 1200 }] });
    assert.equal(ed.body.data.total, 14520);
  });

  test('la aprueba alguien distinto de quien la pidió', async () => {
    assert.equal((await api().post(`/api/v1/ordenes-compra/${ocId}/aprobar`).set(como('mariana'))).status, 422); // todavía en borrador
    const env = await api().post(`/api/v1/ordenes-compra/${ocId}/enviar-aprobacion`).set(como('gabriel'));
    assert.equal(env.status, 200, JSON.stringify(env.body));
    assert.equal(env.body.data.estado, 'pendiente_aprobacion');
    assert.equal(env.body.data.puede_aprobar, false);
    assert.equal((await api().post(`/api/v1/ordenes-compra/${ocId}/aprobar`).set(como('gabriel'))).status, 403);
    assert.equal((await api().put(`/api/v1/ordenes-compra/${ocId}`).set(como('gabriel')).send({ observaciones: 'x' })).status, 409);

    const ap = await api().post(`/api/v1/ordenes-compra/${ocId}/aprobar`).set(como('mariana'));
    assert.equal(ap.status, 200, JSON.stringify(ap.body));
    assert.equal(ap.body.data.estado, 'aprobada');
    assert.equal(ap.body.data.aprobado_por_nombre, 'Mariana Ledesma');
  });

  test('la jefa tampoco aprueba una OC que pidió ella', async () => {
    const proveedor = (await query("SELECT id FROM proveedores WHERE razon_social = 'Gases Industriales Sur S.A.'"))[0].id;
    const r = await api().post('/api/v1/ordenes-compra').set(como('mariana')).send({ proveedor_id: proveedor, items: [{ descripcion: 'Recarga de gas', cantidad: 1, precio_unitario: 48000 }] });
    await api().post(`/api/v1/ordenes-compra/${r.body.data.id}/enviar-aprobacion`).set(como('mariana'));
    assert.equal((await api().post(`/api/v1/ordenes-compra/${r.body.data.id}/aprobar`).set(como('mariana'))).status, 403);
    const c = await api().post(`/api/v1/ordenes-compra/${r.body.data.id}/cancelar`).set(como('mariana')).send({ comentario: 'Prueba' });
    assert.equal(c.body.data.estado, 'cancelada');
  });

  test('recepción parcial y total: entra al depósito, recalcula el costo y avisa a la OT', async () => {
    const oc = (await api().get(`/api/v1/ordenes-compra/${ocId}`).set(como('ruben'))).body.data;
    const item = oc.items[0].id;
    await api().post(`/api/v1/ordenes-compra/${ocId}/enviar`).set(como('gabriel'));

    assert.equal((await api().post(`/api/v1/ordenes-compra/${ocId}/recibir`).set(como('ruben')).send({ deposito_id: depositos['DEP-MP'], items: [{ item_id: item, cantidad: 11 }] })).status, 422);
    const p1 = await api().post(`/api/v1/ordenes-compra/${ocId}/recibir`).set(como('ruben'))
      .send({ deposito_id: depositos['DEP-MP'], remito: 'R 0001-00012345', items: [{ item_id: item, cantidad: 4 }] });
    assert.equal(p1.status, 200, JSON.stringify(p1.body));
    assert.equal(p1.body.data.estado, 'recibida_parcial');
    assert.equal(p1.body.data.recepciones[0].observacion, 'Remito R 0001-00012345');

    // Había 1 a $1000; entran 4 a $1200 → promedio (1000 + 4800) / 5 = 1160.
    const p = await stockDe(productoId);
    assert.equal(p.stock_total, 5);
    assert.equal(p.costo_promedio, 1160);
    assert.equal(p.en_camino, 6);

    const p2 = await api().post(`/api/v1/ordenes-compra/${ocId}/recibir`).set(como('ruben')).send({ deposito_id: depositos['DEP-MP'], items: [{ item_id: item, cantidad: 6 }] });
    assert.equal(p2.body.data.estado, 'recibida');
    assert.equal((await api().post(`/api/v1/ordenes-compra/${ocId}/recibir`).set(como('ruben')).send({ deposito_id: depositos['DEP-MP'], items: [{ item_id: item, cantidad: 1 }] })).status, 422);

    const aviso = await query("SELECT titulo FROM notificaciones WHERE usuario_id = ? AND tipo = 'material_recibido' ORDER BY id DESC LIMIT 1", [s.jorge.usuario.id]);
    assert.equal(aviso[0]?.titulo, `Llegó material para ${ot.numero}`);
    // Con el material recibido ya no falta nada para la OT.
    const m = await api().get(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('jorge'));
    assert.equal(m.body.data.find((x) => x.id === reservaId).faltante, 0);
  });

  test('foto del remito en la orden de compra', async () => {
    const r = await api().post('/api/v1/adjuntos').query({ entidad: 'orden_compra', entidad_id: ocId, nombre: 'remito.jpg' })
      .set(como('ruben')).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const l = await api().get('/api/v1/adjuntos').query({ entidad: 'orden_compra', entidad_id: ocId }).set(como('jorge'));
    assert.equal(l.body.data.length, 1);
    assert.equal(l.body.meta.puede_agregar, false);
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'orden_compra', entidad_id: ocId }).set(como('ramon'))).status, 404);
  });
});

describe('escaneo con la cámara', () => {
  test('el QR de la pieza le abre al operario su operación', async () => {
    const r = await api().get('/api/v1/escaneo').query({ codigo: `BC:OT:${ot.numero}` }).set(como('ramon'));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.tipo, 'orden_trabajo');
    assert.ok(r.body.data.tarea_id);
    const j = await api().get('/api/v1/escaneo').query({ codigo: ot.numero.toLowerCase() }).set(como('jorge'));
    assert.equal(j.body.data.id, ot.id);
    assert.equal(j.body.data.tarea_id, null);
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: `BC:OT:${ot.numero}` }).set(como('claudio'))).status, 404);
  });

  test('máquinas y productos; lo que no es un código se rechaza', async () => {
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'BC:MAQ:CNC-02' }).set(como('ramon'))).body.data.tipo, 'maquina');
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'MP-1045-25' }).set(como('ruben'))).body.data.tipo, 'producto');
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'javascript:alert(1)' }).set(como('ruben'))).status, 400);
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'https://sitio-falso.test/login' }).set(como('ruben'))).status, 404);
    assert.equal((await api().get('/api/v1/escaneo').query({ codigo: 'BC:MAQ:CNC-02' })).status, 401);
  });
});

describe('cierre de la OT', () => {
  test('al cancelarla se libera lo reservado que no se usó', async () => {
    const antes = await stockDe(productoId);
    assert.equal(antes.reservado, 3);
    const r = await api().put(`/api/v1/ordenes-trabajo/${ot.id}`).set(como('jorge')).send({ estado: 'cancelada' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const despues = await stockDe(productoId);
    assert.equal(despues.reservado, 0);
    assert.equal(despues.disponible, despues.stock_total);
    const m = await api().get(`/api/v1/ordenes-trabajo/${ot.id}/materiales`).set(como('jorge'));
    assert.equal(m.body.data[0].estado, 'consumida');
    assert.equal(m.body.data[0].cantidad, 2);
    assert.equal(m.body.meta.puede_reservar, false);
  });
});
