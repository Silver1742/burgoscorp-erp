// Valida body, params y query con esquemas zod.
// El resultado limpio queda en req.validado = { body, params, query }.
import { errores } from '../utils/errores.js';

export function validar({ body, params, query } = {}) {
  return (req, res, next) => {
    const detalles = [];
    const validado = {};

    for (const [parte, esquema] of Object.entries({ body, params, query })) {
      if (!esquema) continue;
      const r = esquema.safeParse(req[parte] ?? {});
      if (r.success) {
        validado[parte] = r.data;
      } else {
        for (const issue of r.error.issues) {
          detalles.push({ campo: [parte, ...issue.path].join('.'), mensaje: issue.message });
        }
      }
    }

    if (detalles.length) return next(errores.validacion(detalles));
    req.validado = validado;
    next();
  };
}
