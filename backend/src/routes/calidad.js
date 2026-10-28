// Calidad: OT esperando inspección, inspecciones con mediciones y no conformidades.
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as calidad from '../services/calidad.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/calidad.js';

const router = Router();

router.get('/calidad/pendientes', autenticado, requierePermiso('CAL', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await calidad.pendientes(req.usuario) });
});
router.get('/inspecciones', autenticado, requierePermiso('CAL', 'ver'), validar({ query: v.filtroInspecciones }), async (req, res) => {
  res.json({ ok: true, ...(await calidad.listar(req.usuario, req.validado.query)) });
});
router.get('/inspecciones/:id', autenticado, requierePermiso('CAL', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await calidad.obtener(req.usuario, req.validado.params.id) });
});
// Solo el área de Calidad inspecciona (CAL "crear" exige el área dueña).
router.post('/ordenes-trabajo/:id/inspecciones', autenticado, requierePermiso('CAL', 'crear'), validar({ params: paramsId, body: v.inspeccion }), async (req, res) => {
  res.status(201).json({ ok: true, data: await calidad.inspeccionar(req.usuario, req.validado.params.id, req.validado.body, req) });
});

export default router;
