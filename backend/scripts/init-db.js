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
  ssl: env.dbSsl,
  multipleStatements: true, // solo en este script, con archivos del repositorio (nunca con datos de usuarios)
  charset: 'utf8mb4',
});

/** Tablas que llena seed.sql, en el orden en que las llena. */
function tablasDelSeed(sql) {
  return [...new Set([...sql.matchAll(/^INSERT INTO (\w+)/gim)].map((m) => m[1]))]
    .filter((t) => !t.startsWith('tmp_'));
}

const aplicar = async (archivo) => {
  await conexion.query(adaptar(await fs.readFile(path.join(carpeta, archivo), 'utf8')));
  console.log(`${archivo} aplicado.`);
};

try {
  const [[{ tablas }]] = await conexion.query(
    'SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ?', [env.DB_NAME]);
  if (tablas === 0) {
    await aplicar('schema.sql');
    await aplicar('seed.sql');
    console.log(`Base "${env.DB_NAME}" lista. Para los usuarios de prueba: npm run seed (en producción, con SEED_PASSWORD).`);
  } else {
    // seed.sql termina cargando las secuencias: si no están, la carga se cortó a la mitad. Se reintenta
    // solo si todavía no hay usuarios (o sea, nadie empezó a usar la base).
    const [[{ secuencias }]] = await conexion.query('SELECT COUNT(*) AS secuencias FROM secuencias');
    const [[{ usuarios }]] = await conexion.query('SELECT COUNT(*) AS usuarios FROM usuarios');
    if (secuencias === 0 && usuarios === 0) {
      console.log('La carga de catálogos quedó incompleta: se vuelve a hacer.');
      const sql = await fs.readFile(path.join(carpeta, 'seed.sql'), 'utf8');
      await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const tabla of tablasDelSeed(sql).reverse()) await conexion.query(`DELETE FROM \`${tabla}\``);
      await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
      await aplicar('seed.sql');
    } else {
      console.log(`La base "${env.DB_NAME}" ya tiene ${tablas} tablas: no se toca nada.`);
    }
  }
} finally {
  await conexion.end();
}
