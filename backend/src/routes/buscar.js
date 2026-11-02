// GET /api/v1/buscar?q= · búsqueda general: personas, clientes, pedidos, órdenes de trabajo, tareas,
// máquinas, productos, proveedores y usuarios, en una sola caja. Cada grupo aparece solo si el rol
// puede ver ese módulo, y con el mismo alcance que su listado (toda la empresa, su área o lo propio).
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { autenticado } from '../middlewares/auth.js';
import { validar } from '../middlewares/validar.js';
import { resolverPermiso, filtroAlcance } from '../services/permisos.js';
import * as tareas from '../services/tareas.js';

const router = Router();
const POR_GRUPO = 5;

const consulta = z.object({ q: z.string().trim().min(2, 'Escribí al menos 2 letras').max(60) }).strict();

// Columnas, alcance y textos de cada grupo. Los nombres de columna son fijos (nunca vienen del cliente).
const GRUPOS = [
  {
    tipo: 'persona', titulo: 'Personas', modulo: 'RRHH',
    alcance: { areaCol: 'e.area_id', propioCol: 'e.id' },
    sql: `SELECT e.id, CONCAT(e.apellido, ', ', e.nombre) AS titulo,
            CONCAT_WS(' · ', e.legajo, p.nombre, a.nombre) AS sub
          FROM empleados e LEFT JOIN puestos p ON p.id = e.puesto_id LEFT JOIN areas a ON a.id = e.area_id
          WHERE e.estado <> 'baja' AND (CONCAT(e.nombre, ' ', e.apellido) LIKE ? OR CONCAT(e.apellido, ' ', e.nombre) LIKE ? OR e.legajo LIKE ? OR p.nombre LIKE ?)`,
    params: (p) => [p, p, p, p], orden: 'e.apellido, e.nombre',
  },
  {
    tipo: 'cliente', titulo: 'Clientes', modulo: 'VEN',
    sql: `SELECT c.id, c.razon_social AS titulo, CONCAT_WS(' · ', c.cuit, c.localidad, c.contacto) AS sub
          FROM clientes c WHERE c.activo = 1 AND (c.razon_social LIKE ? OR c.cuit LIKE ? OR c.contacto LIKE ?)`,
    params: (p) => [p, p, p], orden: 'c.razon_social',
  },
  {
    tipo: 'pedido', titulo: 'Pedidos de clientes', modulo: 'VEN',
    sql: `SELECT s.id, CONCAT(s.numero, ' · ', s.titulo) AS titulo, CONCAT_WS(' · ', c.razon_social, s.estado) AS sub
          FROM solicitudes s JOIN clientes c ON c.id = s.cliente_id
          WHERE (s.numero LIKE ? OR s.titulo LIKE ? OR c.razon_social LIKE ?)`,
    params: (p) => [p, p, p], orden: 's.id DESC',
  },
  {
    tipo: 'ot', titulo: 'Órdenes de trabajo', modulo: 'PROD',
    alcance: { areaCol: 'o.area_id', propioCol: 'o.responsable_id' },
    sql: `SELECT o.id, CONCAT(o.numero, ' · ', o.titulo) AS titulo, CONCAT_WS(' · ', c.razon_social, a.nombre, o.estado) AS sub
          FROM ordenes_trabajo o LEFT JOIN clientes c ON c.id = o.cliente_id JOIN areas a ON a.id = o.area_id
          WHERE (o.numero LIKE ? OR o.titulo LIKE ? OR c.razon_social LIKE ?)`,
    params: (p) => [p, p, p], orden: 'o.id DESC',
  },
  {
    tipo: 'maquina', titulo: 'Máquinas', modulo: 'PROD',
    alcance: { areaCol: 'ct.area_id' },
    sql: `SELECT ct.id, CONCAT(ct.codigo, ' · ', ct.nombre) AS titulo, CONCAT_WS(' · ', a.nombre, ct.estado) AS sub
          FROM centros_trabajo ct JOIN areas a ON a.id = ct.area_id
          WHERE ct.activo = 1 AND (ct.codigo LIKE ? OR ct.nombre LIKE ? OR ct.marca LIKE ?)`,
    params: (p) => [p, p, p], orden: 'ct.codigo',
  },
  {
    tipo: 'producto', titulo: 'Materiales y productos', modulo: 'INV',
    sql: `SELECT pr.id, pr.nombre AS titulo, CONCAT_WS(' · ', pr.codigo, pr.unidad) AS sub
          FROM productos pr WHERE pr.activo = 1 AND (pr.nombre LIKE ? OR pr.codigo LIKE ?)`,
    params: (p) => [p, p], orden: 'pr.nombre',
  },
  {
    tipo: 'proveedor', titulo: 'Proveedores', modulo: 'COM',
    sql: `SELECT pv.id, pv.razon_social AS titulo, CONCAT_WS(' · ', pv.cuit, pv.rubro) AS sub
          FROM proveedores pv WHERE pv.activo = 1 AND (pv.razon_social LIKE ? OR pv.cuit LIKE ? OR pv.rubro LIKE ?)`,
    params: (p) => [p, p, p], orden: 'pv.razon_social',
  },
  {
    tipo: 'usuario', titulo: 'Cuentas de usuario', modulo: 'SEG',
    sql: `SELECT u.id, CONCAT(u.apellido, ', ', u.nombre) AS titulo, CONCAT_WS(' · ', u.email, r.nombre, u.estado_cuenta) AS sub
          FROM usuarios u JOIN roles r ON r.id = u.rol_id
          WHERE (CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR u.email LIKE ?)`,
    params: (p) => [p, p], orden: 'u.apellido, u.nombre',
  },
];

router.get('/buscar', autenticado, validar({ query: consulta }), async (req, res) => {
  const { q } = req.validado.query;
  const patron = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const grupos = [];

  for (const g of GRUPOS) {
    const permiso = await resolverPermiso(req.usuario, g.modulo, 'ver');
    if (!permiso.permitido) continue;
    const alc = g.alcance ? filtroAlcance(req.usuario, permiso.alcance, g.alcance) : { sql: '1=1', params: [] };
    const items = await query(`${g.sql} AND (${alc.sql}) ORDER BY ${g.orden} LIMIT ${POR_GRUPO}`, [...g.params(patron), ...alc.params]);
    if (items.length) grupos.push({ tipo: g.tipo, titulo: g.titulo, items });
  }

  // Tareas: con el mismo alcance que "Mis tareas" / "Tareas del área".
  const ver = await resolverPermiso(req.usuario, 'TAR', 'ver');
  if (ver.permitido) {
    const t = await tareas.listar(req.usuario, { q, pagina: 1, limite: POR_GRUPO });
    if (t.data.length) {
      grupos.splice(3, 0, {
        tipo: 'tarea', titulo: 'Tareas',
        items: t.data.map((x) => ({ id: x.id, titulo: x.titulo, sub: [x.ot_numero, x.area_nombre, x.estado].filter(Boolean).join(' · ') })),
      });
    }
  }

  res.json({ ok: true, data: { q, grupos } });
});

export default router;
