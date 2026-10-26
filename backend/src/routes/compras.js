// Compras: órdenes de compra, aprobación y recepción en el depósito.
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as compras from '../services/compras.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/compras.js';

const router = Router();
const P = '/ordenes-compra';

router.get(P, autenticado, requierePermiso('COM', 'ver'), validar({ query: v.filtroOc }), async (req, res) => {
  res.json({ ok: true, ...(await compras.listar(req.validado.query)) });
});
router.get(`${P}/:id`, autenticado, requierePermiso('COM', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await compras.obtener(req.usuario, req.validado.params.id) });
});
router.post(P, autenticado, requierePermiso('COM', 'crear'), validar({ body: v.ordenCompra }), async (req, res) => {
  res.status(201).json({ ok: true, data: await compras.crear(req.usuario, req.validado.body, req) });
});
router.put(`${P}/:id`, autenticado, requierePermiso('COM', 'editar'), validar({ params: paramsId, body: v.ordenCompraEditar }), async (req, res) => {
  res.json({ ok: true, data: await compras.editar(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post(`${P}/:id/enviar-aprobacion`, autenticado, requierePermiso('COM', 'editar'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await compras.enviarAprobacion(req.usuario, req.validado.params.id, req) });
});
router.post(`${P}/:id/aprobar`, autenticado, requierePermiso('COM', 'aprobar'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await compras.aprobar(req.usuario, req.validado.params.id, req) });
});
router.post(`${P}/:id/rechazar`, autenticado, requierePermiso('COM', 'aprobar'), validar({ params: paramsId, body: v.conMotivo }), async (req, res) => {
  res.json({ ok: true, data: await compras.rechazar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});
router.post(`${P}/:id/enviar`, autenticado, requierePermiso('COM', 'editar'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await compras.enviar(req.usuario, req.validado.params.id, req) });
});
router.post(`${P}/:id/recibir`, autenticado, requierePermiso('COM', 'editar'), validar({ params: paramsId, body: v.recepcion }), async (req, res) => {
  res.json({ ok: true, data: await compras.recibir(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post(`${P}/:id/cancelar`, autenticado, requierePermiso('COM', 'editar'), validar({ params: paramsId, body: v.conComentario }), async (req, res) => {
  res.json({ ok: true, data: await compras.cancelar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});

export default router;
