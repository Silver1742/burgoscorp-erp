// Datos maestros de cada módulo, montados sobre el motor CRUD común.
import { Router } from 'express';
import { z } from 'zod';
import { crearRecursoCrud } from '../utils/crud.js';
import { id, booleano } from '../validators/comunes.js';
import * as v from '../validators/catalogos.js';
import { plan } from '../validators/mantenimiento.js';
import { errores } from '../utils/errores.js';
import { hoy, sumarDias } from '../utils/fechas.js';

const router = Router();
const filtroActivo = { activo: { col: 't.activo', esquema: booleano.or(z.enum(['true', 'false']).transform((x) => x === 'true')) } };

// ---------------------------------------------------------------- Organización
router.use('/areas', crearRecursoCrud({
  modulo: 'ORG', tabla: 'areas', entidad: 'area',
  select: "t.*, CONCAT(e.nombre, ' ', e.apellido) AS jefe_nombre",
  joins: 'LEFT JOIN empleados e ON e.id = t.jefe_empleado_id',
  busqueda: ['t.codigo', 't.nombre'],
  filtros: filtroActivo,
  ordenables: { codigo: 't.codigo', nombre: 't.nombre' },
  ordenDefecto: 't.nombre',
  esquemaCrear: v.area,
  bajaLogica: true,
}));

router.use('/puestos', crearRecursoCrud({
  modulo: 'ORG', tabla: 'puestos', entidad: 'puesto',
  select: 't.*, a.nombre AS area_nombre',
  joins: 'JOIN areas a ON a.id = t.area_id',
  busqueda: ['t.nombre'],
  filtros: { ...filtroActivo, area_id: { col: 't.area_id', esquema: id } },
  ordenables: { nombre: 't.nombre', area: 'a.nombre' },
  ordenDefecto: 'a.nombre',
  esquemaCrear: v.puesto,
  bajaLogica: true,
}));

// ---------------------------------------------------------------- RRHH
// El catálogo lo ven todos (para asignar tareas), pero lo modifica solo RRHH: cambiar si una
// habilidad pide certificación cambia a quién se le puede asignar trabajo.
router.use('/habilidades', crearRecursoCrud({
  modulo: 'RRHH', tabla: 'habilidades', entidad: 'habilidad',
  busqueda: ['t.codigo', 't.nombre'],
  ordenables: { codigo: 't.codigo', nombre: 't.nombre' },
  ordenDefecto: 't.nombre',
  esquemaCrear: v.habilidad,
  antesDeGuardar: async (datos, { req }) => {
    if (req.permiso.alcance !== 'todo') throw errores.prohibido('El catálogo de habilidades lo administra RRHH');
    return datos;
  },
}));

// ---------------------------------------------------------------- Ventas
router.use('/clientes', crearRecursoCrud({
  modulo: 'VEN', tabla: 'clientes', entidad: 'cliente',
  busqueda: ['t.razon_social', 't.cuit', 't.contacto', 't.email'],
  filtros: { ...filtroActivo, condicion_iva: { col: 't.condicion_iva', esquema: z.enum(['RI', 'MONOTRIBUTO', 'CF', 'EXENTO']) } },
  ordenables: { razon_social: 't.razon_social', creado: 't.created_at' },
  ordenDefecto: 't.razon_social',
  esquemaCrear: v.cliente,
  bajaLogica: true,
}));

router.use('/servicios', crearRecursoCrud({
  modulo: 'VEN', tabla: 'servicios', entidad: 'servicio',
  busqueda: ['t.codigo', 't.nombre'],
  filtros: filtroActivo,
  ordenables: { codigo: 't.codigo', nombre: 't.nombre' },
  ordenDefecto: 't.nombre',
  esquemaCrear: v.servicio,
  bajaLogica: true,
}));

// ---------------------------------------------------------------- Compras
router.use('/proveedores', crearRecursoCrud({
  modulo: 'COM', tabla: 'proveedores', entidad: 'proveedor',
  busqueda: ['t.razon_social', 't.cuit', 't.rubro'],
  filtros: { ...filtroActivo, tercerizado: { col: 't.tercerizado', esquema: z.enum(['0', '1']).transform(Number) } },
  ordenables: { razon_social: 't.razon_social', rubro: 't.rubro' },
  ordenDefecto: 't.razon_social',
  esquemaCrear: v.proveedor,
  bajaLogica: true,
}));

