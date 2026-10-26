// Fotos y archivos adjuntos (foto de la cámara en una tarea, certificado médico en una licencia...).
//
// Reglas de seguridad:
//  - El tipo se decide por los primeros bytes del archivo (firma), no por la extensión ni por el
//    Content-Type que manda el cliente. Solo se aceptan JPEG, PNG, WebP y PDF.
//  - Se guardan en disco con un UUID como nombre, fuera de cualquier carpeta pública. El nombre
//    original solo se muestra; nunca se usa para armar una ruta.
//  - A las fotos JPEG se les quitan los metadatos EXIF/XMP (pueden traer la ubicación GPS).
//  - Ver o subir un adjunto exige poder ver (o modificar) la entidad a la que pertenece.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import env from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { auditar } from './auditoria.js';
import * as tareas from './tareas.js';
import * as licencias from './licencias.js';

export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_POR_ENTIDAD = 12;
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const CARPETA = path.resolve(env.UPLOADS_DIR);

/** Entidades que aceptan adjuntos y cómo se decide el acceso. Se suman las de cada módulo nuevo. */
const ENTIDADES = {
  tarea: tareas.acceso,
  licencia: licencias.acceso,
};
export const NOMBRES_ENTIDAD = Object.keys(ENTIDADES);

async function acceso(usuario, entidad, entidadId) {
  const fn = ENTIDADES[entidad];
  if (!fn) throw errores.noEncontrado('Tipo de adjunto inválido');
  return fn(usuario, entidadId);
}

/** Reconoce el formato por su firma. Devuelve { mime, extension } o null. */
export function detectarTipo(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: 'png' };
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-') return { mime: 'application/pdf', extension: 'pdf' };
  return null;
}

/**
 * Quita de un JPEG los segmentos APP1 (EXIF / XMP) y APP13 (IPTC), que pueden traer la ubicación,
 * el modelo del teléfono o la fecha. Si la estructura no es válida, devuelve null.
 */
export function limpiarJpeg(buf) {
  const partes = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marcador = buf[i + 1];
    if (marcador === 0xda) { partes.push(buf.subarray(i)); return Buffer.concat(partes); } // inicio de la imagen
    const largo = buf.readUInt16BE(i + 2);
    if (largo < 2 || i + 2 + largo > buf.length) return null;
    if (marcador !== 0xe1 && marcador !== 0xed) partes.push(buf.subarray(i, i + 2 + largo));
    i += 2 + largo;
  }
  return null;
}

/** Nombre para mostrar: sin rutas ni caracteres de control, con la extensión real. */
function nombreSeguro(nombre, extension) {
  const base = path.basename(String(nombre ?? '')).replace(/[\u0000-\u001f\u007f"\\/<>:|?*]/g, '').trim();
  const sinExt = base.replace(/\.[^.]*$/, '').slice(0, 80) || 'archivo';
  return `${sinExt}.${extension}`;
}

const SELECT = `
  SELECT a.id, a.entidad, a.entidad_id, a.nombre_original, a.mime, a.tamano_bytes, a.created_at,
         a.subido_por, CONCAT(u.nombre, ' ', u.apellido) AS subido_por_nombre
  FROM adjuntos a JOIN usuarios u ON u.id = a.subido_por`;

export async function listar(usuario, entidad, entidadId) {
  const { puedeEscribir, puedeGestionar } = await acceso(usuario, entidad, entidadId);
  const filas = await query(`${SELECT} WHERE a.entidad = ? AND a.entidad_id = ? ORDER BY a.created_at, a.id`, [entidad, entidadId]);
  return {
    data: filas.map((a) => ({ ...a, puede_borrar: puedeEscribir && (a.subido_por === usuario.id || puedeGestionar) })),
    meta: { puede_agregar: puedeEscribir && filas.length < MAX_POR_ENTIDAD, maximo: MAX_POR_ENTIDAD },
  };
}

export async function subir(usuario, entidad, entidadId, nombre, cuerpo, req) {
  if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) throw errores.validacion([], 'No llegó ningún archivo');
  const { puedeEscribir } = await acceso(usuario, entidad, entidadId);
  if (!puedeEscribir) throw errores.prohibido('No podés agregar archivos acá');

  const tipo = detectarTipo(cuerpo);
  if (!tipo) throw errores.validacion([], 'Formato no permitido. Subí una foto (JPG, PNG o WebP) o un PDF.');
  let datos = cuerpo;
  if (tipo.mime === 'image/jpeg') {
    datos = limpiarJpeg(cuerpo);
    if (!datos) throw errores.validacion([], 'La imagen está dañada');
  }

  const [{ total }] = await query('SELECT COUNT(*) AS total FROM adjuntos WHERE entidad = ? AND entidad_id = ?', [entidad, entidadId]);
  if (total >= MAX_POR_ENTIDAD) throw errores.negocio(`Se pueden adjuntar hasta ${MAX_POR_ENTIDAD} archivos`);

  const archivo = randomUUID();
  await fs.mkdir(CARPETA, { recursive: true });
  await fs.writeFile(path.join(CARPETA, archivo), datos, { flag: 'wx' });
  try {
    const r = await query(
      `INSERT INTO adjuntos (entidad, entidad_id, nombre_original, nombre_archivo, extension, mime, tamano_bytes, subido_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entidad, entidadId, nombreSeguro(nombre, tipo.extension), archivo, tipo.extension, tipo.mime, datos.length, usuario.id],
    );
    await auditar(req, { accion: 'adjunto_subido', entidad, entidadId, detalle: { adjunto: r.insertId, bytes: datos.length } });
    return queryOne(`${SELECT} WHERE a.id = ?`, [r.insertId]);
  } catch (err) {
    await fs.rm(path.join(CARPETA, archivo), { force: true });
    throw err;
  }
}

async function cargar(usuario, id) {
  const a = await queryOne('SELECT * FROM adjuntos WHERE id = ?', [id]);
  if (!a) throw errores.noEncontrado('El archivo no existe');
  const permisos = await acceso(usuario, a.entidad, a.entidad_id); // 404 si no ve la entidad
  return { a, ...permisos };
}

/** Devuelve los datos para enviar el archivo. La ruta se arma solo con el UUID de la base. */
export async function abrir(usuario, id) {
  const { a } = await cargar(usuario, id);
  if (!/^[0-9a-f-]{36}$/.test(a.nombre_archivo)) throw errores.noEncontrado('El archivo no existe');
  const ruta = path.join(CARPETA, a.nombre_archivo);
  if (!ruta.startsWith(CARPETA + path.sep)) throw errores.noEncontrado('El archivo no existe');
  return { ruta, mime: a.mime, nombre: a.nombre_original };
}

export async function borrar(usuario, id, req) {
  const { a, puedeEscribir, puedeGestionar } = await cargar(usuario, id);
  if (!puedeEscribir || (a.subido_por !== usuario.id && !puedeGestionar)) throw errores.prohibido('No podés borrar este archivo');
  await query('DELETE FROM adjuntos WHERE id = ?', [id]);
  await fs.rm(path.join(CARPETA, a.nombre_archivo), { force: true });
  await auditar(req, { accion: 'adjunto_borrado', entidad: a.entidad, entidadId: a.entidad_id, detalle: { adjunto: a.id } });
}
