// Lectura del usuario con su rol y área (lo que necesitan auth y permisos).
import { queryOne } from '../config/db.js';

const SELECT_USUARIO = `
  SELECT u.id, u.email, u.nombre, u.apellido, u.activo, u.totp_habilitado,
         u.email_verificado_at, u.empleado_id, u.password_hash IS NOT NULL AS tiene_password,
         r.codigo AS rol, e.area_id, a.codigo AS area_codigo, a.nombre AS area_nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN empleados e ON e.id = u.empleado_id
  LEFT JOIN areas a ON a.id = e.area_id`;

export function buscarUsuarioPorId(id) {
  return queryOne(`${SELECT_USUARIO} WHERE u.id = ?`, [id]);
}

/** Datos del usuario que se pueden devolver a la app (sin hashes ni secretos). */
export function perfilPublico(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    apellido: u.apellido,
    rol: u.rol,
    empleadoId: u.empleado_id,
    area: u.area_id ? { id: u.area_id, codigo: u.area_codigo, nombre: u.area_nombre } : null,
    emailVerificado: Boolean(u.email_verificado_at),
    dosPasosActivo: Boolean(u.totp_habilitado),
    tienePassword: Boolean(u.tiene_password),
  };
}
