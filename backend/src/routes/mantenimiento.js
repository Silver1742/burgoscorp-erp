// Mantenimiento: fallas de máquina, órdenes de mantenimiento y ficha de la máquina (QR).
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as mant from '../services/mantenimiento.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/mantenimiento.js';

const router = Router();
const P = '/ordenes-mantenimiento';

router.get(P, autenticado, requierePermiso('MANT', 'ver'), validar({ query: v.filtroOm }), async (req, res) => {
  res.json({ ok: true, ...(await mant.listar(req.usuario, req.validado.query)) });
});
// Antes de /:id para que "tecnicos" y "planes-proximos" no se tomen como id.
router.get(`${P}/tecnicos`, autenticado, requierePermiso('MANT', 'aprobar'), async (req, res) => {
  res.json({ ok: true, data: await mant.tecnicos() });
});
router.get(`${P}/planes-proximos`, autenticado, requierePermiso('MANT', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await mant.planesProximos() });
});
router.get(`${P}/:id`, autenticado, requierePermiso('MANT', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await mant.obtener(req.usuario, req.validado.params.id) });
});
router.post(P, autenticado, requierePermiso('MANT', 'crear'), validar({ body: v.reporte }), async (req, res) => {
  res.status(201).json({ ok: true, data: await mant.crear(req.usuario, req.validado.body, req) });
});
router.put(`${P}/:id`, autenticado, requierePermiso('MANT', 'editar'), validar({ params: paramsId, body: v.editar }), async (req, res) => {
  res.json({ ok: true, data: await mant.editar(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post(`${P}/:id/estado`, autenticado, requierePermiso('MANT', 'editar'), validar({ params: paramsId, body: v.estado }), async (req, res) => {
  res.json({ ok: true, data: await mant.cambiarEstado(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post(`${P}/:id/repuestos`, autenticado, requierePermiso('MANT', 'editar'), validar({ params: paramsId, body: v.repuesto }), async (req, res) => {
  res.status(201).json({ ok: true, data: await mant.usarRepuesto(req.usuario, req.validado.params.id, req.validado.body, req) });
});

// Todas las máquinas, para elegir en cuál está la falla (Mantenimiento atiende las de toda la planta).
router.get('/maquinas', autenticado, requierePermiso('MANT', 'ver'), validar({ query: v.filtroMaquinas }), async (req, res) => {
  res.json({ ok: true, data: await mant.maquinas(req.validado.query) });
});
router.get('/maquinas/:id', autenticado, requierePermiso('MANT', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await mant.maquina(req.usuario, req.validado.params.id) });
});

export default router;
