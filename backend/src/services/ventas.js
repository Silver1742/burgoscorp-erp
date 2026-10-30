// Ventas (módulo VEN, equivalente a SAP SD): solicitud del cliente → presupuesto → orden de trabajo.
//
//   Solicitud:   nueva ──▶ en_analisis (Ingeniería) ──▶ presupuestada ──▶ aprobada | rechazada
//
// Cada pedido nuevo le llega al jefe de Ingeniería, que lo asigna a alguien de su equipo para
// analizarlo y presupuestarlo (si Ingeniería no tiene jefe, lo asigna el administrador). Al crearse
// la OT, a cada jefe con operaciones en su área le llega el aviso para asignarlas.
//                  └────────────── cancelada
//   Presupuesto: borrador ──▶ enviado ──▶ aprobado (el cliente aceptó) | rechazado
//
// Al aprobarse un presupuesto se crea sola la OT: las líneas de máquina pasan a ser operaciones
// (con sus horas) y las de material, reservas de stock. Si falta material, se avisa a Abastecimiento.
// Los importes los calcula siempre el servidor.
import { query, queryOne, transaccion } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { siguienteNumero } from '../utils/secuencias.js';
import { hoy, sumarDias } from '../utils/fechas.js';
import { resolverPermiso } from './permisos.js';
import { auditar } from './auditoria.js';
import { notificar, usuariosDeArea } from './notificaciones.js';
import { insertarTarea, completarConMaquina, jefesDelArea } from './tareas.js';
import * as stock from './stock.js';
import * as ordenes from './ordenes.js';

const centavos = (n) => Math.round(n * 100) / 100;
const SOL_CERRADAS = ['aprobada', 'rechazada', 'cancelada'];

const patronBusqueda = (q) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// ---------------------------------------------------------------- solicitudes

const SELECT_SOL = `
  SELECT s.*, c.razon_social AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email, c.contacto AS cliente_contacto,
         CONCAT(u.nombre, ' ', u.apellido) AS recibida_por_nombre,
         CONCAT(e.nombre, ' ', e.apellido) AS asignada_a_nombre,
         (SELECT COUNT(*) FROM adjuntos a WHERE a.entidad = 'solicitud' AND a.entidad_id = s.id) AS fotos
  FROM solicitudes s
  JOIN clientes c ON c.id = s.cliente_id
  JOIN usuarios u ON u.id = s.recibida_por
  LEFT JOIN empleados e ON e.id = s.asignada_a`;

