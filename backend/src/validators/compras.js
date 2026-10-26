import { z } from 'zod';
import { id, texto, textoOpcional, fecha, importe, cantidad } from './comunes.js';

export const ESTADOS_OC = ['borrador', 'pendiente_aprobacion', 'aprobada', 'enviada', 'recibida_parcial', 'recibida', 'cancelada'];
const cant = cantidad.multipleOf(0.001, 'Máximo 3 decimales');
const opcional = (e) => e.nullable().optional();

const item = z.object({
  producto_id: opcional(id),
  descripcion: textoOpcional(200),
  cantidad: cant,
  precio_unitario: importe,
  iva_alicuota: z.coerce.number().refine((v) => [0, 10.5, 21, 27].includes(v), 'Alícuota de IVA: 0, 10,5, 21 o 27').optional(),
}).strict();

const ocBase = z.object({
  proveedor_id: id,
  orden_trabajo_id: opcional(id),
  fecha_entrega_esperada: opcional(fecha),
  observaciones: textoOpcional(2000),
  items: z.array(item).min(1, 'Agregá al menos un ítem').max(50),
}).strict();

export const ordenCompra = ocBase;
export const ordenCompraEditar = ocBase.partial()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

export const filtroOc = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_OC).optional(),
  proveedor_id: id.optional(),
  orden_trabajo_id: id.optional(),
  abiertas: z.enum(['1']).optional(),
}).strict();

export const recepcion = z.object({
  deposito_id: id,
  remito: z.string().trim().max(30).regex(/^[A-Za-z0-9 -]*$/, 'Solo letras, números y guiones').optional(),
  items: z.array(z.object({ item_id: id, cantidad: cant }).strict()).min(1).max(50),
}).strict();

export const conMotivo = z.object({ comentario: texto(500) }).strict();
export const conComentario = z.object({ comentario: textoOpcional(500) }).strict();
