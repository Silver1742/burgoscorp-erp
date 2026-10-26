import { z } from 'zod';
import { id, texto, textoOpcional, importe, cantidad } from './comunes.js';

export const ESTADOS_OM = ['abierta', 'en_curso', 'esperando_repuesto', 'cerrada', 'cancelada'];
const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'];

export const reporte = z.object({
  centro_trabajo_id: id,
  descripcion: texto(1000, 5),
  prioridad: z.enum(PRIORIDADES).optional(),
  detiene_maquina: z.boolean().optional(),
  tipo: z.enum(['correctivo', 'preventivo']).optional(),
  plan_id: id.optional(),
}).strict();

export const editar = z.object({
  responsable_id: id.optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  detiene_maquina: z.boolean().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

export const estado = z.object({
  estado: z.enum(['en_curso', 'esperando_repuesto', 'cerrada', 'cancelada']),
  solucion: textoOpcional(1000),
  costo: importe.optional(),
}).strict();

export const repuesto = z.object({
  producto_id: id,
  cantidad: cantidad.multipleOf(0.001, 'Máximo 3 decimales'),
  deposito_id: id.optional(),
  observacion: textoOpcional(255),
}).strict();

export const filtroOm = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_OM).optional(),
  tipo: z.enum(['correctivo', 'preventivo']).optional(),
  centro_trabajo_id: id.optional(),
  abiertas: z.enum(['1']).optional(),
  mias: z.enum(['1']).optional(),
}).strict();

export const plan = z.object({
  centro_trabajo_id: id,
  nombre: texto(100),
  descripcion: textoOpcional(500),
  frecuencia_dias: z.coerce.number().int().min(1).max(3650),
  proxima_fecha: z.iso.date('Fecha inválida (AAAA-MM-DD)').nullable().optional(),
  activo: z.boolean().optional(),
}).strict();

export const filtroMaquinas = z.object({
  q: z.string().trim().max(100).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
