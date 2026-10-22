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

export const cambioPassword = z.object({
  actual: z.string().max(200).optional(),
  nueva: password,
}).strict();
