// /api/v1/auth · registro, login, renovación y cierre de sesión.
import { Router } from 'express';
import * as auth from '../services/auth.js';
import * as v from '../validators/auth.js';
import { validar } from '../middlewares/validar.js';
import { autenticar } from '../middlewares/auth.js';
import { limiteAuth, limiteRefresh } from '../middlewares/limites.js';
import { mapaPermisos } from '../services/permisos.js';
import { perfilPublico } from '../services/usuarios.js';

const router = Router();

router.post('/registro', limiteAuth, validar({ body: v.registro }), async (req, res) => {
  const sesion = await auth.registrar(req.validado.body, req);
  res.status(201).json({ ok: true, data: sesion });
});

router.post('/login', limiteAuth, validar({ body: v.login }), async (req, res) => {
  res.json({ ok: true, data: await auth.login(req.validado.body, req) });
});

router.post('/refresh', limiteRefresh, validar({ body: v.refresh }), async (req, res) => {
  res.json({ ok: true, data: await auth.renovar(req.validado.body.refreshToken, req) });
});

// No exige access token: así se puede cerrar sesión aunque el access ya haya vencido.
router.post('/logout', limiteRefresh, validar({ body: v.refresh }), async (req, res) => {
  await auth.logout(req.validado.body.refreshToken, req);
  res.status(204).end();
});

router.post('/logout-todas', autenticar, async (req, res) => {
  await auth.cerrarTodasLasSesiones(req.usuario.id, req);
  res.status(204).end();
});

router.get('/yo', autenticar, async (req, res) => {
  res.json({ ok: true, data: { usuario: perfilPublico(req.usuario), permisos: await mapaPermisos(req.usuario) } });
});

router.put('/password', autenticar, limiteAuth, validar({ body: v.cambioPassword }), async (req, res) => {
  res.json({ ok: true, data: await auth.cambiarPassword(req.usuario.id, req.validado.body, req) });
});

export default router;
