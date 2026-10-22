// Autorización por módulo y acción. Va siempre después de `autenticar`.
import { resolverPermiso } from '../services/permisos.js';
import { auditar } from '../services/auditoria.js';
import { errores } from '../utils/errores.js';

/**
 * Exige permiso para `accion` en `modulo`. Deja en req.permiso el alcance
 * ('todo' | 'area' | 'propio') para que el controlador filtre las consultas.
 */
export function requierePermiso(modulo, accion) {
  return async (req, res, next) => {
    const permiso = await resolverPermiso(req.usuario, modulo, accion);
    if (!permiso.permitido) {
      await auditar(req, { accion: 'acceso_denegado', detalle: { modulo, accion, ruta: req.originalUrl.slice(0, 100) } });
      return next(errores.prohibido());
    }
    req.permiso = permiso;
    next();
  };
}

/** Restringe a ciertos roles (para operaciones puntuales como administrar usuarios). */
export function soloRoles(...roles) {
  return async (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      await auditar(req, { accion: 'acceso_denegado', detalle: { rolesRequeridos: roles, ruta: req.originalUrl.slice(0, 100) } });
      return next(errores.prohibido());
    }
    next();
  };
}
