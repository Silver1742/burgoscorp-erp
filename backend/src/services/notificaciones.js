// Avisos dentro de la app (campanita). No lanza errores: si falla, la operación principal sigue.
import { query } from '../config/db.js';

export async function notificar(usuarioIds, { tipo, titulo, mensaje = null, entidad = null, entidadId = null }) {
  const ids = [...new Set((Array.isArray(usuarioIds) ? usuarioIds : [usuarioIds]).filter(Boolean))];
  for (const id of ids) {
    try {
      await query(
        'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, entidad, entidad_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, tipo, titulo.slice(0, 120), mensaje?.slice(0, 500) ?? null, entidad, entidadId],
      );
    } catch (err) {
      console.error('[notificaciones] no se pudo crear', tipo, err.message);
    }
  }
}

/** Usuarios que pueden aprobar en RRHH con alcance de toda la empresa (jefe de RRHH y admins). */
export async function usuariosRrhh() {
  const filas = await query(`
    SELECT u.id FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    LEFT JOIN empleados e ON e.id = u.empleado_id
    LEFT JOIN areas a ON a.id = e.area_id
    WHERE u.activo = 1 AND (r.codigo = 'ADMIN' OR (r.codigo = 'JEFE' AND a.codigo = 'RRHH'))`);
  return filas.map((f) => f.id);
}

/** Usuario del jefe de un área (para avisarle de pedidos de su equipo). */
export async function usuarioJefeDeArea(areaId) {
  const filas = await query(`
    SELECT u.id FROM areas a JOIN usuarios u ON u.empleado_id = a.jefe_empleado_id
    WHERE a.id = ? AND u.activo = 1`, [areaId]);
  return filas[0]?.id ?? null;
}

/** Usuarios activos de un área por su código (ej. 'ABA' para avisar a Abastecimiento). */
export async function usuariosDeArea(codigoArea, { soloJefe = false } = {}) {
  const filas = await query(`
    SELECT u.id FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    JOIN empleados e ON e.id = u.empleado_id
    JOIN areas a ON a.id = e.area_id
    WHERE u.activo = 1 AND a.codigo = ? AND (? = 0 OR r.codigo = 'JEFE')`, [codigoArea, soloJefe ? 1 : 0]);
  return filas.map((f) => f.id);
}
