// Armado de la aplicación Express: el orden de los middlewares importa.
import express from 'express';
import env from './config/env.js';
import rutas from './routes/index.js';
import { subida as subidaAdjuntos } from './routes/adjuntos.js';
import { cabeceras, corsConfigurado, exigirJson } from './middlewares/seguridad.js';
import { limiteGeneral } from './middlewares/limites.js';
import { manejarErrores, rutaNoEncontrada } from './middlewares/errores.js';

// Las respuestas de la API no se cachean (contienen datos personales).
function sinCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('etag', false);

  app.use(cabeceras);
  app.use(corsConfigurado);
  app.use(limiteGeneral);
  // Fotos y archivos: llegan como binario, así que van antes de exigir JSON.
  app.use('/api/v1/adjuntos', sinCache, subidaAdjuntos);
  app.use(exigirJson);
  app.use(express.json({ limit: '100kb' }));

  app.use(sinCache);

  app.use('/api/v1', rutas);

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
