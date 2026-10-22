// Registro de eventos de seguridad y de negocio en la tabla `auditoria`.
// Nunca guardar contraseñas, tokens ni códigos en `detalle`.
import { query } from '../config/db.js';
import { ipDe } from '../utils/seguridad.js';

/**
 * Registra un evento. No lanza errores: si la auditoría falla, la operación
 * principal sigue y el problema queda en consola.
 */
export async function auditar(req, { accion, entidad = null, entidadId = null, detalle = null, usuarioId }) {
  const uid = usuarioId !== undefined ? usuarioId : (req?.usuario?.id ?? null);
  try {
    await query(
      'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, accion, entidad, entidadId, detalle ? JSON.stringify(detalle) : null, req ? ipDe(req) : null],
    );
  } catch (err) {
    console.error('[auditoria] no se pudo registrar el evento', accion, err.message);
  }
}
