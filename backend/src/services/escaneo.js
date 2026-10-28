// Qué abrir al escanear un código con la cámara del teléfono.
//
// Las etiquetas QR que imprime el sistema tienen el formato BC:<TIPO>:<código>:
//   BC:OT:OT-2026-0001   pieza / orden de trabajo  → la tarea del operario en esa OT (o la OT); a Calidad,
//                                                    si está esperando control, la inspección
//   BC:MAQ:CNC-02        máquina                   → su ficha, para reportar una falla
//   BC:PRD:MP-1045-25    producto o estante        → su stock
//   BC:OC:OC-2026-0001   orden de compra           → para recibirla
// También se acepta el código "pelado" (OT-2026-0001, CNC-02, MP-1045-25) por si se tipea.
//
// Lo leído es un dato que viene de afuera: solo se busca por código exacto y se devuelve un id;
// nunca se abre como enlace. Si el usuario no puede ver el registro, la respuesta es la misma
// que si no existiera (404).
import { queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { resolverPermiso } from './permisos.js';
import * as ordenes from './ordenes.js';

const PREFIJOS = { OT: 'orden_trabajo', MAQ: 'maquina', PRD: 'producto', OC: 'orden_compra' };

const puede = async (usuario, modulo) => (await resolverPermiso(usuario, modulo, 'ver')).permitido;

async function ordenTrabajo(usuario, numero) {
  const fila = await queryOne('SELECT id, numero, titulo, estado FROM ordenes_trabajo WHERE numero = ?', [numero]);
  if (!fila) return null;
  // El inspector escanea la pieza terminada y va directo a inspeccionarla.
  if (fila.estado === 'control_calidad' && (await resolverPermiso(usuario, 'CAL', 'crear')).permitido) {
    return { tipo: 'inspeccion', id: fila.id, titulo: `${fila.numero} · ${fila.titulo}` };
  }
  if (!(await puede(usuario, 'PROD'))) return null;
  const ot = await ordenes.obtener(usuario, fila.id).catch(() => null);
  if (!ot) return null;
  // Al operario le abre directamente su operación pendiente en esa pieza.
  const tarea = await queryOne(`
    SELECT t.id FROM tareas t JOIN tarea_asignaciones ta ON ta.tarea_id = t.id
    WHERE t.orden_trabajo_id = ? AND ta.empleado_id = ? AND t.estado NOT IN ('aprobada','cancelada')
    ORDER BY t.estado = 'en_curso' DESC, t.secuencia LIMIT 1`, [ot.id, usuario.empleado_id ?? 0]);
  return { tipo: 'orden_trabajo', id: ot.id, titulo: `${ot.numero} · ${ot.titulo}`, tarea_id: tarea?.id ?? null };
}

async function maquina(usuario, codigo) {
  if (!(await puede(usuario, 'MANT')) && !(await puede(usuario, 'PROD'))) return null;
  const ct = await queryOne('SELECT id, codigo, nombre FROM centros_trabajo WHERE codigo = ? AND activo = 1', [codigo]);
  return ct && { tipo: 'maquina', id: ct.id, titulo: `${ct.codigo} · ${ct.nombre}` };
}

async function producto(usuario, codigo) {
  if (!(await puede(usuario, 'INV'))) return null;
  const p = await queryOne('SELECT id, codigo, nombre FROM productos WHERE codigo = ? AND activo = 1', [codigo]);
  return p && { tipo: 'producto', id: p.id, titulo: `${p.codigo} · ${p.nombre}` };
}

async function ordenCompra(usuario, numero) {
  if (!(await puede(usuario, 'COM'))) return null;
  const oc = await queryOne('SELECT id, numero FROM ordenes_compra WHERE numero = ?', [numero]);
  return oc && { tipo: 'orden_compra', id: oc.id, titulo: oc.numero };
}

const BUSCAR = { orden_trabajo: ordenTrabajo, maquina, producto, orden_compra: ordenCompra };

export async function resolver(usuario, crudo) {
  const texto = crudo.trim().toUpperCase();
  const m = /^BC:([A-Z]+):(.+)$/.exec(texto);
  let r = null;
  if (m) {
    const tipo = PREFIJOS[m[1]];
    if (tipo) r = await BUSCAR[tipo](usuario, m[2]);
  } else if (/^OT-\d{4}-\d{4,}$/.test(texto)) r = await ordenTrabajo(usuario, texto);
  else if (/^OC-\d{4}-\d{4,}$/.test(texto)) r = await ordenCompra(usuario, texto);
  else r = (await maquina(usuario, texto)) ?? (await producto(usuario, texto));
  if (!r) throw errores.noEncontrado('El código no corresponde a nada que puedas ver');
  return r;
}
