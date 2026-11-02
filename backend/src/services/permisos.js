// Resolución de permisos: rol × módulo × acción, combinado con el área del usuario.
// Las reglas están documentadas en la tabla `permisos_rol` de schema.sql.
import { query } from '../config/db.js';

export const ACCIONES = ['ver', 'crear', 'editar', 'borrar', 'aprobar'];
const CACHE_MS = 60 * 1000;

let cache = null;
let cargadoEn = 0;

async function cargar() {
  if (cache && Date.now() - cargadoEn < CACHE_MS) return cache;

  const permisos = await query(`
    SELECT r.codigo AS rol, m.codigo AS modulo, p.puede_ver AS ver, p.puede_crear AS crear,
           p.puede_editar AS editar, p.puede_borrar AS borrar, p.puede_aprobar AS aprobar,
           p.alcance, p.requiere_area_duenia AS duenia
    FROM permisos_rol p
    JOIN roles r ON r.id = p.rol_id
    JOIN modulos m ON m.id = p.modulo_id`);
  const areaModulos = await query(`
    SELECT am.area_id, m.codigo AS modulo FROM area_modulos am JOIN modulos m ON m.id = am.modulo_id`);

  cache = {
    permisos: new Map(permisos.map((p) => [`${p.rol}:${p.modulo}`, p])),
    duenias: new Set(areaModulos.map((a) => `${a.area_id}:${a.modulo}`)),
    // Cuántas áreas comparten cada módulo (Producción la comparten Ingeniería, Mecanizado, Soldadura e Impresión 3D).
    duenosPorModulo: areaModulos.reduce((m, a) => m.set(a.modulo, (m.get(a.modulo) ?? 0) + 1), new Map()),
    modulos: [...new Set(permisos.map((p) => p.modulo))],
  };
  cargadoEn = Date.now();
  return cache;
}

/** Para cuando un admin cambia permisos o áreas. */
export function invalidarCachePermisos() {
  cache = null;
}

/**
 * Devuelve { permitido, alcance, esDuenia } para una acción.
 * alcance: 'todo' | 'area' | 'propio'.
 */
/** Módulos en los que cualquier integrante del área dueña trabaja sobre toda la empresa. */
const GESTIONADOS_POR_EL_AREA = new Set(['RRHH', 'MANT']);

export async function resolverPermiso(usuario, modulo, accion) {
  const { permisos, duenias, duenosPorModulo } = await cargar();
  // Una cuenta sin legajo (recién registrada, o creada por login social) no accede a ningún
  // módulo hasta que RRHH o un admin la vincula a un empleado. El admin no necesita legajo.
  if (!usuario.empleado_id && usuario.rol !== 'ADMIN') return { permitido: false, alcance: null, esDuenia: false };
  const p = permisos.get(`${usuario.rol}:${modulo}`);
  const esDuenia = Boolean(usuario.area_id) && duenias.has(`${usuario.area_id}:${modulo}`);
  const denegado = { permitido: false, alcance: null, esDuenia };

  if (!p || !p[accion]) return denegado;
  if (p.duenia === 'todo' && !esDuenia) return denegado;
  if (p.duenia === 'escritura' && accion !== 'ver' && !esDuenia) return denegado;

  // El área dueña de un módulo lo gestiona para toda la empresa (RRHH los legajos, Calidad las
  // inspecciones, Abastecimiento las compras, Mantenimiento las máquinas): su jefe ve todo.
  // Si el módulo lo comparten varias áreas (Producción), cada jefe ve solo lo de la suya.
  // Los empleados conservan su alcance (un operario de Mecanizado no ve otras áreas), salvo en los
  // módulos que su área trabaja para todos: RRHH carga los legajos de toda la empresa y los
  // técnicos de Mantenimiento atienden todas las máquinas (aprobar sigue siendo del jefe).
  const unicaDuenia = duenosPorModulo.get(modulo) === 1;
  const gestionaParaTodos = esDuenia && unicaDuenia && (usuario.rol === 'JEFE' || GESTIONADOS_POR_EL_AREA.has(modulo));
  let alcance = gestionaParaTodos ? 'todo' : p.alcance;
  // Sin legajo no hay área: el alcance "area" se reduce a lo propio.
  if (alcance === 'area' && !usuario.area_id) alcance = 'propio';
  return { permitido: true, alcance, esDuenia };
}

/** Mapa completo para la app (arma los menús según el rol). La validación real sigue en cada endpoint. */
export async function mapaPermisos(usuario) {
  const { modulos } = await cargar();
  const mapa = {};
  for (const modulo of modulos) {
    const acciones = {};
    let alcance = null;
    for (const accion of ACCIONES) {
      const r = await resolverPermiso(usuario, modulo, accion);
      acciones[accion] = r.permitido;
      if (r.permitido && accion === 'ver') alcance = r.alcance;
    }
    if (acciones.ver) mapa[modulo] = { ...acciones, alcance };
  }
  return mapa;
}

/**
 * Condición SQL para limitar un listado según el alcance.
 *   areaCol:   columna con el área del registro (ej. 't.area_id')
 *   propioCol: columna que identifica al dueño (ej. 'e.id' o 't.creado_por')
 *   propioDe:  'empleado' (compara con usuario.empleado_id) o 'usuario' (con usuario.id)
 * Los nombres de columna vienen siempre del código, nunca del cliente.
 */
export function filtroAlcance(usuario, alcance, { areaCol, propioCol, propioDe = 'empleado' } = {}) {
  if (alcance === 'todo') return { sql: '1=1', params: [] };
  if (alcance === 'area' && areaCol && usuario.area_id) {
    return { sql: `${areaCol} = ?`, params: [usuario.area_id] };
  }
  const valor = propioDe === 'usuario' ? usuario.id : usuario.empleado_id;
  if (propioCol && valor) return { sql: `${propioCol} = ?`, params: [valor] };
  return { sql: '1=0', params: [] };
}
