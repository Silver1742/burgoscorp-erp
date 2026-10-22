// Pool de conexiones MySQL. Todas las consultas usan parámetros `?` (nunca concatenar valores).
import mysql from 'mysql2/promise';
import env from './env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',          // fechas en UTC
  dateStrings: ['DATE'],  // DATE como 'YYYY-MM-DD', sin corrimientos de zona horaria
  decimalNumbers: true,   // DECIMAL como número
  supportBigNumbers: true,
});

/** Ejecuta una consulta y devuelve las filas. */
export async function query(sql, params = []) {
  const [filas] = await pool.execute(sql, params);
  return filas;
}

/** Devuelve la primera fila o null. */
export async function queryOne(sql, params = []) {
  const filas = await query(sql, params);
  return filas[0] ?? null;
}

/**
 * Ejecuta `fn(conexion)` dentro de una transacción.
 * Si `fn` lanza un error se hace rollback y el error se propaga.
 */
export async function transaccion(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
