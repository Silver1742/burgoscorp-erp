// Rutas de la API v1.
import { Router } from 'express';
import authRoutes from './auth.js';
import usuariosRoutes from './usuarios.js';
import catalogosRoutes from './catalogos.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, data: { estado: 'ok' } }));

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/', catalogosRoutes);

export default router;
