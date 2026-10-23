// /api/v1/auth · registro, login, renovación y cierre de sesión.
import { Router } from 'express';
import * as auth from '../services/auth.js';
import * as verificacion from '../services/verificacion.js';
import * as dosPasos from '../services/dosPasos.js';
import * as social from '../services/social.js';
import { errores } from '../utils/errores.js';
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

// ---------------------------------------------------------------- verificación de email

router.post('/email/enviar', autenticar, limiteAuth, async (req, res) => {
  await verificacion.enviarCodigoVerificacion(req.usuario);
  res.json({ ok: true, data: { mensaje: 'Te enviamos un código a tu email' } });
});

router.post('/email/verificar', autenticar, limiteAuth, validar({ body: v.codigoEmail }), async (req, res) => {
  await verificacion.confirmarEmail(req.usuario, req.validado.body.codigo, req);
  res.json({ ok: true, data: { mensaje: 'Email verificado' } });
});

// ---------------------------------------------------------------- recuperación de contraseña

const MENSAJE_OLVIDE = 'Si el email está registrado, te enviamos un código para restablecer la contraseña';

router.post('/password/olvide', limiteAuth, validar({ body: v.olvide }), async (req, res) => {
  await verificacion.solicitarRecuperacion(req.validado.body.email, req);
  res.json({ ok: true, data: { mensaje: MENSAJE_OLVIDE } });
});

router.post('/password/restablecer', limiteAuth, validar({ body: v.restablecer }), async (req, res) => {
  await verificacion.restablecerPassword(req.validado.body, req);
  res.json({ ok: true, data: { mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' } });
});

// ---------------------------------------------------------------- verificación en dos pasos

router.post('/2fa/configurar', autenticar, limiteAuth, async (req, res) => {
  res.json({ ok: true, data: await dosPasos.configurar(req.usuario, req) });
});

router.post('/2fa/activar', autenticar, limiteAuth, validar({ body: v.totpActivar }), async (req, res) => {
  res.json({ ok: true, data: await dosPasos.activar(req.usuario, req.validado.body.codigo, req) });
});

router.post('/2fa/desactivar', autenticar, limiteAuth, validar({ body: v.segundoFactor }), async (req, res) => {
  await dosPasos.desactivar(req.usuario, req.validado.body.codigo, req);
  res.json({ ok: true, data: { mensaje: 'Verificación en dos pasos desactivada' } });
});

router.post('/2fa/codigos-respaldo', autenticar, limiteAuth, validar({ body: v.segundoFactor }), async (req, res) => {
  res.json({ ok: true, data: await dosPasos.regenerarRespaldo(req.usuario, req.validado.body.codigo, req) });
});

// Segundo paso del login (sin sesión todavía: se usa el tokenTemporal que devolvió /login).
router.post('/2fa/email', limiteAuth, validar({ body: v.dosPasosEmail }), async (req, res) => {
  await dosPasos.enviarCodigoLogin(req.validado.body.tokenTemporal);
  res.json({ ok: true, data: { mensaje: 'Te enviamos un código a tu email' } });
});

router.post('/2fa/verificar', limiteAuth, validar({ body: v.dosPasosVerificar }), async (req, res) => {
  res.json({ ok: true, data: await dosPasos.completarLogin(req.validado.body, req) });
});

// ---------------------------------------------------------------- redes sociales

router.get('/social/proveedores', (req, res) => {
  res.json({ ok: true, data: social.proveedoresDisponibles() });
});

router.post('/social/:proveedor', limiteAuth, validar({ params: v.proveedorSocial }), async (req, res, next) => {
  const r = v.datosSocial[req.validado.params.proveedor].safeParse(req.body ?? {});
  if (!r.success) {
    return next(errores.validacion(r.error.issues.map((i) => ({ campo: ['body', ...i.path].join('.'), mensaje: i.message }))));
  }
  res.json({ ok: true, data: await social.loginSocial(req.validado.params.proveedor, r.data, req) });
});

router.delete('/social/:proveedor', autenticar, validar({ params: v.proveedorSocial }), async (req, res) => {
  await social.desvincular(req.usuario, req.validado.params.proveedor, req);
  res.status(204).end();
});

export default router;
