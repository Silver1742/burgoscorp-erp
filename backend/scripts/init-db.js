// Crea las tablas y carga los catálogos base (db/schema.sql + db/seed.sql) en la base que indica
// el .env. Pensado para la base de la nube (Railway), donde la base ya existe con otro nombre:
// se quitan las líneas CREATE DATABASE / USE de los archivos y se usa DB_NAME.
//
//   npm run db:init
//
// No hace nada si la base ya tiene tablas (para no borrar datos por error).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../src/config/env.js';

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db');

/** Saca CREATE DATABASE (que puede ocupar dos líneas) y USE: la base la elige la conexión. */
function adaptar(sql) {
  return sql
    .replace(/CREATE DATABASE[^;]*;/gi, '')
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, '');
}

const conexion = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  multipleStatements: true, // solo en este script, con archivos del repositorio (nunca con datos de usuarios)
  charset: 'utf8mb4',
});

try {
  const [[{ tablas }]] = await conexion.query(
    'SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ?', [env.DB_NAME]);
  if (tablas > 0) {
    console.log(`La base "${env.DB_NAME}" ya tiene ${tablas} tablas: no se toca nada.`);
  } else {
    for (const archivo of ['schema.sql', 'seed.sql']) {
      await conexion.query(adaptar(await fs.readFile(path.join(carpeta, archivo), 'utf8')));
      console.log(`${archivo} aplicado.`);
    }
    console.log(`Base "${env.DB_NAME}" lista. Para los usuarios de prueba: npm run seed (en producción, con SEED_PASSWORD).`);
  }
} finally {
  await conexion.end();
}
