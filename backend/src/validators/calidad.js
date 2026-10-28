import { z } from 'zod';
import { id, texto, textoOpcional } from './comunes.js';

const medida = z.coerce.number().min(-99999999).max(99999999).multipleOf(0.0001, 'Máximo 4 decimales');
const tolerancia = z.coerce.number().min(0).max(99999999).multipleOf(0.0001, 'Máximo 4 decimales');

const medicion = z.object({
  caracteristica: texto(100),
  valor_nominal: medida,
  tolerancia_mas: tolerancia.optional(),
  tolerancia_menos: tolerancia.optional(),
  valor_medido: medida,
  unidad: z.string().trim().min(1).max(10).regex(/^[a-zA-Zµ°%]+$/, 'Unidad inválida').optional(),
}).strict();

export const inspeccion = z.object({
  resultado: z.enum(['aprobada', 'aprobada_con_obs', 'rechazada']),
  cantidad_inspeccionada: z.coerce.number().int().min(1).max(100000).optional(),
  cantidad_rechazada: z.coerce.number().int().min(0).max(100000).optional(),
  observaciones: textoOpcional(1000),
  mediciones: z.array(medicion).max(40).optional(),
  retrabajo_tarea_id: id.optional(),
}).strict()
  .refine((d) => (d.cantidad_rechazada ?? 0) <= (d.cantidad_inspeccionada ?? 1),
    { message: 'No puede haber más rechazadas que inspeccionadas', path: ['cantidad_rechazada'] })
  .refine((d) => d.resultado !== 'rechazada' || d.observaciones,
    { message: 'Contá qué no está conforme', path: ['observaciones'] });

export const filtroInspecciones = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  resultado: z.enum(['aprobada', 'aprobada_con_obs', 'rechazada']).optional(),
  orden_trabajo_id: id.optional(),
}).strict();
