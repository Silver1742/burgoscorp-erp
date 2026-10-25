// Rutas de la API v1.
import { Router } from 'express';
import authRoutes from './auth.js';
import usuariosRoutes from './usuarios.js';
import catalogosRoutes from './catalogos.js';
import rrhhRoutes from './rrhh.js';
import produccionRoutes from './produccion.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, data: { estado: 'ok' } }));

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
// rrhh va antes que catalogos: define rutas más específicas (/empleados/:id/habilidades, /asistencias/hoy).
router.use('/', rrhhRoutes);
router.use('/', produccionRoutes);
router.use('/', catalogosRoutes);

export default router;
