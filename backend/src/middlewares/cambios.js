// Contador de cambios para que la app se actualice sola.
// Cada vez que una petición que modifica datos (POST, PUT, PATCH o DELETE) termina bien, el contador
// sube. La app pregunta cada tantos segundos por GET /cambios y, si el número es otro, recarga la
// pantalla que se está viendo. Solo dice "algo cambió": no qué ni quién (eso lo filtra cada
// listado con los permisos de siempre).
// Vive en memoria: alcanza con una sola instancia del servidor. Al reiniciarse cambia el inicio,
// así que la app también recarga.
const inicio = Date.now().toString(36);
let cambios = 0;

const LECTURAS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function contarCambios(req, res, next) {
  if (!LECTURAS.has(req.method) && !req.path.startsWith('/api/v1/auth')) {
    res.on('finish', () => { if (res.statusCode < 400) cambios += 1; });
  }
  next();
}

export const versionCambios = () => `${inicio}-${cambios}`;
