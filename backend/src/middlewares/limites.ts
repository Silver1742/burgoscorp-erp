// Límite de peticiones por IP. Las respuestas 429 se auditan como evento de seguridad.
import rateLimit from 'express-rate-limit';
import env from '../config/env.ts';
import { auditar } from '../services/auditoria.ts';

function crearLimite({ ventanaMin, maximo, nombre, saltear }) {
  return rateLimit({
    windowMs: ventanaMin * 60 * 1000,
    limit: env.NODE_ENV === 'test' ? 10_000 : maximo,
    ...(saltear ? { skip: saltear } : {}),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res) {
      auditar(req, { accion: 'rate_limit', detalle: { limite: nombre, ruta: req.originalUrl.slice(0, 100) } });
      res.status(429).json({
        ok: false,
        error: { codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' },
      });
    },
  });
}

// General: en una oficina toda la gente sale a internet por la misma IP, así que el tope tiene que
// alcanzar para varias personas trabajando a la vez. La consulta liviana de "¿hubo cambios?" (cada
// 15 s con la app abierta) no cuenta. Los límites de login y registro siguen siendo estrictos.
export const limiteGeneral = crearLimite({
  ventanaMin: 15, maximo: 3000, nombre: 'general',
  saltear: (req) => req.method === 'GET' && req.path === '/api/v1/cambios',
});
// Login, registro y verificación de códigos: pocos intentos para frenar fuerza bruta.
export const limiteAuth = crearLimite({ ventanaMin: 15, maximo: 15, nombre: 'auth' });
export const limiteRefresh = crearLimite({ ventanaMin: 15, maximo: 60, nombre: 'refresh' });
// Registro: pocas solicitudes por IP y por hora (cada una manda avisos a los administradores).
export const limiteRegistro = crearLimite({ ventanaMin: 60, maximo: 5, nombre: 'registro' });
// Subida de fotos y archivos: frena que alguien llene el disco.
export const limiteSubida = crearLimite({ ventanaMin: 15, maximo: 40, nombre: 'subida' });
