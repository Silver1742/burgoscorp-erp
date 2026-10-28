// Órdenes de trabajo (módulo PROD, equivalente a las órdenes de producción de SAP PP).
// Una OT es un trabajo para un cliente (o interno) que se divide en operaciones: cada operación
// es una tarea asignable a una persona y a una máquina (ver services/tareas.js).
//
//   planificada ─▶ en_proceso ─▶ control_calidad ─▶ terminada ─▶ entregada
//        │              │  ▲
//        │              ▼  │
//        └──────────▶ pausada            (cualquiera, salvo entregada) ─▶ cancelada
//
// Al pasar a entregada o cancelada se libera el material reservado que no se consumió.
//
// Pasa sola a en_proceso cuando alguien inicia la primera operación, y a control_calidad
// cuando se aprueban todas.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { siguienteNumero } from '../utils/secuencias.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';

const TRANSICIONES = {
  planificada: ['en_proceso', 'pausada', 'cancelada'],
  en_proceso: ['pausada', 'control_calidad', 'cancelada'],
  pausada: ['en_proceso', 'cancelada'],
  control_calidad: ['en_proceso', 'cancelada'], // a "terminada" la pasa solo Calidad (services/calidad.js)
  terminada: ['entregada', 'control_calidad'],
  entregada: [],
  cancelada: [],
};

const SELECT = `
  SELECT o.*, c.razon_social AS cliente_nombre, a.nombre AS area_nombre,
         CONCAT(r.nombre, ' ', r.apellido) AS responsable_nombre,
         (SELECT COUNT(*) FROM tareas t WHERE t.orden_trabajo_id = o.id AND t.estado <> 'cancelada') AS operaciones,
         (SELECT COUNT(*) FROM tareas t WHERE t.orden_trabajo_id = o.id AND t.estado = 'aprobada') AS operaciones_aprobadas,
         (SELECT COALESCE(SUM(t.horas_estimadas), 0) FROM tareas t WHERE t.orden_trabajo_id = o.id AND t.estado <> 'cancelada') AS horas_estimadas,
         (SELECT COALESCE(SUM(t.horas_reales), 0) FROM tareas t WHERE t.orden_trabajo_id = o.id) AS horas_reales,
         (SELECT COALESCE(SUM(cm.cantidad * cm.costo_unitario), 0) FROM consumos_material cm WHERE cm.orden_trabajo_id = o.id) AS costo_material
  FROM ordenes_trabajo o
  LEFT JOIN clientes c ON c.id = o.cliente_id
  JOIN areas a ON a.id = o.area_id
  LEFT JOIN empleados r ON r.id = o.responsable_id`;

/**
 * Qué OT puede ver el usuario: toda la empresa, las de su área, o (empleado) las que tienen
 * una operación asignada a él o de las que es responsable.
 */
async function condicionAlcance(usuario) {
  const { alcance } = await resolverPermiso(usuario, 'PROD', 'ver');
  const asignadoAmi = `EXISTS (SELECT 1 FROM tareas t JOIN tarea_asignaciones ta ON ta.tarea_id = t.id
                       WHERE t.orden_trabajo_id = o.id AND ta.empleado_id = ?)`;
  const emp = usuario.empleado_id ?? 0;
  if (alcance === 'todo') return { sql: '1=1', params: [] };
  if (alcance === 'area' && usuario.area_id) {
    return { sql: `(o.area_id = ? OR o.responsable_id = ? OR ${asignadoAmi})`, params: [usuario.area_id, emp, emp] };
  }
  return { sql: `(o.responsable_id = ? OR ${asignadoAmi})`, params: [emp, emp] };
}

