import { z } from 'zod';
import { id, texto, textoOpcional, cantidad } from './comunes.js';

export const TIPOS_PRODUCTO = ['materia_prima', 'insumo', 'repuesto', 'producto_terminado', 'herramienta'];
export const TIPOS_MOVIMIENTO = ['ingreso_compra', 'consumo_ot', 'consumo_mantenimiento', 'ajuste_positivo', 'ajuste_negativo',
  'transferencia_salida', 'transferencia_entrada', 'devolucion'];
// Cantidades con hasta 3 decimales, como en DECIMAL(12,3).
const cant = cantidad.multipleOf(0.001, 'Máximo 3 decimales');

const paginado = {
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
};

export const filtroStock = z.object({
  ...paginado,
  q: z.string().trim().max(100).optional(),
  tipo: z.enum(TIPOS_PRODUCTO).optional(),
  categoria_id: id.optional(),
  bajo_minimo: z.enum(['1']).optional(),
}).strict();

export const filtroMovimientos = z.object({
  ...paginado,
  producto_id: id.optional(),
  deposito_id: id.optional(),
  tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
}).strict();

export const ajuste = z.object({
  producto_id: id,
  deposito_id: id,
  tipo: z.enum(['ajuste_positivo', 'ajuste_negativo']),
  cantidad: cant,
  observacion: texto(255, 3),
}).strict();

export const transferencia = z.object({
  producto_id: id,
  desde_deposito_id: id,
  hacia_deposito_id: id,
  cantidad: cant,
  observacion: textoOpcional(255),
}).strict();

// Materiales de una OT
export const reserva = z.object({ producto_id: id, cantidad: cant }).strict();
export const consumo = z.object({
  cantidad: cant,
  deposito_id: id.optional(),
  tarea_id: id.optional(),
  observacion: textoOpcional(255),
}).strict();
export const paramsReserva = z.object({ id, reservaId: id });

export const escaneo = z.object({
  codigo: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9:._\-/]+$/, 'Código inválido'),
}).strict();
