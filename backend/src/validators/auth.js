import { z } from 'zod';
import { email, password, nombrePersona } from './comunes.js';

export const registro = z.object({
  email,
  password,
  nombre: nombrePersona,
  apellido: nombrePersona,
}).strict();

export const login = z.object({
  email,
  // En el login no se aplican las reglas de formato (solo el límite), para no dar pistas.
  password: z.string().min(1, 'Ingresá tu contraseña').max(200),
}).strict();

export const refresh = z.object({
  refreshToken: z.string().min(20).max(200),
}).strict();

const codigoSeisDigitos = z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 dígitos');

export const codigoEmail = z.object({ codigo: codigoSeisDigitos }).strict();

export const olvide = z.object({ email }).strict();

export const restablecer = z.object({
  email,
  codigo: codigoSeisDigitos,
  nueva: password,
}).strict();

// Acepta un código TOTP (6 dígitos) o uno de respaldo (XXXX-XXXX), más la contraseña actual
// (obligatoria si la cuenta tiene; la exige el servicio).
export const segundoFactor = z.object({
  codigo: z.string().trim().min(6).max(12),
  password: z.string().max(200).optional(),
}).strict();

export const totpActivar = z.object({ codigo: codigoSeisDigitos }).strict();

export const dosPasosEmail = z.object({ tokenTemporal: z.string().min(20).max(1000) }).strict();

export const dosPasosVerificar = z.object({
  tokenTemporal: z.string().min(20).max(1000),
  metodo: z.enum(['totp', 'email', 'respaldo']),
  codigo: z.string().trim().min(6).max(12),
}).strict();

export const proveedorSocial = z.object({ proveedor: z.enum(['google', 'github', 'facebook']) });

export const datosSocial = {
  google: z.object({ idToken: z.string().min(100).max(4096) }).strict(),
  github: z.object({
    code: z.string().min(10).max(200),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/, 'code_verifier PKCE inválido'),
    redirectUri: z.string().max(200),
  }).strict(),
  facebook: z.object({ accessToken: z.string().min(20).max(1024) }).strict(),
};

export const cambioPassword = z.object({
  actual: z.string().max(200).optional(),
  nueva: password,
}).strict();
