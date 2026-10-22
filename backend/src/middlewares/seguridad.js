// Cabeceras de seguridad, CORS y control de Content-Type.
import helmet from 'helmet';
import cors from 'cors';
import env from '../config/env.js';
import { AppError } from '../utils/errores.js';

// La API solo devuelve JSON: CSP lo más cerrada posible.
export const cabeceras = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-site' },
});

// La app nativa no manda Origin, así que pasa. Navegadores: solo orígenes de CORS_ORIGINS.
export const corsConfigurado = cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'ORIGEN_NO_PERMITIDO', 'Origen no permitido'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

/**
 * Las peticiones con cuerpo deben ser JSON. Evita envíos de formularios
 * HTML entre sitios (CSRF) y que lleguen cuerpos en formatos inesperados.
 * Las rutas de subida de archivos se registran antes de este middleware.
 */
export function exigirJson(req, res, next) {
  const tieneCuerpo = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'];
  if (tieneCuerpo && !req.is('application/json')) {
    return next(new AppError(415, 'TIPO_NO_SOPORTADO', 'El cuerpo debe enviarse como application/json'));
  }
  next();
}