export async function listar(usuario, f) {
  const alc = await condicionAlcance(usuario);
  const where = [alc.sql];
  const params = [...alc.params];
  if (f.q) {
    const patron = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(o.numero LIKE ? OR o.titulo LIKE ? OR c.razon_social LIKE ?)');
    params.push(patron, patron, patron);
  }
  if (f.estado) { where.push('o.estado = ?'); params.push(f.estado); }
  if (f.area_id) { where.push('o.area_id = ?'); params.push(f.area_id); }
  if (f.abiertas) where.push("o.estado NOT IN ('entregada', 'cancelada')");
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;

  // Primero lo urgente y lo que vence antes.
  const filas = await query(`${SELECT} WHERE ${condicion}
    ORDER BY o.estado IN ('entregada','cancelada'), FIELD(o.prioridad, 'urgente','alta','media','baja'),
             o.fecha_entrega_plan IS NULL, o.fecha_entrega_plan, o.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM ordenes_trabajo o
    LEFT JOIN clientes c ON c.id = o.cliente_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtener(usuario, id) {
  const alc = await condicionAlcance(usuario);
  const ot = await queryOne(`${SELECT} WHERE o.id = ? AND ${alc.sql}`, [id, ...alc.params]);
  if (!ot) throw errores.noEncontrado('La orden de trabajo no existe');
  ot.tareas = await query(`
    SELECT t.id, t.secuencia, t.titulo, t.estado, t.prioridad, t.horas_estimadas, t.horas_reales, t.fecha_limite,
           ct.codigo AS centro_codigo, ct.nombre AS centro_nombre, ct.estado AS centro_estado, h.nombre AS habilidad_nombre,
           (SELECT GROUP_CONCAT(CONCAT(e.nombre, ' ', e.apellido) ORDER BY e.apellido SEPARATOR ', ')
              FROM tarea_asignaciones ta JOIN empleados e ON e.id = ta.empleado_id WHERE ta.tarea_id = t.id) AS asignados
    FROM tareas t
    LEFT JOIN centros_trabajo ct ON ct.id = t.centro_trabajo_id
    LEFT JOIN habilidades h ON h.id = t.habilidad_requerida_id
    WHERE t.orden_trabajo_id = ? ORDER BY t.secuencia`, [id]);
  return ot;
}

/** Con alcance de área solo se crean o mueven OT dentro del área propia. */
function areaPermitida(usuario, permiso, areaId) {
  if (permiso.alcance === 'todo') return areaId ?? usuario.area_id;
  if (areaId && areaId !== usuario.area_id) throw errores.prohibido('Solo podés crear órdenes de trabajo de tu área');
  return usuario.area_id;
}

export async function crear(usuario, permiso, datos, req) {
  const areaId = areaPermitida(usuario, permiso, datos.area_id);
  if (!areaId) throw errores.validacion([{ campo: 'body.area_id', mensaje: 'Indicá el área responsable' }]);

  const id = await transaccion(async (conn) => {
    const numero = await siguienteNumero(conn, 'OT');
    const [r] = await conn.execute(
      `INSERT INTO ordenes_trabajo (numero, cliente_id, titulo, descripcion, tipo_trabajo, cantidad, prioridad,
         fecha_inicio_plan, fecha_entrega_plan, area_id, responsable_id, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, datos.cliente_id ?? null, datos.titulo, datos.descripcion ?? null, datos.tipo_trabajo, datos.cantidad ?? 1,
        datos.prioridad ?? 'media', datos.fecha_inicio_plan ?? null, datos.fecha_entrega_plan ?? null, areaId,
        datos.responsable_id ?? usuario.empleado_id ?? null, usuario.id],
    );
    return r.insertId;
  });
  await auditar(req, { accion: 'crear', entidad: 'orden_trabajo', entidadId: id });
  return obtener(usuario, id);
}

export async function editar(usuario, permiso, id, datos, req) {
  const actual = await obtener(usuario, id);
  if (permiso.alcance !== 'todo' && actual.area_id !== usuario.area_id) throw errores.prohibido('La orden de trabajo es de otra área');
  if (['entregada', 'cancelada'].includes(actual.estado)) throw errores.conflicto('La orden de trabajo ya está cerrada');

  const cambios = { ...datos };
  if (cambios.area_id !== undefined) cambios.area_id = areaPermitida(usuario, permiso, cambios.area_id);
  if (cambios.estado && cambios.estado !== actual.estado) {
    if (!TRANSICIONES[actual.estado].includes(cambios.estado)) {
      throw errores.negocio(`No se puede pasar de "${actual.estado}" a "${cambios.estado}"`);
    }
    if (cambios.estado === 'control_calidad' && actual.operaciones_aprobadas < actual.operaciones) {
      throw errores.negocio('Todavía hay operaciones sin aprobar');
    }
    if (cambios.estado === 'entregada') cambios.fecha_entrega_real = new Date().toISOString().slice(0, 10);
  } else delete cambios.estado;

  const columnas = Object.keys(cambios);
  if (columnas.length) {
    await query(`UPDATE ordenes_trabajo SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map((c) => cambios[c] ?? null), id]);
  }
  // Al cerrar la OT, el material reservado que no se usó vuelve a estar disponible.
  if (['entregada', 'cancelada'].includes(cambios.estado)) {
    await query("UPDATE reservas_material SET cantidad = cantidad_consumida, estado = 'consumida' WHERE orden_trabajo_id = ? AND estado = 'activa' AND cantidad_consumida > 0", [id]);
    await query("UPDATE reservas_material SET estado = 'liberada' WHERE orden_trabajo_id = ? AND estado = 'activa'", [id]);
  }
  await auditar(req, { accion: 'editar', entidad: 'orden_trabajo', entidadId: id, detalle: { campos: columnas } });
  return obtener(usuario, id);
}

/** Cambios automáticos de estado de la OT según sus operaciones (los llama services/tareas.js). */
export async function actualizarPorOperaciones(conn, otId) {
  const [[ot]] = await conn.execute('SELECT estado FROM ordenes_trabajo WHERE id = ? FOR UPDATE', [otId]);
  if (!ot) return;
  const [[c]] = await conn.execute(
    `SELECT SUM(estado <> 'cancelada') AS activas, SUM(estado = 'aprobada') AS aprobadas,
            SUM(estado IN ('en_curso','pausada','en_revision','aprobada','rechazada')) AS iniciadas
     FROM tareas WHERE orden_trabajo_id = ?`, [otId]);
  if (ot.estado === 'planificada' && Number(c.iniciadas) > 0) {
    await conn.execute("UPDATE ordenes_trabajo SET estado = 'en_proceso' WHERE id = ?", [otId]);
  } else if (ot.estado === 'en_proceso' && Number(c.activas) > 0 && Number(c.aprobadas) === Number(c.activas)) {
    await conn.execute("UPDATE ordenes_trabajo SET estado = 'control_calidad' WHERE id = ?", [otId]);
  }
}
