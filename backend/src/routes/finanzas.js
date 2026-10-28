// Finanzas (comprobantes, cobros y pagos) y el tablero de indicadores.
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as finanzas from '../services/finanzas.js';
import * as tablero from '../services/tablero.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/finanzas.js';

const router = Router();
const P = '/comprobantes';

router.get(P, autenticado, requierePermiso('FIN', 'ver'), validar({ query: v.filtroComprobantes }), async (req, res) => {
  res.json({ ok: true, ...(await finanzas.listar(req.validado.query)) });
});
// Antes de /:id para que no se tomen como id.
router.get(`${P}/resumen`, autenticado, requierePermiso('FIN', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await finanzas.resumen() });
});
router.get(`${P}/pendientes`, autenticado, requierePermiso('FIN', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await finanzas.pendientesDeFacturar() });
});
router.get(`${P}/:id`, autenticado, requierePermiso('FIN', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await finanzas.obtener(req.usuario, req.validado.params.id) });
});
router.post(`${P}/factura-venta`, autenticado, requierePermiso('FIN', 'crear'), validar({ body: v.facturaVenta }), async (req, res) => {
  res.status(201).json({ ok: true, data: await finanzas.facturarOt(req.usuario, req.validado.body, req) });
});
router.post(`${P}/factura-compra`, autenticado, requierePermiso('FIN', 'crear'), validar({ body: v.facturaCompra }), async (req, res) => {
  res.status(201).json({ ok: true, data: await finanzas.cargarFacturaCompra(req.usuario, req.validado.body, req) });
});
router.post(`${P}/:id/pagos`, autenticado, requierePermiso('FIN', 'editar'), validar({ params: paramsId, body: v.pago }), async (req, res) => {
  res.status(201).json({ ok: true, data: await finanzas.registrarPago(req.usuario, req.validado.params.id, req.validado.body, req) });
});
router.post(`${P}/:id/anular`, autenticado, requierePermiso('FIN', 'aprobar'), validar({ params: paramsId, body: v.conMotivo }), async (req, res) => {
  res.json({ ok: true, data: await finanzas.anular(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});

router.get('/tablero', autenticado, requierePermiso('TAB', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await tablero.obtener(req.usuario) });
});

export default router;
