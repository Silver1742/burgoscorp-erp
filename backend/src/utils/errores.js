// Error de negocio con código HTTP. El errorHandler lo convierte en respuesta JSON.
export class AppError extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const errores = {
  validacion: (detalles, mensaje = 'Datos inválidos') => new AppError(400, 'VALIDACION', mensaje, detalles),
  noAutenticado: (mensaje = 'Necesitás iniciar sesión') => new AppError(401, 'NO_AUTENTICADO', mensaje),
  prohibido: (mensaje = 'No tenés permiso para realizar esta acción') => new AppError(403, 'PROHIBIDO', mensaje),
  noEncontrado: (mensaje = 'Recurso no encontrado') => new AppError(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (mensaje) => new AppError(409, 'CONFLICTO', mensaje),
  negocio: (mensaje) => new AppError(422, 'REGLA_NEGOCIO', mensaje),
};