export async function listarSolicitudes(usuario, f) {
  const where = ['1=1'];
  const params = [];
  if (f.q) {
    const p = patronBusqueda(f.q);
    where.push('(s.numero LIKE ? OR s.titulo LIKE ? OR c.razon_social LIKE ?)');
    params.push(p, p, p);
  }
  if (f.estado) { where.push('s.estado = ?'); params.push(f.estado); }
  if (f.abiertas) where.push(`s.estado NOT IN ('aprobada','rechazada','cancelada')`);
  if (f.mias) { where.push('s.asignada_a = ?'); params.push(usuario.empleado_id ?? 0); }
  if (f.sin_asignar) where.push("s.asignada_a IS NULL AND s.estado = 'nueva'");
  if (f.cliente_id) { where.push('s.cliente_id = ?'); params.push(f.cliente_id); }
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  const filas = await query(`${SELECT_SOL} WHERE ${condicion}
    ORDER BY FIELD(s.estado, 'nueva','en_analisis','presupuestada','aprobada','rechazada','cancelada'), s.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM solicitudes s JOIN clientes c ON c.id = s.cliente_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtenerSolicitud(usuario, id) {
  const s = await queryOne(`${SELECT_SOL} WHERE s.id = ?`, [id]);
  if (!s) throw errores.noEncontrado('La solicitud no existe');
  const [editar, crear] = await Promise.all([resolverPermiso(usuario, 'VEN', 'editar'), resolverPermiso(usuario, 'VEN', 'crear')]);
  const presupuestos = await query(
    'SELECT id, numero, estado, total, fecha FROM presupuestos WHERE solicitud_id = ? ORDER BY id DESC', [id]);
  const abierta = !SOL_CERRADAS.includes(s.estado);
  const { puede: asigna, jefe } = await quienAsigna(usuario);
  return {
    ...s, presupuestos,
    puede_asignar: asigna && abierta,
    jefe_ingenieria: jefe,
    puede_editar: editar.permitido && abierta,
    puede_presupuestar: crear.permitido && abierta && !presupuestos.some((p) => ['borrador', 'enviado'].includes(p.estado)),
  };
}

/** Para los adjuntos: fotos de la pieza que manda el cliente o saca Comercial. */
export async function accesoSolicitud(usuario, id) {
  const ver = await resolverPermiso(usuario, 'VEN', 'ver');
  const s = ver.permitido ? await queryOne('SELECT estado FROM solicitudes WHERE id = ?', [id]) : null;
  if (!s) throw errores.noEncontrado('La solicitud no existe');
  const editar = await resolverPermiso(usuario, 'VEN', 'editar');
  return { puedeEscribir: editar.permitido && !SOL_CERRADAS.includes(s.estado), puedeGestionar: editar.permitido };
}

async function areaIngenieria() {
  return queryOne("SELECT id, nombre FROM areas WHERE codigo = 'ING' AND activo = 1");
}

/**
 * El análisis de un pedido lo asigna un jefe de Ingeniería. El administrador (alcance de toda la
 * empresa) solo si Ingeniería no tiene jefe con cuenta activa.
 */
async function quienAsigna(usuario) {
  const ing = await areaIngenieria();
  const jefes = ing ? await jefesDelArea(ing.id) : [];
  const esJefe = jefes.some((j) => j.usuario_id === usuario.id);
  const permiso = await resolverPermiso(usuario, 'VEN', 'editar');
  const admin = permiso.permitido && permiso.alcance === 'todo' && usuario.rol === 'ADMIN';
  return { puede: esJefe || (admin && !jefes.length), jefe: jefes[0]?.nombre ?? null, jefes, ing };
}

async function clienteActivo(conn, clienteId) {
  const [[c]] = await conn.execute('SELECT id, razon_social, condicion_iva, activo FROM clientes WHERE id = ?', [clienteId]);
  if (!c || !c.activo) throw errores.validacion([{ campo: 'body.cliente_id', mensaje: 'El cliente no existe' }]);
  return c;
}

export async function crearSolicitud(usuario, d, req) {
  const id = await transaccion(async (conn) => {
    await clienteActivo(conn, d.cliente_id);
    const numero = await siguienteNumero(conn, 'SOL');
    const [r] = await conn.execute(
      `INSERT INTO solicitudes (numero, cliente_id, titulo, descripcion, tipo_trabajo, cantidad, fecha_requerida, recibida_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, d.cliente_id, d.titulo, d.descripcion ?? null, d.tipo_trabajo, d.cantidad ?? 1, d.fecha_requerida ?? null, usuario.id]);
    return r.insertId;
  });
  await auditar(req, { accion: 'crear', entidad: 'solicitud', entidadId: id });
  // Le llega directo al jefe de Ingeniería para que lo asigne (sin jefe: a los administradores).
  const { jefes } = await quienAsigna(usuario);
  const destino = jefes.length ? jefes.map((j) => j.usuario_id)
    : (await query(`SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE r.codigo = 'ADMIN' AND u.activo = 1 AND u.estado_cuenta = 'habilitada'`)).map((f) => f.id);
  const s = await queryOne('SELECT numero, titulo FROM solicitudes WHERE id = ?', [id]);
  await notificar(destino.filter((u) => u !== usuario.id), {
    tipo: 'solicitud_nueva', titulo: `Pedido nuevo para asignar: ${s.numero}`, mensaje: s.titulo,
    entidad: 'solicitud', entidadId: id,
  });
  return obtenerSolicitud(usuario, id);
}

