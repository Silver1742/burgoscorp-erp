import { z } from 'zod';
import { id, texto, textoOpcional, email, fecha, importe, nombrePersona, cuit } from './comunes.js';

const opcional = (e) => e.nullable().optional();
const telefono = z.string().trim().max(30).regex(/^[0-9 +()-]*$/, 'Teléfono inválido');

const empleadoBase = z.object({
  legajo: z.string().trim().toUpperCase().regex(/^L\d{4,8}$/, 'Formato de legajo: L0001'),
  nombre: nombrePersona,
  apellido: nombrePersona,
  dni: z.string().trim().regex(/^\d{7,8}$/, 'DNI de 7 u 8 dígitos, sin puntos'),
  cuil: opcional(cuit),
  fecha_nacimiento: opcional(fecha),
  telefono: opcional(telefono),
  email_laboral: opcional(email),
  direccion: textoOpcional(150),
  area_id: id,
  puesto_id: opcional(id),
  supervisor_id: opcional(id),
  fecha_ingreso: fecha,
  fecha_egreso: opcional(fecha),
  estado: z.enum(['activo', 'licencia', 'baja']).optional(),
  costo_hora: importe.optional(),
}).strict();

// La regla de fechas va aparte porque zod no permite `.partial()` sobre esquemas con `refine`.
const fechasCoherentes = [
  (d) => !d.fecha_egreso || !d.fecha_ingreso || d.fecha_egreso >= d.fecha_ingreso,
  { message: 'La fecha de egreso no puede ser anterior al ingreso', path: ['fecha_egreso'] },
];
export const empleado = empleadoBase.refine(...fechasCoherentes);
export const empleadoEditar = empleadoBase.partial()
  .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar')
  .refine(...fechasCoherentes);

// Lo único que un empleado puede editar de su propio legajo.
export const CAMPOS_CONTACTO = ['telefono', 'direccion'];

export const habilidadEmpleado = z.object({
  nivel: z.enum(['basico', 'intermedio', 'avanzado']),
  certificado_vence: opcional(fecha),
}).strict();

export const paramsEmpleadoHabilidad = z.object({ id, habilidadId: id });

export const solicitudLicencia = z.object({
  tipo: z.enum(['vacaciones', 'enfermedad', 'estudio', 'personal', 'otro']),
  fecha_desde: fecha,
  fecha_hasta: fecha,
  motivo: textoOpcional(500),
}).strict().refine((d) => d.fecha_hasta >= d.fecha_desde, {
  message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['fecha_hasta'],
});

export const resolucion = z.object({ comentario: textoOpcional(500) }).strict();
export const rechazo = z.object({ comentario: texto(500) }).strict();

export const filtroLicencias = z.object({
  estado: z.enum(['pendiente', 'aprobada_jefe', 'aprobada', 'rechazada', 'cancelada']).optional(),
  empleado_id: id.optional(),
  para_aprobar: z.enum(['1']).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const filtroAsistencias = z.object({
  empleado_id: id.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(31),
}).strict();

export const correccionAsistencia = z.object({
  entrada_at: z.iso.datetime({ offset: true }).optional(),
  salida_at: z.iso.datetime({ offset: true }).nullable().optional(),
  observacion: texto(255),
}).strict();

export const epp = z.object({
  empleado_id: id,
  elemento: texto(80),
  talle: textoOpcional(10),
  cantidad: z.coerce.number().int().min(1).max(1000).optional(),
  fecha_entrega: fecha,
  fecha_vencimiento: opcional(fecha),
}).strict();
