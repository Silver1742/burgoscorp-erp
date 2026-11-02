// Quién ve y quién cambia un aviso del tablón (lo usan las rutas de Inicio y las imágenes del aviso).
import { queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';

export const MAX_IMAGENES = 4;

/** ¿Lo puede ver? Gerencia y el administrador, todos; el resto, los generales y los de su área. */
export const veTodos = (usuario) => ['ADMIN', 'GERENCIA'].includes(usuario.rol);
export const puedeEditar = (usuario, a) => usuario.rol === 'ADMIN' || a.autor_id === usuario.id;

/** Acceso a las imágenes de un aviso: las ve quien ve el aviso; las agrega o borra quien lo publicó (o el admin). */
export async function acceso(usuario, id) {
  const a = await queryOne('SELECT id, area_id, autor_id FROM avisos_tablon WHERE id = ?', [id]);
  if (!a || !(veTodos(usuario) || a.area_id === null || a.area_id === usuario.area_id)) {
    throw errores.noEncontrado('El aviso no existe');
  }
  const editar = puedeEditar(usuario, a);
  return { puedeEscribir: editar, puedeGestionar: editar, maximo: MAX_IMAGENES };
}