/** Datos, asignación a Ingeniería (pasa a "en análisis") o cancelación. */
export async function editarSolicitud(usuario, id, d, req) {
  const s = await queryOne('SELECT * FROM solicitudes WHERE id = ?', [id]);
  if (!s) throw errores.noEncontrado('La solicitud no existe');
  if (SOL_CERRADAS.includes(s.estado)) throw errores.conflicto('La solicitud ya está cerrada');
  const cambios = { ...d };
  if (cambios.asignada_a) {
    const { puede, jefe } = await quienAsigna(usuario);
    if (!puede) throw errores.prohibido(jefe ? `El pedido lo asigna ${jefe}, jefe de Ingeniería` : 'Solo el jefe de Ingeniería asigna los pedidos');
    const e = await queryOne(`SELECT e.id FROM empleados e JOIN areas a ON a.id = e.area_id
      WHERE e.id = ? AND e.estado = 'activo' AND a.codigo = 'ING'`, [cambios.asignada_a]);
    if (!e) throw errores.validacion([{ campo: 'body.asignada_a', mensaje: 'Elegí a alguien de Ingeniería' }]);
    if (s.estado === 'nueva') cambios.estado = 'en_analisis';
  }
  if (cambios.estado === 'cancelada' && s.estado === 'presupuestada') {
    await query("UPDATE presupuestos SET estado = 'rechazado' WHERE solicitud_id = ? AND estado IN ('borrador','enviado')", [id]);
  }
  const columnas = Object.keys(cambios);
  await query(`UPDATE solicitudes SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...columnas.map((c) => cambios[c] ?? null), id]);
  await auditar(req, { accion: 'editar', entidad: 'solicitud', entidadId: id, detalle: { campos: columnas } });
  if (d.asignada_a && d.asignada_a !== s.asignada_a) {
    const u = await queryOne('SELECT id FROM usuarios WHERE empleado_id = ? AND activo = 1', [d.asignada_a]);
    await notificar(u?.id, { tipo: 'solicitud_asignada', titulo: `Analizar ${s.numero}`, mensaje: s.titulo, entidad: 'solicitud', entidadId: id });
    // El aviso de "pedido nuevo" ya se resolvió.
    await query("UPDATE notificaciones SET leida_at = UTC_TIMESTAMP() WHERE tipo = 'solicitud_nueva' AND entidad_id = ? AND leida_at IS NULL", [id]);
  }
  return obtenerSolicitud(usuario, id);
}

/** A quién se le puede asignar un pedido: la gente de Ingeniería, primero la que tiene menos abiertos. */
export async function analistas() {
  return query(`SELECT e.id, e.nombre, e.apellido, e.legajo, a.nombre AS area_nombre,
                  (SELECT COUNT(*) FROM solicitudes s WHERE s.asignada_a = e.id AND s.estado IN ('nueva','en_analisis')) AS abiertas
                FROM empleados e JOIN areas a ON a.id = e.area_id
                WHERE e.estado = 'activo' AND a.codigo = 'ING' ORDER BY abiertas, e.apellido`);
}

// ---------------------------------------------------------------- presupuestos

const SELECT_PRE = `
  SELECT p.*, c.razon_social AS cliente_nombre, c.condicion_iva AS cliente_condicion_iva, c.telefono AS cliente_telefono,
         s.numero AS solicitud_numero, s.titulo AS solicitud_titulo, s.tipo_trabajo,
         CONCAT(u.nombre, ' ', u.apellido) AS creado_por_nombre,
         o.id AS orden_trabajo_id, o.numero AS ot_numero,
         DATE_ADD(p.fecha, INTERVAL p.validez_dias DAY) AS vence
  FROM presupuestos p
  JOIN clientes c ON c.id = p.cliente_id
  LEFT JOIN solicitudes s ON s.id = p.solicitud_id
  JOIN usuarios u ON u.id = p.creado_por
  LEFT JOIN ordenes_trabajo o ON o.presupuesto_id = p.id`;

export async function listarPresupuestos(f) {
  const where = ['1=1'];
  const params = [];
  if (f.q) {
    const p = patronBusqueda(f.q);
    where.push('(p.numero LIKE ? OR c.razon_social LIKE ? OR s.titulo LIKE ?)');
    params.push(p, p, p);
  }
  if (f.estado) { where.push('p.estado = ?'); params.push(f.estado); }
  if (f.abiertos) where.push("p.estado IN ('borrador','enviado')");
  const condicion = where.join(' AND ');
  const offset = (f.pagina - 1) * f.limite;
  const filas = await query(`${SELECT_PRE} WHERE ${condicion}
    ORDER BY FIELD(p.estado, 'enviado','borrador','aprobado','rechazado','vencido'), p.id DESC
    LIMIT ${Number(f.limite)} OFFSET ${Number(offset)}`, params);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM presupuestos p JOIN clientes c ON c.id = p.cliente_id
    LEFT JOIN solicitudes s ON s.id = p.solicitud_id WHERE ${condicion}`, params);
  return { data: filas, meta: { pagina: f.pagina, limite: f.limite, total } };
}

