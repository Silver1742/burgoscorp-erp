// Fotos y archivos adjuntos. La subida llega como binario (no JSON), por eso tiene su propio
// router que se monta antes del middleware `exigirJson` (ver app.js).
import express, { Router } from 'express';
import { z } from 'zod';
import { autenticado } from '../middlewares/auth.js';
import { validar } from '../middlewares/validar.js';
import { limiteSubida } from '../middlewares/limites.js';
import { id, paramsId } from '../validators/comunes.js';
import * as adjuntos from '../services/adjuntos.js';
import { AppError } from '../utils/errores.js';

const destino = z.object({
  entidad: z.enum(adjuntos.NOMBRES_ENTIDAD),
  entidad_id: id,
}).strict();
const destinoSubida = destino.extend({ nombre: z.string().max(200).optional() }).strict();

// ---------------------------------------------------------------- subida (binario)
export const subida = Router();

subida.post('/',
  limiteSubida,
  autenticado,
  validar({ query: destinoSubida }),
  // Solo se lee el cuerpo si el Content-Type es uno de los aceptados; igual se verifica la firma.
  (req, res, next) => {
    if (!req.is(adjuntos.TIPOS_ACEPTADOS)) {
      return next(new AppError(415, 'TIPO_NO_SOPORTADO', 'Formato no permitido. Subí una foto (JPG, PNG o WebP) o un PDF.'));
    }
    next();
  },
  express.raw({ type: adjuntos.TIPOS_ACEPTADOS, limit: adjuntos.MAX_BYTES }),
  async (req, res) => {
    const { entidad, entidad_id: entidadId, nombre } = req.validado.query;
    const a = await adjuntos.subir(req.usuario, entidad, entidadId, nombre, req.body, req);
    res.status(201).json({ ok: true, data: a });
  });

// ---------------------------------------------------------------- consulta y borrado
const router = Router();

router.get('/adjuntos', autenticado, validar({ query: destino }), async (req, res) => {
  const { entidad, entidad_id: entidadId } = req.validado.query;
  res.json({ ok: true, ...(await adjuntos.listar(req.usuario, entidad, entidadId)) });
});

router.get('/adjuntos/:id', autenticado, validar({ params: paramsId }), async (req, res) => {
  const { ruta, mime, nombre } = await adjuntos.abrir(req.usuario, req.validado.params.id);
  res.set({
    'Content-Type': mime,
    'Content-Disposition': `inline; filename="archivo"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    'Cache-Control': 'private, no-store',
  });
  res.sendFile(ruta, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ ok: false, error: { codigo: 'NO_ENCONTRADO', mensaje: 'El archivo no existe' } });
  });
});

router.delete('/adjuntos/:id', autenticado, validar({ params: paramsId }), async (req, res) => {
  await adjuntos.borrar(req.usuario, req.validado.params.id, req);
  res.status(204).end();
});

export default router;
