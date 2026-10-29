// Rutas de la API v1.
import { Router } from 'express';
import authRoutes from './auth.js';
import usuariosRoutes from './usuarios.js';
import catalogosRoutes from './catalogos.js';
import rrhhRoutes from './rrhh.js';
import produccionRoutes from './produccion.js';
import adjuntosRoutes from './adjuntos.js';
import inventarioRoutes from './inventario.js';
import comprasRoutes from './compras.js';
import mantenimientoRoutes from './mantenimiento.js';
import ventasRoutes from './ventas.js';
import calidadRoutes from './calidad.js';
import finanzasRoutes from './finanzas.js';
import liquidacionRoutes from './liquidacion.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, data: { estado: 'ok' } }));

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
// rrhh va antes que catalogos: define rutas más específicas (/empleados/:id/habilidades, /asistencias/hoy).
router.use('/', rrhhRoutes);
router.use('/', produccionRoutes);
router.use('/', inventarioRoutes);
router.use('/', comprasRoutes);
router.use('/', mantenimientoRoutes);
router.use('/', ventasRoutes);
router.use('/', calidadRoutes);
router.use('/', finanzasRoutes);
router.use('/', liquidacionRoutes);
router.use('/', adjuntosRoutes);
router.use('/', catalogosRoutes);

export default router;
