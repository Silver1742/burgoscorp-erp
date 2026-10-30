import { z } from 'zod';
import { id, texto, textoOpcional, fecha, importe, cantidad } from './comunes.js';
import { TIPOS_TRABAJO, PRIORIDADES } from './produccion.js';

const paginado = {
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
};
export const ESTADOS_SOLICITUD = ['nueva', 'en_analisis', 'presupuestada', 'aprobada', 'rechazada', 'cancelada'];
export const ESTADOS_PRESUPUESTO = ['borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'];

export const solicitud = z.object({
  cliente_id: id,
  titulo: texto(120),
  descripcion: textoOpcional(5000),
  tipo_trabajo: z.enum(TIPOS_TRABAJO),
  cantidad: z.coerce.number().int().min(1).max(100000).optional(),
  fecha_requerida: fecha.nullable().optional(),
}).strict();

// Comercial corrige datos, asigna a Ingeniería o la cancela; el resto de los estados los mueve el presupuesto.
export const solicitudEditar = z.object({
  titulo: texto(120).optional(),
  descripcion: textoOpcional(5000),
  cantidad: z.coerce.number().int().min(1).max(100000).optional(),
  fecha_requerida: fecha.nullable().optional(),
  asignada_a: id.optional(),
  estado: z.literal('cancelada').optional(),
}).strict().refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

export const filtroSolicitudes = z.object({
  ...paginado,
  estado: z.enum(ESTADOS_SOLICITUD).optional(),
  abiertas: z.enum(['1']).optional(),
  mias: z.enum(['1']).optional(),
  sin_asignar: z.enum(['1']).optional(),
  cliente_id: id.optional(),
}).strict();

const item = z.object({
  tipo: z.enum(['material', 'mano_obra', 'maquina', 'tercerizado', 'otro']),
  descripcion: texto(200),
  producto_id: id.nullable().optional(),
  centro_trabajo_id: id.nullable().optional(),
  servicio_id: id.nullable().optional(),
  cantidad: cantidad.multipleOf(0.001, 'Máximo 3 decimales'),
  unidad: z.string().trim().min(1).max(10).regex(/^[a-z0-9]+$/i, 'Unidad inválida').optional(),
  precio_unitario: importe,
  iva_alicuota: z.coerce.number().refine((v) => [0, 10.5, 21, 27].includes(v), 'Alícuota de IVA: 0, 10,5, 21 o 27').optional(),
}).strict();

const presupuestoBase = {
  validez_dias: z.coerce.number().int().min(1).max(365).optional(),
  plazo_entrega_dias: z.coerce.number().int().min(1).max(365).nullable().optional(),
  observaciones: textoOpcional(2000),
  items: z.array(item).min(1, 'Agregá al menos un ítem').max(60),
};

export const presupuesto = z.object({ solicitud_id: id.optional(), cliente_id: id.optional(), ...presupuestoBase }).strict()
  .refine((d) => d.solicitud_id || d.cliente_id, { message: 'Indicá la solicitud o el cliente', path: ['cliente_id'] });
export const presupuestoEditar = z.object(presupuestoBase).partial().strict()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

export const filtroPresupuestos = z.object({
  ...paginado,
  estado: z.enum(ESTADOS_PRESUPUESTO).optional(),
  abiertos: z.enum(['1']).optional(),
}).strict();

export const aprobacion = z.object({
  area_id: id,
  prioridad: z.enum(PRIORIDADES).optional(),
  tipo_trabajo: z.enum(TIPOS_TRABAJO).optional(),
  titulo: texto(120).optional(),
}).strict();

export const conMotivo = z.object({ comentario: texto(500) }).strict();
