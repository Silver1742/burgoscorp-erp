// Lo que muestra Inicio:
//  - Tablón de avisos: lo publican el jefe (para su área) y el administrador (para toda la empresa
//    o un área). Cada persona ve los avisos generales y los de su área, sin los vencidos.
//  - Pendientes: todo lo que espera una decisión de quien entra, en un solo lugar.
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db.js';
import { autenticado } from '../middlewares/auth.js';
import { validar } from '../middlewares/validar.js';
import { errores } from '../utils/errores.js';
import { hoy } from '../utils/fechas.js';
import { auditar } from '../services/auditoria.js';
import { notificar } from '../services/notificaciones.js';
import { resolverPermiso } from '../services/permisos.js';
import * as tareas from '../services/tareas.js';
import * as licencias from '../services/licencias.js';
import * as compras from '../services/compras.js';
import * as adjuntos from '../services/adjuntos.js';
import { puedeEditar, veTodos } from '../services/tablon.js';
import { id, paramsId, fecha } from '../validators/comunes.js';
import { versionCambios } from '../middlewares/cambios.js';

const router = Router();

// ---------------------------------------------------------------- tablón

const aviso = z.object({
  titulo: z.string().trim().min(1, 'Escribí un título').max(120),
  texto: z.string().trim().min(1, 'Escribí el aviso').max(2000),
  area_id: id.nullable().optional(), // null = toda la empresa (solo el administrador)
  fijado: z.boolean().optional(),
  importante: z.boolean().optional(),
  vence_el: fecha.nullable().optional(),
}).strict();
const avisoEditar = aviso.partial().refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');

/** Quién puede publicar y dónde: el administrador en cualquier área o en toda la empresa; el jefe, en la suya. */
function areaPermitida(usuario, areaId) {
  if (usuario.rol === 'ADMIN') return areaId ?? null;
  if (usuario.rol === 'JEFE' && usuario.area_id) {
    if (areaId && areaId !== usuario.area_id) throw errores.prohibido('Solo podés publicar en el tablón de tu área');
    return usuario.area_id;
  }
  throw errores.prohibido('Publican en el tablón los jefes de área y el administrador');
}

router.get('/tablon', autenticado, async (req, res) => {
  const u = req.usuario;
  // Gerencia y el administrador ven todos; el resto, los generales y los de su área.
  const deTodos = veTodos(u);
  const filas = await query(`
    SELECT t.id, t.titulo, t.texto, t.area_id, a.nombre AS area_nombre, t.fijado, t.importante, t.vence_el,
           t.autor_id, CONCAT(au.nombre, ' ', au.apellido) AS autor, t.created_at, t.updated_at,
           EXISTS (SELECT 1 FROM avisos_leidos l WHERE l.aviso_id = t.id AND l.usuario_id = ?) AS leido
    FROM avisos_tablon t
    LEFT JOIN areas a ON a.id = t.area_id
    JOIN usuarios au ON au.id = t.autor_id
    WHERE (t.vence_el IS NULL OR t.vence_el >= ?) AND (? OR t.area_id IS NULL OR t.area_id = ?)
    ORDER BY t.fijado DESC, t.created_at DESC, t.id DESC LIMIT 30`, [u.id, hoy(), deTodos ? 1 : 0, u.area_id ?? 0]);
  // Las imágenes de cada aviso (solo id y tipo: el archivo se pide aparte, con el mismo control de acceso).
  const imagenes = filas.length ? await query(
    `SELECT id, entidad_id, mime FROM adjuntos WHERE entidad = 'aviso' AND entidad_id IN (${filas.map(() => '?').join(', ')})
     ORDER BY created_at, id`, filas.map((f) => f.id)) : [];
  res.json({
    ok: true,
    data: filas.map((f) => ({ ...f, imagenes: imagenes.filter((i) => i.entidad_id === f.id).map(({ id: idImg, mime }) => ({ id: idImg, mime })), fijado: Boolean(f.fijado), importante: Boolean(f.importante), leido: Boolean(f.leido), puede_editar: puedeEditar(u, f) })),
    meta: { puede_publicar: u.rol === 'ADMIN' || (u.rol === 'JEFE' && Boolean(u.area_id)) },
  });
});

router.post('/tablon', autenticado, validar({ body: aviso }), async (req, res) => {
  const u = req.usuario;
  const d = req.validado.body;
  const areaId = areaPermitida(u, d.area_id);
  const r = await query(
    `INSERT INTO avisos_tablon (titulo, texto, area_id, fijado, importante, vence_el, autor_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [d.titulo, d.texto, areaId, d.fijado ? 1 : 0, d.importante ? 1 : 0, d.vence_el ?? null, u.id]);
  await auditar(req, { accion: 'crear', entidad: 'aviso_tablon', entidadId: r.insertId });
  // Un aviso importante, además, llega como notificación a quienes lo pueden ver.
  if (d.importante) {
    const destinatarios = await query(`
      SELECT u.id FROM usuarios u LEFT JOIN empleados e ON e.id = u.empleado_id
      WHERE u.activo = 1 AND u.estado_cuenta = 'habilitada' AND u.id <> ? AND (? IS NULL OR e.area_id = ?)`, [u.id, areaId, areaId]);
    await notificar(destinatarios.map((x) => x.id), {
      tipo: 'aviso_tablon', titulo: `Aviso: ${d.titulo}`.slice(0, 120), mensaje: d.texto.slice(0, 200), entidad: 'aviso', entidadId: r.insertId,
    });
  }
  res.status(201).json({ ok: true, data: { id: r.insertId } });
});

router.put('/tablon/:id', autenticado, validar({ params: paramsId, body: avisoEditar }), async (req, res) => {
  const a = await queryOne('SELECT * FROM avisos_tablon WHERE id = ?', [req.validado.params.id]);
  if (!a) throw errores.noEncontrado('El aviso no existe');
  if (!puedeEditar(req.usuario, a)) throw errores.prohibido('Solo quien lo publicó (o el administrador) puede cambiarlo');
  const d = { ...req.validado.body };
  if ('area_id' in d) d.area_id = areaPermitida(req.usuario, d.area_id);
  if ('fijado' in d) d.fijado = d.fijado ? 1 : 0;
  if ('importante' in d) d.importante = d.importante ? 1 : 0;
  const columnas = Object.keys(d);
  await query(`UPDATE avisos_tablon SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...columnas.map((c) => d[c] ?? null), a.id]);
  await auditar(req, { accion: 'editar', entidad: 'aviso_tablon', entidadId: a.id });
  res.json({ ok: true, data: { id: a.id } });
});

