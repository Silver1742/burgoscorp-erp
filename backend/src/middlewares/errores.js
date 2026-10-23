// Manejo centralizado de errores. Al cliente le llega un mensaje claro y genérico;
// el detalle técnico queda solo en la consola del servidor.
import { AppError } from '../utils/errores.js';

export function rutaNoEncontrada(req, res) {
  res.status(404).json({ ok: false, error: { codigo: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' } });
}

// Códigos de error de MySQL / MariaDB que se deben a datos del cliente.
const ERRORES_MYSQL = {
  ER_DUP_ENTRY: [409, 'DUPLICADO', 'Ya existe un registro con esos datos'],
  ER_NO_REFERENCED_ROW_2: [400, 'REFERENCIA_INVALIDA', 'Uno de los datos hace referencia a un registro que no existe'],
  ER_ROW_IS_REFERENCED_2: [409, 'EN_USO', 'No se puede borrar: el registro está en uso'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'VALIDACION', 'Los datos no cumplen las reglas del sistema'], // MySQL 3819
  ER_CONSTRAINT_FAILED: [400, 'VALIDACION', 'Los datos no cumplen las reglas del sistema'],         // MariaDB 4025
  ER_DATA_TOO_LONG: [400, 'VALIDACION', 'Uno de los campos es demasiado largo'],
  ER_WARN_DATA_OUT_OF_RANGE: [400, 'VALIDACION', 'Uno de los valores está fuera de rango'],
  ER_TRUNCATED_WRONG_VALUE: [400, 'VALIDACION', 'Uno de los campos tiene un formato inválido'],
  WARN_DATA_TRUNCATED: [400, 'VALIDACION', 'Uno de los campos tiene un valor inválido'],
};

// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      ok: false,
      error: { codigo: err.codigo, mensaje: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) },
    });
  }

  // JSON mal formado o cuerpo demasiado grande (body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es un JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: { codigo: 'DEMASIADO_GRANDE', mensaje: 'El cuerpo de la petición es demasiado grande' } });
  }

  // Las violaciones de CHECK tienen distinto nombre según el motor: se reconocen también por número.
  const porNumero = { 3819: 'ER_CHECK_CONSTRAINT_VIOLATED', 4025: 'ER_CONSTRAINT_FAILED' }[err.errno];
  const mysql = ERRORES_MYSQL[err.code] ?? ERRORES_MYSQL[porNumero];
  if (mysql) {
    const [status, codigo, mensaje] = mysql;
    return res.status(status).json({ ok: false, error: { codigo, mensaje } });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Probá de nuevo más tarde.' } });
}
