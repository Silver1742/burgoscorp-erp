// Calidad (módulo CAL, equivalente a SAP QM): inspección final de las OT.
//
//   OT en control_calidad ──▶ inspección con mediciones y fotos
//        ├─ aprobada / aprobada con observaciones ──▶ OT terminada (aviso a Comercial y Finanzas)
//        └─ rechazada (no conformidad) ──▶ la operación elegida vuelve a "para rehacer" y la OT a en_proceso;
//                                          cuando el jefe la aprueba de nuevo, la OT vuelve sola a calidad.
//
// Cada medición es conforme si el valor medido está dentro de nominal −tol/+tol (lo calcula el
// servidor). No se puede aprobar una pieza con mediciones fuera de tolerancia o piezas rechazadas.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuarioJefeDeArea, usuariosDeArea } from './notificaciones.js';

const EPS = 1e-9;
export const conforme = (m) => m.valor_medido >= m.valor_nominal - m.tolerancia_menos - EPS
  && m.valor_medido <= m.valor_nominal + m.tolerancia_mas + EPS;

/** Calidad ve todas las inspecciones; los demás, las de las OT de su área. */
async function condicionAlcance(usuario) {
  const ver = await resolverPermiso(usuario, 'CAL', 'ver');
  if (ver.alcance === 'todo' || ver.esDuenia) return { sql: '1=1', params: [] };
  if (usuario.area_id) return { sql: 'o.area_id = ?', params: [usuario.area_id] };
  return { sql: 'i.inspector_id = ?', params: [usuario.empleado_id ?? 0] };
}

const SELECT = `
  SELECT i.*, CONCAT('INSP-', LPAD(i.id, 4, '0')) AS numero, o.numero AS ot_numero, o.titulo AS ot_titulo, o.area_id,
         c.razon_social AS cliente_nombre, CONCAT(e.nombre, ' ', e.apellido) AS inspector_nombre,
         t.secuencia AS tarea_secuencia, t.titulo AS tarea_titulo
  FROM inspecciones i
  JOIN ordenes_trabajo o ON o.id = i.orden_trabajo_id
  LEFT JOIN clientes c ON c.id = o.cliente_id
  JOIN empleados e ON e.id = i.inspector_id
  LEFT JOIN tareas t ON t.id = i.tarea_id`;

/** OT esperando inspección, con sus operaciones (para elegir cuál rehacer). */
export async function pendientes(usuario) {
  const ver = await resolverPermiso(usuario, 'CAL', 'ver');
  const filtro = ver.alcance === 'todo' || ver.esDuenia ? '1=1' : 'o.area_id = ?';
  const ots = await query(`
    SELECT o.id, o.numero, o.titulo, o.cantidad, o.fecha_entrega_plan, o.prioridad, a.nombre AS area_nombre, c.razon_social AS cliente_nombre,
           (SELECT COUNT(*) FROM inspecciones i WHERE i.orden_trabajo_id = o.id AND i.resultado = 'rechazada') AS rechazos
    FROM ordenes_trabajo o JOIN areas a ON a.id = o.area_id LEFT JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado = 'control_calidad' AND ${filtro}
    ORDER BY FIELD(o.prioridad, 'urgente','alta','media','baja'), o.fecha_entrega_plan IS NULL, o.fecha_entrega_plan`,
  filtro === '1=1' ? [] : [usuario.area_id ?? 0]);
  for (const ot of ots) {
    ot.operaciones = await query(`
      SELECT t.id, t.secuencia, t.titulo, t.estado, ct.codigo AS centro_codigo,
             (SELECT GROUP_CONCAT(CONCAT(e.nombre, ' ', e.apellido) SEPARATOR ', ') FROM tarea_asignaciones ta
                JOIN empleados e ON e.id = ta.empleado_id WHERE ta.tarea_id = t.id) AS asignados
      FROM tareas t LEFT JOIN centros_trabajo ct ON ct.id = t.centro_trabajo_id
      WHERE t.orden_trabajo_id = ? AND t.estado <> 'cancelada' ORDER BY t.secuencia`, [ot.id]);
  }
  return ots;
}

