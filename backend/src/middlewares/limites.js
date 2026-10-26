// Límite de peticiones por IP. Las respuestas 429 se auditan como evento de seguridad.
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { auditar } from '../services/auditoria.js';

function crearLimite({ ventanaMin, maximo, nombre }) {
  return rateLimit({
    windowMs: ventanaMin * 60 * 1000,
    limit: env.NODE_ENV === 'test' ? 10_000 : maximo,
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

export const limiteGeneral = crearLimite({ ventanaMin: 15, maximo: 600, nombre: 'general' });
// Login, registro y verificación de códigos: pocos intentos para frenar fuerza bruta.
export const limiteAuth = crearLimite({ ventanaMin: 15, maximo: 15, nombre: 'auth' });
export const limiteRefresh = crearLimite({ ventanaMin: 15, maximo: 60, nombre: 'refresh' });
// Subida de fotos y archivos: frena que alguien llene el disco.
export const limiteSubida = crearLimite({ ventanaMin: 15, maximo: 40, nombre: 'subida' });
