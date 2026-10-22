// Esquemas de los datos maestros. `.strict()` rechaza campos de más (evita asignación masiva,
// por ejemplo que alguien mande `id` o `activo` donde no corresponde).
import { z } from 'zod';
import { id, texto, textoOpcional, email, importe, booleano, cuit } from './comunes.js';

const codigo = (max) => z.string().trim().toUpperCase().min(1).max(max)
  .regex(/^[A-Z0-9_-]+$/, 'Solo letras, números, guion y guion bajo');
const opcional = (esquema) => esquema.nullable().optional();
const telefono = z.string().trim().max(30).regex(/^[0-9 +()-]*$/, 'Teléfono inválido');
const condicionIva = z.enum(['RI', 'MONOTRIBUTO', 'CF', 'EXENTO']);

export const area = z.object({
  codigo: codigo(10),
  nombre: texto(80),
  descripcion: textoOpcional(255),
  jefe_empleado_id: opcional(id),
  activo: booleano.optional(),
}).strict();

export const puesto = z.object({
  area_id: id,
  nombre: texto(80),
  descripcion: textoOpcional(255),
  activo: booleano.optional(),
}).strict();

export const habilidad = z.object({
  codigo: codigo(20),
  nombre: texto(80),
  descripcion: textoOpcional(255),
  requiere_certificacion: booleano.optional(),
}).strict();

export const cliente = z.object({
  razon_social: texto(120),
  cuit: opcional(cuit),
  condicion_iva: condicionIva.optional(),
  email: opcional(email),
  telefono: opcional(telefono),
  direccion: textoOpcional(150),
  localidad: textoOpcional(80),
  provincia: textoOpcional(50),
  contacto: textoOpcional(100),
  activo: booleano.optional(),
}).strict();

export const proveedor = z.object({
  razon_social: texto(120),
  cuit: opcional(cuit),
  condicion_iva: condicionIva.optional(),
  rubro: textoOpcional(80),
  email: opcional(email),
  telefono: opcional(telefono),
  direccion: textoOpcional(150),
  contacto: textoOpcional(100),
  tercerizado: booleano.optional(),
  activo: booleano.optional(),
}).strict();

export const servicio = z.object({
  codigo: codigo(20),
  nombre: texto(80),
  descripcion: textoOpcional(255),
  tipo_centro: textoOpcional(20),
  tercerizado: booleano.optional(),
  precio_hora_referencia: opcional(importe),
  activo: booleano.optional(),
}).strict();

export const categoriaProducto = z.object({ nombre: texto(60) }).strict();

export const deposito = z.object({
  codigo: codigo(10),
  nombre: texto(80),
  ubicacion: textoOpcional(120),
  activo: booleano.optional(),
}).strict();

export const producto = z.object({
  codigo: codigo(20),
  nombre: texto(120),
  descripcion: textoOpcional(255),
  categoria_id: opcional(id),
  tipo: z.enum(['materia_prima', 'insumo', 'repuesto', 'producto_terminado', 'herramienta']),
  unidad: z.enum(['un', 'kg', 'm', 'm2', 'l', 'rollo', 'tubo', 'caja']).optional(),
  costo_promedio: importe.optional(),
  precio_venta: opcional(importe),
  stock_minimo: z.coerce.number().min(0).max(999999999.999).optional(),
  activo: booleano.optional(),
}).strict();

export const TIPOS_CENTRO = ['diseno', 'impresion_3d', 'torno', 'cnc', 'soldadura_mig', 'soldadura_tig',
  'herreria', 'corte', 'plegado', 'terminacion', 'montaje', 'servicio_planta'];

export const centroTrabajo = z.object({
  codigo: codigo(10),
  nombre: texto(80),
  tipo: z.enum(TIPOS_CENTRO),
  area_id: id,
  habilidad_requerida_id: opcional(id),
  costo_hora: importe.optional(),
  estado: z.enum(['operativo', 'mantenimiento', 'fuera_servicio']).optional(),
  marca: textoOpcional(60),
  modelo: textoOpcional(60),
  nro_serie: textoOpcional(60),
  ubicacion: textoOpcional(80),
  activo: booleano.optional(),
}).strict();

// Administración de usuarios: solo estos campos se pueden cambiar desde el panel.
export const usuarioAdmin = z.object({
  rol: z.enum(['ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO']).optional(),
  empleado_id: opcional(id),
  activo: booleano.optional(),
}).strict().refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');
