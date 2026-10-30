// Producción y Tareas: órdenes de trabajo, operaciones y tareas asignables.
import { Router } from 'express';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import * as ordenes from '../services/ordenes.js';
import * as tareas from '../services/tareas.js';
import { paramsId } from '../validators/comunes.js';
import * as v from '../validators/produccion.js';

const router = Router();

// ---------------------------------------------------------------- órdenes de trabajo
router.get('/ordenes-trabajo', autenticado, requierePermiso('PROD', 'ver'), validar({ query: v.filtroOt }), async (req, res) => {
  res.json({ ok: true, ...(await ordenes.listar(req.usuario, req.validado.query)) });
});
router.get('/ordenes-trabajo/:id', autenticado, requierePermiso('PROD', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await ordenes.obtener(req.usuario, req.validado.params.id) });
});
router.post('/ordenes-trabajo', autenticado, requierePermiso('PROD', 'crear'), validar({ body: v.ordenTrabajo }), async (req, res) => {
  res.status(201).json({ ok: true, data: await ordenes.crear(req.usuario, req.permiso, req.validado.body, req) });
});
router.put('/ordenes-trabajo/:id', autenticado, requierePermiso('PROD', 'editar'), validar({ params: paramsId, body: v.ordenTrabajoEditar }), async (req, res) => {
  res.json({ ok: true, data: await ordenes.editar(req.usuario, req.permiso, req.validado.params.id, req.validado.body, req) });
});
router.post('/ordenes-trabajo/:id/operaciones', autenticado, requierePermiso('PROD', 'editar'), validar({ params: paramsId, body: v.operacion }), async (req, res) => {
  res.status(201).json({ ok: true, data: await tareas.crearOperacion(req.usuario, req.validado.params.id, req.validado.body, req) });
});

// ---------------------------------------------------------------- tareas
router.get('/tareas', autenticado, requierePermiso('TAR', 'ver'), validar({ query: v.filtroTareas }), async (req, res) => {
  res.json({ ok: true, ...(await tareas.listar(req.usuario, req.validado.query)) });
});
// Antes de /tareas/:id para que "destinos" no se tome como un id.
router.get('/tareas/destinos', autenticado, requierePermiso('TAR', 'crear'), validar({ query: v.destinosTarea }), async (req, res) => {
  res.json({ ok: true, data: await tareas.destinos(req.usuario, req.validado.query) });
});
router.get('/tareas/:id', autenticado, requierePermiso('TAR', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await tareas.obtener(req.usuario, req.validado.params.id) });
});
router.post('/tareas', autenticado, requierePermiso('TAR', 'crear'), validar({ body: v.tarea }), async (req, res) => {
  res.status(201).json({ ok: true, data: await tareas.crear(req.usuario, req.validado.body, req) });
});
router.put('/tareas/:id', autenticado, requierePermiso('TAR', 'editar'), validar({ params: paramsId, body: v.tareaEditar }), async (req, res) => {
  res.json({ ok: true, data: await tareas.editar(req.usuario, req.validado.params.id, req.validado.body, req) });
});

// Asignación (jefe del área)
router.get('/tareas/:id/candidatos', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await tareas.candidatos(req.usuario, req.validado.params.id) });
});
router.post('/tareas/:id/asignaciones', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: paramsId, body: v.asignacion }), async (req, res) => {
  res.status(201).json({ ok: true, data: await tareas.asignar(req.usuario, req.validado.params.id, req.validado.body.empleado_id, req) });
});
router.delete('/tareas/:id/asignaciones/:empleadoId', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: v.paramsAsignacion }), async (req, res) => {
  res.json({ ok: true, data: await tareas.desasignar(req.usuario, req.validado.params.id, req.validado.params.empleadoId, req) });
});

// Avance (personas asignadas)
router.post('/tareas/:id/iniciar', autenticado, requierePermiso('TAR', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await tareas.iniciar(req.usuario, req.validado.params.id, req) });
});
router.post('/tareas/:id/pausar', autenticado, requierePermiso('TAR', 'ver'), validar({ params: paramsId }), async (req, res) => {
  res.json({ ok: true, data: await tareas.pausar(req.usuario, req.validado.params.id, req) });
});
router.post('/tareas/:id/terminar', autenticado, requierePermiso('TAR', 'ver'), validar({ params: paramsId, body: v.conComentario }), async (req, res) => {
  res.json({ ok: true, data: await tareas.terminar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});

// Revisión (jefe del área)
router.post('/tareas/:id/aprobar', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: paramsId, body: v.conComentario }), async (req, res) => {
  res.json({ ok: true, data: await tareas.aprobar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});
router.post('/tareas/:id/rechazar', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: paramsId, body: v.conMotivo }), async (req, res) => {
  res.json({ ok: true, data: await tareas.rechazar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});
router.post('/tareas/:id/cancelar', autenticado, requierePermiso('TAR', 'aprobar'), validar({ params: paramsId, body: v.conComentario }), async (req, res) => {
  res.json({ ok: true, data: await tareas.cancelar(req.usuario, req.validado.params.id, req.validado.body.comentario, req) });
});

// Comentarios y lista de control
router.post('/tareas/:id/comentarios', autenticado, requierePermiso('TAR', 'ver'), validar({ params: paramsId, body: v.comentario }), async (req, res) => {
  res.status(201).json({ ok: true, data: await tareas.comentar(req.usuario, req.validado.params.id, req.validado.body.texto, req) });
});
router.post('/tareas/:id/checklist', autenticado, requierePermiso('TAR', 'editar'), validar({ params: paramsId, body: v.itemChecklist }), async (req, res) => {
  res.status(201).json({ ok: true, data: await tareas.agregarItem(req.usuario, req.validado.params.id, req.validado.body.texto) });
});
router.put('/tareas/:id/checklist/:itemId', autenticado, requierePermiso('TAR', 'ver'), validar({ params: v.paramsChecklist, body: v.marcarChecklist }), async (req, res) => {
  res.json({ ok: true, data: await tareas.marcarItem(req.usuario, req.validado.params.id, req.validado.params.itemId, req.validado.body.hecho) });
});

export default router;