router.delete('/tablon/:id', autenticado, validar({ params: paramsId }), async (req, res) => {
  const a = await queryOne('SELECT * FROM avisos_tablon WHERE id = ?', [req.validado.params.id]);
  if (!a) throw errores.noEncontrado('El aviso no existe');
  if (!puedeEditar(req.usuario, a)) throw errores.prohibido('Solo quien lo publicó (o el administrador) puede borrarlo');
  await query('DELETE FROM avisos_tablon WHERE id = ?', [a.id]);
  await adjuntos.borrarDe('aviso', a.id);
  await auditar(req, { accion: 'borrar', entidad: 'aviso_tablon', entidadId: a.id });
  res.status(204).end();
});

router.post('/tablon/:id/leido', autenticado, validar({ params: paramsId }), async (req, res) => {
  await query('INSERT IGNORE INTO avisos_leidos (aviso_id, usuario_id) SELECT id, ? FROM avisos_tablon WHERE id = ?', [req.usuario.id, req.validado.params.id]);
  res.status(204).end();
});

// ---------------------------------------------------------------- cambios

// La app pregunta esto cada tantos segundos: si la versión es otra, recarga lo que está mirando.
router.get('/cambios', autenticado, (req, res) => {
  res.json({ ok: true, data: { version: versionCambios() } });
});

// ---------------------------------------------------------------- pendientes

const POR_GRUPO = 5;

router.get('/pendientes', autenticado, async (req, res) => {
  const u = req.usuario;
  const grupos = [];
  const agregar = (tipo, titulo, total, items) => { if (total) grupos.push({ tipo, titulo, total, items }); };

  if ((await resolverPermiso(u, 'SEG', 'aprobar')).permitido) {
    const filas = await query(`SELECT id, nombre, apellido, email, created_at FROM usuarios
      WHERE estado_cuenta = 'pendiente' ORDER BY created_at DESC LIMIT ${POR_GRUPO}`);
    const [{ n }] = await query("SELECT COUNT(*) AS n FROM usuarios WHERE estado_cuenta = 'pendiente'");
    agregar('acceso', 'Piden acceso', Number(n), filas.map((f) => ({ id: f.id, titulo: `${f.nombre} ${f.apellido}`, sub: f.email })));
  }
  if ((await resolverPermiso(u, 'RRHH', 'aprobar')).permitido) {
    const l = await licencias.listar(u, { para_aprobar: 1, pagina: 1, limite: POR_GRUPO });
    agregar('licencia', 'Licencias por aprobar', l.meta.total, l.data.map((x) => ({
      id: x.id, titulo: `${x.nombre ?? ''} ${x.apellido ?? ''}`.trim() || 'Licencia', sub: `${x.tipo} · ${String(x.fecha_desde).slice(0, 10)} al ${String(x.fecha_hasta).slice(0, 10)}`,
    })));
  }
  if ((await resolverPermiso(u, 'TAR', 'aprobar')).permitido) {
    const sinAsignar = await tareas.listar(u, { sin_asignar: 1, pagina: 1, limite: POR_GRUPO });
    agregar('asignar', 'Tareas para asignar', sinAsignar.meta.total, sinAsignar.data.map((x) => ({ id: x.id, titulo: x.titulo, sub: [x.ot_numero, x.area_nombre].filter(Boolean).join(' · ') })));
    const revisar = await tareas.listar(u, { estado: 'en_revision', pagina: 1, limite: POR_GRUPO });
    agregar('revisar', 'Tareas para revisar', revisar.meta.total, revisar.data.map((x) => ({ id: x.id, titulo: x.titulo, sub: [x.asignados, x.area_nombre].filter(Boolean).join(' · ') })));
  }
  if ((await resolverPermiso(u, 'COM', 'aprobar')).permitido) {
    const oc = await compras.listar({ estado: 'pendiente_aprobacion', pagina: 1, limite: POR_GRUPO });
    agregar('compra', 'Compras por aprobar', oc.meta.total, oc.data.map((x) => ({
      id: x.id, titulo: `${x.numero} · ${x.proveedor_nombre ?? ''}`.trim(), sub: `$ ${Number(x.total ?? 0).toLocaleString('es-AR')}`,
    })));
  }
  res.json({ ok: true, data: grupos });
});

export default router;
