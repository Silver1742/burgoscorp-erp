// Jornada laboral y liquidación de sueldos (módulo Finanzas: Administración, gerencia y el admin).
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import { auditar } from '../services/auditoria.js';
import { jornada, liquidar } from '../services/liquidacion.js';
import { fecha, paramsId } from '../validators/comunes.js';
import { errores } from '../utils/errores.js';
import { hoy } from '../utils/fechas.js';

const router = Router();

const periodo = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  area_id: z.coerce.number().int().positive().optional(),
}).strict();

/** Si no se elige período: desde el 1 del mes hasta hoy. */
function periodoDe(q) {
  const h = hoy();
  return { desde: q.desde ?? `${h.slice(0, 8)}01`, hasta: q.hasta ?? h };
}

router.get('/jornada', autenticado, requierePermiso('FIN', 'ver'), async (req, res) => {
  const j = await jornada();
  res.json({ ok: true, data: { ...j, minuto_entrada: undefined } });
});

router.put('/jornada', autenticado, requierePermiso('FIN', 'editar'), validar({
  body: z.object({
    hora_entrada: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora en formato HH:MM'),
    tolerancia_min: z.coerce.number().int().min(0).max(60),
    horas_diarias: z.coerce.number().min(1).max(12),
    recargo_extra_habil: z.coerce.number().int().min(0).max(200),
    recargo_extra_finde: z.coerce.number().int().min(0).max(200),
  }).strict(),
}), async (req, res) => {
  if (req.permiso.alcance !== 'todo') throw errores.prohibido('La jornada la configura Administración');
  const b = req.validado.body;
  await query(
    `UPDATE jornada_laboral SET hora_entrada = ?, tolerancia_min = ?, horas_diarias = ?, recargo_extra_habil = ?, recargo_extra_finde = ?
     WHERE id = 1`, [`${b.hora_entrada}:00`, b.tolerancia_min, b.horas_diarias, b.recargo_extra_habil, b.recargo_extra_finde]);
  await auditar(req, { accion: 'editar', entidad: 'jornada_laboral', entidadId: 1, detalle: b });
  const j = await jornada();
  res.json({ ok: true, data: { ...j, minuto_entrada: undefined } });
});

// Sueldos de todos (o de un área) en el período. Son datos sensibles: se registra quién los consultó.
router.get('/liquidacion', autenticado, requierePermiso('FIN', 'ver'), validar({ query: periodo }), async (req, res) => {
  const { desde, hasta } = periodoDe(req.validado.query);
  const r = await liquidar({ desde, hasta, areaId: req.validado.query.area_id });
  await auditar(req, { accion: 'consulta_liquidacion', detalle: { desde, hasta, area_id: req.validado.query.area_id ?? null } });
  res.json({ ok: true, data: r });
});

// Una persona, día por día (para revisar sus fichajes, tardanzas y ausencias).
router.get('/liquidacion/:id', autenticado, requierePermiso('FIN', 'ver'),
  validar({ params: paramsId, query: periodo.omit({ area_id: true }) }), async (req, res) => {
    const { desde, hasta } = periodoDe(req.validado.query);
    const r = await liquidar({ desde, hasta, empleadoId: req.validado.params.id, conDetalle: true });
    await auditar(req, { accion: 'consulta_liquidacion', entidad: 'empleado', entidadId: req.validado.params.id, detalle: { desde, hasta } });
    res.json({ ok: true, data: { ...r.empleados[0], desde, hasta, jornada: r.jornada } });
  });

export default router;
