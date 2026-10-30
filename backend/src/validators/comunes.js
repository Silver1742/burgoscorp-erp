// Piezas de validación reutilizables. Los largos coinciden con las columnas de schema.sql.
import { z } from 'zod';

// Mensajes de zod en castellano (los que no tienen uno propio). Un campo que falta dice
// "Campo obligatorio" en vez del mensaje técnico.
z.config(z.locales.es());
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) return 'Campo obligatorio';
    const { origin, minimum, maximum, inclusive } = issue;
    if (issue.code === 'too_small') {
      if (origin === 'number') return `Tiene que ser ${inclusive ? 'mayor o igual a' : 'mayor a'} ${minimum}`;
      if (origin === 'string') return Number(minimum) <= 1 ? 'Campo obligatorio' : `Mínimo ${minimum} caracteres`;
      if (origin === 'array') return `Agregá al menos ${minimum}`;
    }
    if (issue.code === 'too_big') {
      if (origin === 'number') return `Tiene que ser ${inclusive ? 'menor o igual a' : 'menor a'} ${maximum}`;
      if (origin === 'string') return `Máximo ${maximum} caracteres`;
      if (origin === 'array') return `Como máximo ${maximum}`;
    }
    return undefined;
  },
});

export const id = z.coerce.number().int().positive('Debe ser un id válido').max(4294967295);
export const paramsId = z.object({ id });

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Email inválido'));

// bcrypt solo usa los primeros 72 bytes: se limita para que no haya contraseñas truncadas en silencio.
export const password = z.string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'La contraseña es demasiado larga')
  .refine((v) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) && /\d/.test(v), 'La contraseña debe tener letras y números');

export const texto = (max, min = 1) => z.string().trim().min(min, 'Campo obligatorio').max(max, `Máximo ${max} caracteres`);
export const textoOpcional = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`)
  .transform((v) => (v === '' ? null : v)).nullable().optional();

export const nombrePersona = texto(60).regex(/^[\p{L} '.-]+$/u, 'Solo letras, espacios, apóstrofo, punto o guion');

export const fecha = z.iso.date('Fecha inválida (AAAA-MM-DD)');
export const importe = z.coerce.number().min(0).max(999999999999.99).multipleOf(0.01, 'Máximo 2 decimales');
export const cantidad = z.coerce.number().positive().max(999999999.999);
export const booleano = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);

// CUIT argentino con dígito verificador. Se acepta con o sin guiones y se guarda como XX-XXXXXXXX-X.
export const cuit = z.string().trim().transform((v) => v.replace(/-/g, '')).refine((v) => {
  if (!/^\d{11}$/.test(v)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(v[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(v[10]);
}, 'CUIT inválido').transform((v) => `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}`);

// Listados: paginación, búsqueda y orden.
export const consultaListado = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  orden: z.string().trim().max(40).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
}).catchall(z.string().max(100));