export async function obtenerPresupuesto(usuario, id) {
  const p = await queryOne(`${SELECT_PRE} WHERE p.id = ?`, [id]);
  if (!p) throw errores.noEncontrado('El presupuesto no existe');
  const items = await query(`
    SELECT i.*, pr.codigo AS producto_codigo, ct.codigo AS centro_codigo, ct.nombre AS centro_nombre
    FROM presupuesto_items i
    LEFT JOIN productos pr ON pr.id = i.producto_id
    LEFT JOIN centros_trabajo ct ON ct.id = i.centro_trabajo_id
    WHERE i.presupuesto_id = ? ORDER BY i.id`, [id]);
  const [editar, aprobar] = await Promise.all([resolverPermiso(usuario, 'VEN', 'editar'), resolverPermiso(usuario, 'VEN', 'aprobar')]);
  const puedeResolver = aprobar.permitido && p.estado === 'enviado';
  // Para elegir en qué área se hace el trabajo al aprobarlo.
  const areasProduccion = puedeResolver ? await query(`SELECT a.id, a.codigo, a.nombre FROM areas a JOIN area_modulos am ON am.area_id = a.id
    JOIN modulos m ON m.id = am.modulo_id WHERE m.codigo = 'PROD' AND a.activo = 1 ORDER BY a.nombre`) : [];
  // Comercial no siempre ve las OT del área que hace el trabajo: el botón aparece solo si puede.
  const puedeVerOt = p.orden_trabajo_id ? Boolean(await ordenes.obtener(usuario, p.orden_trabajo_id).catch(() => null)) : false;
  return {
    ...p, items, areas_produccion: areasProduccion, puede_ver_ot: puedeVerOt,
    puede_editar: editar.permitido && p.estado === 'borrador',
    puede_enviar: editar.permitido && p.estado === 'borrador',
    puede_resolver: puedeResolver,
  };
}

/** Calcula los importes y valida que productos y máquinas existan. */
async function prepararItems(conn, items) {
  const listos = [];
  for (const [i, it] of items.entries()) {
    if (it.producto_id) await stock.productoActivo(conn, it.producto_id, `body.items.${i}.producto_id`);
    if (it.centro_trabajo_id) {
      const [[ct]] = await conn.execute('SELECT activo FROM centros_trabajo WHERE id = ?', [it.centro_trabajo_id]);
      if (!ct?.activo) throw errores.validacion([{ campo: `body.items.${i}.centro_trabajo_id`, mensaje: 'La máquina no existe' }]);
    }
    listos.push({ ...it, iva_alicuota: it.iva_alicuota ?? 21, subtotal: centavos(it.cantidad * it.precio_unitario) });
  }
  const subtotal = centavos(listos.reduce((a, it) => a + it.subtotal, 0));
  const iva = centavos(listos.reduce((a, it) => a + it.subtotal * (it.iva_alicuota / 100), 0));
  return { items: listos, subtotal, iva, total: centavos(subtotal + iva) };
}

