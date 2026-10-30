import { z } from 'zod';
import { id, texto, textoOpcional, fecha } from './comunes.js';

const opcional = (e) => e.nullable().optional();
export const TIPOS_TRABAJO = ['reparacion', 'fabricacion', 'mecanizado', 'prototipo', 'diseno', 'servicio_planta'];
export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];
export const ESTADOS_OT = ['planificada', 'en_proceso', 'pausada', 'control_calidad', 'terminada', 'entregada', 'cancelada'];
export const ESTADOS_TAREA = ['pendiente', 'en_curso', 'pausada', 'en_revision', 'aprobada', 'rechazada', 'cancelada'];
const fechaHora = z.iso.datetime({ offset: true });

const otBase = z.object({
  cliente_id: opcional(id),
  titulo: texto(120),
  descripcion: textoOpcional(5000),
  tipo_trabajo: z.enum(TIPOS_TRABAJO),
  cantidad: z.coerce.number().int().min(1).max(100000).optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  fecha_inicio_plan: opcional(fecha),
  fecha_entrega_plan: opcional(fecha),
  area_id: id.optional(),
  responsable_id: opcional(id),
}).strict();

const fechasOt = [
  (d) => !d.fecha_inicio_plan || !d.fecha_entrega_plan || d.fecha_entrega_plan >= d.fecha_inicio_plan,
  { message: 'La entrega no puede ser anterior al inicio', path: ['fecha_entrega_plan'] },
];

export const ordenTrabajo = otBase.refine(...fechasOt);
export const ordenTrabajoEditar = otBase.extend({ estado: z.enum(ESTADOS_OT).optional() }).partial()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar')
  .refine(...fechasOt);

export const filtroOt = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_OT).optional(),
  area_id: id.optional(),
  abiertas: z.enum(['1']).optional(),
}).strict();

const tareaBase = {
  titulo: texto(150),
  descripcion: textoOpcional(5000),
  prioridad: z.enum(PRIORIDADES).optional(),
  fecha_limite: opcional(fechaHora),
  horas_estimadas: opcional(z.coerce.number().min(0).max(9999).multipleOf(0.25, 'En cuartos de hora')),
  centro_trabajo_id: opcional(id),
  habilidad_requerida_id: opcional(id),
  checklist: z.array(texto(200)).max(30).optional(),
};

/** Operación de una OT (se convierte en una tarea asignable). */
export const operacion = z.object(tareaBase).strict();

/** Tarea suelta (no ligada a una OT). */
// area_ids: el administrador puede mandar la misma tarea a varias áreas (una tarea por área).
export const tarea = z.object({
  ...tareaBase,
  area_id: id.optional(),
  area_ids: z.array(id).min(1, 'Elegí al menos un área').max(20).optional(),
}).strict();

/** Para sugerir a qué área mandar una tarea nueva. */
export const destinosTarea = z.object({
  centro_trabajo_id: id.optional(),
  habilidad_requerida_id: id.optional(),
}).strict();

export const tareaEditar = z.object(tareaBase).omit({ checklist: true }).partial().strict()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

export const filtroTareas = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_TAREA).optional(),
  abiertas: z.enum(['1']).optional(),
  mias: z.enum(['1']).optional(),
  sin_asignar: z.enum(['1']).optional(),
  orden_trabajo_id: id.optional(),
  area_id: id.optional(),
}).strict();

export const asignacion = z.object({ empleado_id: id }).strict();
export const paramsAsignacion = z.object({ id, empleadoId: id });
export const paramsChecklist = z.object({ id, itemId: id });
export const comentario = z.object({ texto: texto(2000) }).strict();
export const itemChecklist = z.object({ texto: texto(200) }).strict();
export const marcarChecklist = z.object({ hecho: z.boolean() }).strict();
export const conComentario = z.object({ comentario: textoOpcional(500) }).strict();
export const conMotivo = z.object({ comentario: texto(500) }).strict();