// ---------------------------------------------------------------- Inventario
router.use('/categorias-producto', crearRecursoCrud({
  modulo: 'INV', tabla: 'categorias_producto', entidad: 'categoria_producto',
  busqueda: ['t.nombre'],
  ordenables: { nombre: 't.nombre' },
  ordenDefecto: 't.nombre',
  esquemaCrear: v.categoriaProducto,
}));

router.use('/depositos', crearRecursoCrud({
  modulo: 'INV', tabla: 'depositos', entidad: 'deposito',
  busqueda: ['t.codigo', 't.nombre'],
  filtros: filtroActivo,
  ordenables: { codigo: 't.codigo', nombre: 't.nombre' },
  ordenDefecto: 't.codigo',
  esquemaCrear: v.deposito,
  bajaLogica: true,
}));

router.use('/productos', crearRecursoCrud({
  modulo: 'INV', tabla: 'productos', entidad: 'producto',
  select: `t.*, c.nombre AS categoria_nombre,
           COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.producto_id = t.id), 0) AS stock_total`,
  joins: 'LEFT JOIN categorias_producto c ON c.id = t.categoria_id',
  busqueda: ['t.codigo', 't.nombre'],
  filtros: {
    ...filtroActivo,
    categoria_id: { col: 't.categoria_id', esquema: id },
    tipo: { col: 't.tipo', esquema: z.enum(['materia_prima', 'insumo', 'repuesto', 'producto_terminado', 'herramienta']) },
  },
  ordenables: { codigo: 't.codigo', nombre: 't.nombre', costo: 't.costo_promedio' },
  ordenDefecto: 't.nombre',
  esquemaCrear: v.producto,
  bajaLogica: true,
}));

// ---------------------------------------------------------------- Producción
router.use('/centros-trabajo', crearRecursoCrud({
  modulo: 'PROD', tabla: 'centros_trabajo', entidad: 'centro_trabajo',
  select: 't.*, a.nombre AS area_nombre, h.nombre AS habilidad_nombre',
  joins: 'JOIN areas a ON a.id = t.area_id LEFT JOIN habilidades h ON h.id = t.habilidad_requerida_id',
  busqueda: ['t.codigo', 't.nombre', 't.marca', 't.modelo'],
  filtros: {
    ...filtroActivo,
    area_id: { col: 't.area_id', esquema: id },
    tipo: { col: 't.tipo', esquema: z.enum(v.TIPOS_CENTRO) },
    estado: { col: 't.estado', esquema: z.enum(['operativo', 'mantenimiento', 'fuera_servicio']) },
  },
  ordenables: { codigo: 't.codigo', nombre: 't.nombre', area: 'a.nombre' },
  ordenDefecto: 't.codigo',
  esquemaCrear: v.centroTrabajo,
  bajaLogica: true,
  alcance: { areaCol: 't.area_id', areaCampo: 'area_id' },
}));

// ---------------------------------------------------------------- Mantenimiento
// Los planes preventivos los arma el área de Mantenimiento; los demás los consultan.
router.use('/planes-mantenimiento', crearRecursoCrud({
  modulo: 'MANT', tabla: 'planes_mantenimiento', entidad: 'plan_mantenimiento',
  select: 't.*, ct.codigo AS centro_codigo, ct.nombre AS centro_nombre',
  joins: 'JOIN centros_trabajo ct ON ct.id = t.centro_trabajo_id',
  busqueda: ['t.nombre', 'ct.codigo', 'ct.nombre'],
  filtros: { ...filtroActivo, centro_trabajo_id: { col: 't.centro_trabajo_id', esquema: id } },
  ordenables: { proxima: 't.proxima_fecha', nombre: 't.nombre' },
  ordenDefecto: 't.proxima_fecha',
  esquemaCrear: plan,
  bajaLogica: true,
  antesDeGuardar: async (datos, { req, id: existente }) => {
    if (req.usuario.rol !== 'ADMIN' && !req.permiso.esDuenia) throw errores.prohibido('Los planes preventivos los administra Mantenimiento');
    if (!existente && !datos.proxima_fecha) return { ...datos, proxima_fecha: sumarDias(hoy(), datos.frecuencia_dias) };
    return datos;
  },
}));

export default router;
