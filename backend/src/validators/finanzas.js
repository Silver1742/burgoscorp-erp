import { z } from 'zod';
import { id, texto, textoOpcional, fecha, importe, cantidad } from './comunes.js';

export const filtroComprobantes = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  lado: z.enum(['venta', 'compra']).optional(),
  estado: z.enum(['pendiente', 'parcial', 'pagado', 'anulado']).optional(),
  pendientes: z.enum(['1']).optional(),
  vencidos: z.enum(['1']).optional(),
}).strict();

export const facturaVenta = z.object({
  orden_trabajo_id: id,
  dias_vencimiento: z.coerce.number().int().min(0).max(180).optional(),
  // Solo si la OT no tiene presupuesto.
  items: z.array(z.object({
    descripcion: texto(200),
    cantidad: cantidad.multipleOf(0.001, 'Máximo 3 decimales'),
    precio_unitario: importe,
    iva_alicuota: z.coerce.number().refine((v) => [0, 10.5, 21, 27].includes(v), 'Alícuota de IVA: 0, 10,5, 21 o 27').optional(),
  }).strict()).max(60).optional(),
}).strict();

export const facturaCompra = z.object({
  orden_compra_id: id,
  letra: z.enum(['A', 'B', 'C']),
  punto_venta: z.coerce.number().int().min(1).max(99999),
  numero: z.coerce.number().int().min(1).max(99999999),
  fecha: fecha.optional(),
  fecha_vencimiento: fecha.optional(),
}).strict().refine((d) => !d.fecha || !d.fecha_vencimiento || d.fecha_vencimiento >= d.fecha,
  { message: 'El vencimiento no puede ser anterior a la fecha', path: ['fecha_vencimiento'] });

export const pago = z.object({
  monto: importe.refine((v) => v > 0, 'El monto tiene que ser mayor a cero'),
  medio: z.enum(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro']),
  referencia: z.string().trim().max(80).regex(/^[\p{L}0-9 .#/-]*$/u, 'Solo letras, números y . # / -').optional(),
  fecha: fecha.optional(),
}).strict();

export const conMotivo = z.object({ comentario: textoOpcional(500) }).strict();