async function guardarItems(conn, presupuestoId, items) {
  await conn.execute('DELETE FROM presupuesto_items WHERE presupuesto_id = ?', [presupuestoId]);
  for (const it of items) {
    await conn.execute(
      `INSERT INTO presupuesto_items (presupuesto_id, tipo, descripcion, producto_id, centro_trabajo_id, servicio_id, cantidad, unidad,
         precio_unitario, iva_alicuota, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [presupuestoId, it.tipo, it.descripcion, it.producto_id ?? null, it.centro_trabajo_id ?? null, it.servicio_id ?? null,
        it.cantidad, it.unidad ?? 'un', it.precio_unitario, it.iva_alicuota, it.subtotal]);
  }
}

export async function crearPresupuesto(usuario, d, req) {
  const id = await transaccion(async (conn) => {
    let clienteId = d.cliente_id;
    if (d.solicitud_id) {
      const [[s]] = await conn.execute('SELECT cliente_id, estado FROM solicitudes WHERE id = ? FOR UPDATE', [d.solicitud_id]);
      if (!s) throw errores.validacion([{ campo: 'body.solicitud_id', mensaje: 'La solicitud no existe' }]);
      if (SOL_CERRADAS.includes(s.estado)) throw errores.conflicto('La solicitud ya está cerrada');
      const [[abierto]] = await conn.execute("SELECT id FROM presupuestos WHERE solicitud_id = ? AND estado IN ('borrador','enviado')", [d.solicitud_id]);
      if (abierto) throw errores.conflicto('La solicitud ya tiene un presupuesto en curso');
      clienteId = s.cliente_id;
      await conn.execute("UPDATE solicitudes SET estado = 'presupuestada' WHERE id = ?", [d.solicitud_id]);
    }
    if (!clienteId) throw errores.validacion([{ campo: 'body.cliente_id', mensaje: 'Indicá el cliente o la solicitud' }]);
    await clienteActivo(conn, clienteId);
    const calc = await prepararItems(conn, d.items);
    const numero = await siguienteNumero(conn, 'PRE');
    const [r] = await conn.execute(
      `INSERT INTO presupuestos (numero, solicitud_id, cliente_id, fecha, validez_dias, plazo_entrega_dias, subtotal, iva_monto, total,
         observaciones, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, d.solicitud_id ?? null, clienteId, hoy(), d.validez_dias ?? 15, d.plazo_entrega_dias ?? null,
        calc.subtotal, calc.iva, calc.total, d.observaciones ?? null, usuario.id]);
    await guardarItems(conn, r.insertId, calc.items);
    return r.insertId;
  });
  await auditar(req, { accion: 'crear', entidad: 'presupuesto', entidadId: id });
  return obtenerPresupuesto(usuario, id);
}

