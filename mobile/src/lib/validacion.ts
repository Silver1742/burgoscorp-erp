// Validaciones de formulario en la app (las mismas reglas que el servidor, que es quien decide).
export const esEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function errorPassword(v) {
  if (v.length < 10) return 'Mínimo 10 caracteres';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) || !/\d/.test(v)) return 'Tiene que tener letras y números';
  return null;
}

export const esCodigo6 = (v) => /^\d{6}$/.test(v.trim());

export const esNombre = (v) => /^[\p{L} '.-]{1,60}$/u.test(v.trim());
