// Punto de entrada: levanta el servidor HTTP con timeouts y apagado ordenado.
import env from './config/env.js';
import { pool } from './config/db.js';
import { crearApp } from './app.js';

const app = crearApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`API de BurgosCorp escuchando en http://${env.HOST}:${env.PORT}/api/v1`);
});

// Cortar conexiones lentas o colgadas (mitiga ataques tipo Slowloris).
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

function apagar(senal) {
  console.log(`${senal} recibido, cerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
