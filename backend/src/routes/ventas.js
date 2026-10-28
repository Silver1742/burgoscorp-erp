// Ventas: solicitudes del cliente, presupuestos y su aprobación (que crea la OT).
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as ventas from '../services/ventas.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/ventas.js';

const router = Router();

// ---------------------------------------------------------------- solicitudes
router.get('/solicitudes', autenticado, requierePermiso('VEN', 'ver'), validar({ query: v.filtroSolicitudes }), async (req, res) => {
  res.json({ ok: true, ...(await ventas.listarSolicitudes(req.usuario, req.validado.query)) });
});
router.get('/solicitudes/analistas', autenticado, requierePermiso('VEN', 'editar'), async (req, res) => {
  res.json({ ok: true, data: await ventas.analistas() });
});
router.get('/solicitudes/:id', autenticado, requierePermiso('VEN', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await ventas.obtenerSolicitud(req.usuario, req.validado.params.id) });
});
router.post('/solicitudes', autenticado, requierePermiso('VEN', 'crear'), validar({ body: v.solicitud }), async (req, res) => {
  res.status(201).json({ ok: true, data: await ventas.crearSolicitud(req.usuario, req.validado.body, req) });
});
router.put('/solicitudes/:id', autenticado, requierePermiso('VEN', 'editar'), validar({ params: paramsId, body: v.solicitudEditar }), async (req, res) => {
  res.json({ ok: true, data: await ventas.editarSolicitud(req.usuario, req.validado.params.id, req.validado.body, req) });
});

// ---------------------------------------------------------------- presupuestos
router.get('/presupuestos', autenticado, requierePermiso('VEN', 'ver'), validar({ query: v.filtroPresupuestos }), async (req, res) => {
  res.json({ ok: true, ...(await ventas.listarPresupuestos(req.validado.query)) });
});
router.get('/presupuestos/:id', autenticado, requierePermiso('VEN', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await ventas.obtenerPresupuesto(req.usuario, req.validado.params.id) });
});
router.post('/presupuestos', autenticado, requierePermiso('VEN', 'crear'), validar({ body: v.presupuesto }), async (req, res) => {
  res.status(201).json({ ok: true, data: await ventas.crearPresupuesto(req.usuario, req.validado.body, req) });
});
router.put('/presupuestos/:id', autenticado, requierePermiso('VEN', 'editar'), validar({ params: paramsId, body: v.presupuestoEditar }), async (req, res) => {
  res.json({ ok: true, data: await ventas.editarPresupuesto(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post('/presupuestos/:id/enviar', autenticado, requierePermiso('VEN', 'editar'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await ventas.enviarPresupuesto(req.usuario, req.validado.params.id, req) });
});
// El cliente respondió: lo registra el jefe (Comercial o Ingeniería).
router.post('/presupuestos/:id/aprobar', autenticado, requierePermiso('VEN', 'aprobar'), validar({ params: paramsId, body: v.aprobacion }), async (req, res) => {
  res.json({ ok: true, data: await ventas.aprobarPresupuesto(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post('/presupuestos/:id/rechazar', autenticado, requierePermiso('VEN', 'aprobar'), validar({ params: paramsId, body: v.conMotivo }), async (req, res) => {
  res.json({ ok: true, data: await ventas.rechazarPresupuesto(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});

export default router;