export async function listar(usuario, f) {
  const alc = await condicionAlcance(usuario);
  const where = [alc.sql];
  const params = [...alc.params];
  if (f.resultado) { where.push('i.resultado = ?'); params.push(f.resultado); }
  if (f.orden_trabajo_id) { where.push('i.orden_trabajo_id = ?'); params.push(f.orden_trabajo_id); }
  if (f.q) {
    const p = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(o.numero LIKE ? OR o.titulo LIKE ?)');
    params.push(p, p);
  }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  const filas = await query(`${SELECT} WHERE ${condicion} ORDER BY i.id DESC LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM inspecciones i JOIN ordenes_trabajo o ON o.id = i.orden_trabajo_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtener(usuario, id) {
  const alc = await condicionAlcance(usuario);
  const i = await queryOne(`${SELECT} WHERE i.id = ? AND ${alc.sql}`, [id, ...alc.params]);
  if (!i) throw errores.noEncontrado('La inspección no existe');
  i.mediciones = await query('SELECT * FROM inspeccion_mediciones WHERE inspeccion_id = ? ORDER BY id', [id]);
  return i;
}

/** Para los adjuntos: fotos de la pieza inspeccionada y de la falla encontrada. */
export async function acceso(usuario, id) {
  await obtener(usuario, id); // 404 si no la ve
  const editar = await resolverPermiso(usuario, 'CAL', 'editar');
  return { puedeEscribir: editar.permitido, puedeGestionar: editar.permitido };
}

export async function inspeccionar(usuario, otId, d, req) {
  if (!usuario.empleado_id) throw errores.prohibido('La inspección la registra un empleado con legajo');
  const mediciones = (d.mediciones ?? []).map((m) => ({ ...m, unidad: m.unidad ?? 'mm', tolerancia_mas: m.tolerancia_mas ?? 0, tolerancia_menos: m.tolerancia_menos ?? 0 }))
    .map((m) => ({ ...m, conforme: conforme(m) }));
  const fuera = mediciones.filter((m) => !m.conforme);
  const rechazadas = d.cantidad_rechazada ?? 0;
  if (d.resultado !== 'rechazada' && (fuera.length || rechazadas > 0)) {
    throw errores.negocio(fuera.length
      ? `Hay ${fuera.length} ${fuera.length === 1 ? 'medición' : 'mediciones'} fuera de tolerancia: no se puede aprobar`
      : 'Hay piezas rechazadas: no se puede aprobar');
  }
  if (d.resultado === 'rechazada' && !d.retrabajo_tarea_id) {
    throw errores.validacion([{ campo: 'body.retrabajo_tarea_id', mensaje: 'Elegí qué operación hay que rehacer' }]);
  }

  const r = await transaccion(async (conn) => {
    const [[ot]] = await conn.execute('SELECT id, numero, titulo, estado, area_id, responsable_id FROM ordenes_trabajo WHERE id = ? FOR UPDATE', [otId]);
    if (!ot) throw errores.noEncontrado('La orden de trabajo no existe');
    if (ot.estado !== 'control_calidad') throw errores.negocio('La orden de trabajo no está esperando control de calidad');
    let tarea = null;
    if (d.retrabajo_tarea_id) {
      [[tarea]] = await conn.execute('SELECT id, secuencia, titulo, estado, area_id FROM tareas WHERE id = ? AND orden_trabajo_id = ? FOR UPDATE', [d.retrabajo_tarea_id, otId]);
      if (!tarea || tarea.estado === 'cancelada') throw errores.validacion([{ campo: 'body.retrabajo_tarea_id', mensaje: 'La operación no es de esta orden de trabajo' }]);
    }
    const [ins] = await conn.execute(
      `INSERT INTO inspecciones (orden_trabajo_id, tarea_id, inspector_id, resultado, cantidad_inspeccionada, cantidad_rechazada, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [otId, tarea?.id ?? null, usuario.empleado_id, d.resultado, d.cantidad_inspeccionada ?? 1, rechazadas, d.observaciones ?? null]);
    for (const m of mediciones) {
      await conn.execute(
        `INSERT INTO inspeccion_mediciones (inspeccion_id, caracteristica, valor_nominal, tolerancia_mas, tolerancia_menos, valor_medido, unidad, conforme)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ins.insertId, m.caracteristica, m.valor_nominal, m.tolerancia_mas, m.tolerancia_menos, m.valor_medido, m.unidad, m.conforme]);
    }
    const numero = `INSP-${String(ins.insertId).padStart(4, '0')}`;
    if (d.resultado === 'rechazada') {
      // No conformidad: la operación vuelve a hacerse y la OT sale de calidad.
      await conn.execute("UPDATE tareas SET estado = 'rechazada', completada_at = NULL WHERE id = ?", [tarea.id]);
      await conn.execute('INSERT INTO tarea_historial (tarea_id, usuario_id, estado_anterior, estado_nuevo, comentario) VALUES (?, ?, ?, ?, ?)',
        [tarea.id, usuario.id, tarea.estado, 'rechazada', `No conformidad ${numero}: ${d.observaciones ?? 'ver mediciones'}`.slice(0, 500)]);
      await conn.execute("UPDATE ordenes_trabajo SET estado = 'en_proceso' WHERE id = ?", [otId]);
    } else {
      await conn.execute("UPDATE ordenes_trabajo SET estado = 'terminada' WHERE id = ?", [otId]);
    }
    return { id: ins.insertId, numero, ot, tarea };
  });

  await auditar(req, { accion: `inspeccion_${d.resultado}`, entidad: 'orden_trabajo', entidadId: otId, detalle: { inspeccion: r.id, fuera: fuera.length } });
  if (d.resultado === 'rechazada') {
    const asignados = await query(`SELECT u.id FROM tarea_asignaciones ta JOIN usuarios u ON u.empleado_id = ta.empleado_id
      WHERE ta.tarea_id = ? AND u.activo = 1`, [r.tarea.id]);
    await notificar([...asignados.map((a) => a.id), await usuarioJefeDeArea(r.tarea.area_id)], {
      tipo: 'no_conformidad', titulo: `Rehacer ${r.ot.numero} · ${r.tarea.secuencia} ${r.tarea.titulo}`.slice(0, 120),
      mensaje: d.observaciones ?? 'No pasó el control de calidad.', entidad: 'tarea', entidadId: r.tarea.id,
    });
  } else {
    const responsable = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ? AND activo = 1', [r.ot.responsable_id ?? 0]);
    const comercial = await usuariosDeArea('COM', { soloJefe: true });
    const finanzas = await usuariosDeArea('ADM');
    await notificar([responsable?.id, ...comercial, ...finanzas], {
      tipo: 'ot_terminada', titulo: `${r.ot.numero} aprobada por Calidad`, mensaje: 'Lista para entregar y facturar.', entidad: 'orden_trabajo', entidadId: otId,
    });
  }
  return obtener(usuario, r.id);
}