export async function editarPresupuesto(usuario, id, d, req) {
  await transaccion(async (conn) => {
    const [[p]] = await conn.execute('SELECT estado FROM presupuestos WHERE id = ? FOR UPDATE', [id]);
    if (!p) throw errores.noEncontrado('El presupuesto no existe');
    if (p.estado !== 'borrador') throw errores.conflicto('Solo se modifica en borrador');
    const sets = [];
    const params = [];
    for (const c of ['validez_dias', 'plazo_entrega_dias', 'observaciones']) {
      if (d[c] !== undefined) { sets.push(`${c} = ?`); params.push(d[c]); }
    }
    if (d.items) {
      const calc = await prepararItems(conn, d.items);
      await guardarItems(conn, id, calc.items);
      sets.push('subtotal = ?', 'iva_monto = ?', 'total = ?');
      params.push(calc.subtotal, calc.iva, calc.total);
    }
    if (sets.length) await conn.execute(`UPDATE presupuestos SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  });
  await auditar(req, { accion: 'editar', entidad: 'presupuesto', entidadId: id, detalle: { campos: Object.keys(d) } });
  return obtenerPresupuesto(usuario, id);
}

export async function enviarPresupuesto(usuario, id, req) {
  const r = await query("UPDATE presupuestos SET estado = 'enviado', fecha = ? WHERE id = ? AND estado = 'borrador'", [hoy(), id]);
  if (!r.affectedRows) throw errores.conflicto('El presupuesto no está en borrador');
  await auditar(req, { accion: 'enviar', entidad: 'presupuesto', entidadId: id });
  return obtenerPresupuesto(usuario, id);
}

export async function rechazarPresupuesto(usuario, id, comentario, req) {
  await transaccion(async (conn) => {
    const [[p]] = await conn.execute('SELECT estado, solicitud_id FROM presupuestos WHERE id = ? FOR UPDATE', [id]);
    if (!p) throw errores.noEncontrado('El presupuesto no existe');
    if (p.estado !== 'enviado') throw errores.conflicto('Solo se resuelve un presupuesto enviado');
    await conn.execute(`UPDATE presupuestos SET estado = 'rechazado', respuesta_cliente_at = UTC_TIMESTAMP(),
      observaciones = CONCAT_WS(?, observaciones, ?) WHERE id = ?`, ['\n', `Rechazado por el cliente: ${comentario}`.slice(0, 600), id]);
    if (p.solicitud_id) await conn.execute("UPDATE solicitudes SET estado = 'rechazada' WHERE id = ?", [p.solicitud_id]);
  });
  await auditar(req, { accion: 'rechazar', entidad: 'presupuesto', entidadId: id });
  return obtenerPresupuesto(usuario, id);
}

/**
 * El cliente aceptó: se crea la OT en el área elegida, con una operación por cada línea de máquina
 * y una reserva por cada línea de material.
 */
export async function aprobarPresupuesto(usuario, id, d, req) {
  const area = await queryOne(`SELECT a.id, a.nombre, a.jefe_empleado_id FROM areas a JOIN area_modulos am ON am.area_id = a.id
    JOIN modulos m ON m.id = am.modulo_id WHERE a.id = ? AND a.activo = 1 AND m.codigo = 'PROD'`, [d.area_id]);
  if (!area) throw errores.validacion([{ campo: 'body.area_id', mensaje: 'Elegí un área de producción' }]);

  const r = await transaccion(async (conn) => {
    const [[p]] = await conn.execute(
      `SELECT p.*, s.titulo AS sol_titulo, s.descripcion AS sol_descripcion, s.tipo_trabajo AS sol_tipo, s.cantidad AS sol_cantidad,
              s.fecha_requerida FROM presupuestos p LEFT JOIN solicitudes s ON s.id = p.solicitud_id WHERE p.id = ? FOR UPDATE`, [id]);
    if (!p) throw errores.noEncontrado('El presupuesto no existe');
    if (p.estado !== 'enviado') throw errores.conflicto('Solo se aprueba un presupuesto enviado al cliente');
    const [items] = await conn.execute('SELECT * FROM presupuesto_items WHERE presupuesto_id = ? ORDER BY id', [id]);

    const numero = await siguienteNumero(conn, 'OT');
    const entrega = p.plazo_entrega_dias ? sumarDias(hoy(), p.plazo_entrega_dias) : (p.fecha_requerida ?? null);
    const [ot] = await conn.execute(
      `INSERT INTO ordenes_trabajo (numero, cliente_id, presupuesto_id, titulo, descripcion, tipo_trabajo, cantidad, prioridad,
         fecha_inicio_plan, fecha_entrega_plan, area_id, responsable_id, costo_estimado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, p.cliente_id, id, (p.sol_titulo ?? d.titulo ?? `Trabajo según ${p.numero}`).slice(0, 120), p.sol_descripcion ?? p.observaciones,
        p.sol_tipo ?? d.tipo_trabajo ?? 'fabricacion', p.sol_cantidad ?? 1, d.prioridad ?? 'media', hoy(), entrega, area.id,
        area.jefe_empleado_id, p.subtotal, usuario.id]);

    let secuencia = 0;
    const faltantes = [];
    for (const it of items) {
      if (it.centro_trabajo_id) {
        secuencia += 10;
        const datos = await completarConMaquina({ titulo: it.descripcion.slice(0, 150), centro_trabajo_id: it.centro_trabajo_id });
        // Las horas presupuestadas pasan a ser las estimadas de la operación (en cuartos de hora).
        const horas = it.unidad === 'h' ? Math.round(Number(it.cantidad) * 4) / 4 : null;
        await insertarTarea(conn, { ...datos, horas_estimadas: horas, prioridad: d.prioridad ?? 'media', area_id: datos.area_maquina ?? area.id,
          orden_trabajo_id: ot.insertId, secuencia, creado_por: usuario.id });
      } else if (it.tipo === 'material' && it.producto_id) {
        const antes = await stock.disponibilidad(conn, it.producto_id);
        await conn.execute('INSERT INTO reservas_material (orden_trabajo_id, producto_id, cantidad, creado_por) VALUES (?, ?, ?, ?)',
          [ot.insertId, it.producto_id, it.cantidad, usuario.id]);
        const falta = Math.max(0, Number(it.cantidad) - antes.disponible);
        if (falta > 0) faltantes.push(`${it.descripcion}: faltan ${Math.round(falta * 1000) / 1000} ${it.unidad}`);
      }
    }
    await conn.execute("UPDATE presupuestos SET estado = 'aprobado', respuesta_cliente_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
    if (p.solicitud_id) await conn.execute("UPDATE solicitudes SET estado = 'aprobada' WHERE id = ?", [p.solicitud_id]);
    return { otId: ot.insertId, numero, presupuesto: p.numero, faltantes };
  });

  await auditar(req, { accion: 'aprobar', entidad: 'presupuesto', entidadId: id, detalle: { ot: r.numero } });
  // A los jefes del área de la OT, y a los de cada área que tiene operaciones (máquinas de otra área):
  // cada uno asigna las suyas a su equipo.
  await notificar((await jefesDelArea(area.id)).map((j) => j.usuario_id), {
    tipo: 'ot_nueva', titulo: `Nueva ${r.numero} (${r.presupuesto} aprobado)`, mensaje: 'Revisá las operaciones y asigná al equipo.', entidad: 'orden_trabajo', entidadId: r.otId,
  });
  const porArea = await query(`SELECT area_id, MIN(id) AS primera, COUNT(*) AS n FROM tareas
    WHERE orden_trabajo_id = ? AND area_id <> ? GROUP BY area_id`, [r.otId, area.id]);
  for (const g of porArea) {
    await notificar((await jefesDelArea(g.area_id)).map((j) => j.usuario_id), {
      tipo: 'tarea_para_asignar',
      titulo: `${r.numero}: ${g.n} ${g.n === 1 ? 'tarea' : 'tareas'} para tu área`.slice(0, 120),
      mensaje: 'Asignalas a tu equipo (Tareas del área → Para asignar).', entidad: 'tarea', entidadId: g.primera,
    });
  }
  if (r.faltantes.length) {
    await notificar(await usuariosDeArea('ABA'), {
      tipo: 'material_faltante', titulo: `Falta material para ${r.numero}`, mensaje: r.faltantes.join(' · ').slice(0, 500), entidad: 'orden_trabajo', entidadId: r.otId,
    });
  }
  return { ...(await obtenerPresupuesto(usuario, id)), faltantes: r.faltantes };
}
