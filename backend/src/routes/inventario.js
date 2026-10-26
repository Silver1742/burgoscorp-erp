// Inventario, materiales de las OT y escaneo de códigos con la cámara.
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as inventario from '../services/inventario.js';
import * as materiales from '../services/materiales.js';
import * as escaneo from '../services/escaneo.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/inventario.js';

const router = Router();

// ---------------------------------------------------------------- stock
router.get('/inventario/stock', autenticado, requierePermiso('INV', 'ver'), validar({ query: v.filtroStock }), async (req, res) => {
  res.json({ ok: true, ...(await inventario.listarStock(req.validado.query)) });
});
router.get('/inventario/stock/:id', autenticado, requierePermiso('INV', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await inventario.obtenerProducto(req.validado.params.id) });
});
router.get('/inventario/movimientos', autenticado, requierePermiso('INV', 'ver'), validar({ query: v.filtroMovimientos }), async (req, res) => {
  res.json({ ok: true, ...(await inventario.listarMovimientos(req.validado.query)) });
});
// Ajustes y transferencias: solo Abastecimiento (INV "editar" exige el área dueña).
router.post('/inventario/ajustes', autenticado, requierePermiso('INV', 'editar'), validar({ body: v.ajuste }), async (req, res) => {
  res.status(201).json({ ok: true, data: await inventario.ajustar(req.usuario, req.validado.body, req) });
});
router.post('/inventario/transferencias', autenticado, requierePermiso('INV', 'editar'), validar({ body: v.transferencia }), async (req, res) => {
  res.status(201).json({ ok: true, data: await inventario.transferir(req.usuario, req.validado.body, req) });
});

// ---------------------------------------------------------------- materiales de una OT
// El permiso fino (jefe del área / asignado a la OT) se decide en el servicio.
router.get('/ordenes-trabajo/:id/materiales', autenticado, requierePermiso('PROD', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, ...(await materiales.listar(req.usuario, req.validado.params.id)) });
});
router.post('/ordenes-trabajo/:id/materiales', autenticado, requierePermiso('PROD', 'editar'), validar({ params: paramsId, body: v.reserva }), async (req, res) => {
  res.status(201).json({ ok: true, ...(await materiales.reservar(req.usuario, req.validado.params.id, req.validado.body, req)) });
});
router.post('/ordenes-trabajo/:id/materiales/:reservaId/consumir', autenticado, requierePermiso('PROD', 'ver'), validar({ params: v.paramsReserva, body: v.consumo }), async (req, res) => {
  const { id, reservaId } = req.validado.params;
  res.json({ ok: true, ...(await materiales.consumir(req.usuario, id, reservaId, req.validado.body, req)) });
});
router.delete('/ordenes-trabajo/:id/materiales/:reservaId', autenticado, requierePermiso('PROD', 'editar'), validar({ params: v.paramsReserva }), async (req, res) => {
  const { id, reservaId } = req.validado.params;
  res.json({ ok: true, ...(await materiales.liberar(req.usuario, id, reservaId, req)) });
});

// ---------------------------------------------------------------- escaneo
router.get('/escaneo', autenticado, validar({ query: v.escaneo }), async (req, res) => {
  res.json({ ok: true, data: await escaneo.resolver(req.usuario, req.validado.query.codigo) });
});

export default router;
