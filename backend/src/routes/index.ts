// Rutas de la API v1.
import { Router } from 'express';
import authRoutes from './auth.ts';
import usuariosRoutes from './usuarios.ts';
import catalogosRoutes from './catalogos.ts';
import rrhhRoutes from './rrhh.ts';
import produccionRoutes from './produccion.ts';
import adjuntosRoutes from './adjuntos.ts';
import inventarioRoutes from './inventario.ts';
import comprasRoutes from './compras.ts';
import mantenimientoRoutes from './mantenimiento.ts';
import ventasRoutes from './ventas.ts';
import calidadRoutes from './calidad.ts';
import finanzasRoutes from './finanzas.ts';
import liquidacionRoutes from './liquidacion.ts';
import buscarRoutes from './buscar.ts';
import inicioRoutes from './inicio.ts';

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
router.use('/', buscarRoutes);
router.use('/', inicioRoutes);
router.use('/', adjuntosRoutes);
router.use('/', catalogosRoutes);

export default router;
