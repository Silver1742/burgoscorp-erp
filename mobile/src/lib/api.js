// Cliente HTTP de la API.
//  - Agrega `Authorization: Bearer <accessToken>`.
//  - Si el access token venció (401 TOKEN_EXPIRADO), lo renueva una sola vez con el refresh token
//    y repite la petición. Si varias peticiones vencen a la vez, comparten la misma renovación.
//  - Convierte cualquier error (red, timeout, respuesta de la API) en un ApiError con un
//    mensaje en castellano listo para mostrar.
import { API_URL, TIMEOUT_MS } from './config';
import { leerRefresh, guardarRefresh, borrarRefresh } from './almacen';
import { describirErrores } from './campos';

export class ApiError extends Error {
  constructor(status, codigo, mensaje, detalles = []) {
    // Datos inválidos: el aviso dice qué campo revisar (además de marcarlo en el formulario).
    super((codigo === 'VALIDACION' && describirErrores(detalles)) || mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  /** Errores de validación por campo: { email: 'Email inválido', ... } */
  get porCampo() {
    const mapa = {};
    for (const d of this.detalles ?? []) {
      const campo = d.campo?.replace(/^(body|query|params)\./, '');
      if (campo && !mapa[campo]) mapa[campo] = d.mensaje;
    }
    return mapa;
  }
}

let accessToken = null;
let renovando = null;
let alExpirarSesion = () => {};

export const tokens = {
  setAcceso(t) { accessToken = t; },
  limpiar() { accessToken = null; },
  async guardarSesion(sesion) {
    accessToken = sesion.accessToken;
    await guardarRefresh(sesion.refreshToken);
  },
  /** El contexto de sesión registra qué hacer si la renovación falla (volver al login). */
  alExpirar(fn) { alExpirarSesion = fn; },
};

// `binario` (Blob) sube un archivo tal cual con su tipo; `comoBlob` devuelve el archivo descargado.
async function llamar(ruta, { metodo = 'GET', cuerpo, consulta, conToken = true, binario, comoBlob = false, timeout = TIMEOUT_MS } = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeout);

  let url = `${API_URL}${ruta}`;
  if (consulta) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(consulta)) {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const cabeceras = { Accept: comoBlob ? '*/*' : 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (binario) cabeceras['Content-Type'] = binario.type;
  if (conToken && accessToken) cabeceras.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: cabeceras,
      body: binario ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
      signal: controlador.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'El servidor tardó demasiado en responder. Probá de nuevo.');
    }
    throw new ApiError(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revisá tu conexión a internet.');
  } finally {
    clearTimeout(temporizador);
  }

  if (res.status === 204) return null;
  if (comoBlob && res.ok) return res.blob();
  const datos = await res.json().catch(() => null);
  if (!res.ok || !datos?.ok) {
    const e = datos?.error;
    throw new ApiError(res.status, e?.codigo ?? 'ERROR', e?.mensaje ?? mensajePorEstado(res.status), e?.detalles);
  }
  return datos.meta ? { data: datos.data, meta: datos.meta } : datos.data;
}

function mensajePorEstado(status) {
  if (status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.';
  if (status === 403) return 'No tenés permiso para hacer esto.';
  if (status === 404) return 'No se encontró lo que buscabas.';
  if (status === 429) return 'Demasiados intentos. Esperá unos minutos.';
  if (status >= 500) return 'El servidor tuvo un problema. Probá de nuevo más tarde.';
  return 'Ocurrió un error inesperado.';
}

/** Pide un access token nuevo. Devuelve la sesión o null si ya no hay sesión válida. */
export function renovarSesion() {
  if (!renovando) {
    renovando = (async () => {
      const refresh = await leerRefresh();
      if (!refresh) return null;
      try {
        const sesion = await llamar('/auth/refresh', { metodo: 'POST', cuerpo: { refreshToken: refresh }, conToken: false });
        await tokens.guardarSesion(sesion);
        return sesion;
      } catch (err) {
        // Sin conexión no se borra la sesión: se podrá reintentar.
        if (err.status === 401) {
          await borrarRefresh();
          accessToken = null;
        }
        throw err;
      }
    })().finally(() => { renovando = null; });
  }
  return renovando;
}

/** Petición autenticada con renovación automática del token. */
export async function api(ruta, opciones = {}) {
  try {
    return await llamar(ruta, opciones);
  } catch (err) {
    const vencido = err.status === 401 && err.codigo === 'TOKEN_EXPIRADO' && opciones.conToken !== false;
    if (!vencido) throw err;
    try {
      const sesion = await renovarSesion();
      if (!sesion) throw err;
    } catch (errRenovacion) {
      if (errRenovacion.status === 401 || errRenovacion === err) alExpirarSesion();
      throw errRenovacion;
    }
    return llamar(ruta, opciones);
  }
}

export const leerRefreshGuardado = leerRefresh;
export const borrarRefreshGuardado = borrarRefresh;
