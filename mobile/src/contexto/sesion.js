// Estado global de la sesión (Context API + useReducer).
// Guarda el usuario, sus permisos y el paso pendiente de 2FA, y expone las acciones de login.
// La sesión persiste: al abrir la app se renueva con el refresh token guardado en SecureStore.
import { createContext, use, useCallback, useEffect, useMemo, useReducer } from 'react';
import { api, tokens, renovarSesion, leerRefreshGuardado, borrarRefreshGuardado } from '../lib/api';

const SesionContext = createContext(null);

const inicial = {
  cargando: true,       // restaurando la sesión al abrir la app
  usuario: null,
  permisos: {},
  pendiente2fa: null,   // { tokenTemporal } cuando el login pide el segundo paso
};

function reducer(estado, accion) {
  switch (accion.tipo) {
    case 'INICIADA':
      return { ...estado, cargando: false, usuario: accion.usuario, permisos: accion.permisos, pendiente2fa: null };
    case 'PERFIL':
      return { ...estado, usuario: accion.usuario, permisos: accion.permisos };
    case 'REQUIERE_2FA':
      return { ...estado, pendiente2fa: { tokenTemporal: accion.tokenTemporal } };
    case 'CANCELAR_2FA':
      return { ...estado, pendiente2fa: null };
    case 'CERRADA':
      return { ...inicial, cargando: false };
    default:
      return estado;
  }
}

export function SesionProvider({ children }) {
  const [estado, despachar] = useReducer(reducer, inicial);

  const cargarPerfil = useCallback(async () => {
    const { usuario, permisos } = await api('/auth/yo');
    return { usuario, permisos };
  }, []);

  /** Guarda los tokens de una sesión nueva y carga permisos. */
  const abrirSesion = useCallback(async (sesion) => {
    await tokens.guardarSesion(sesion);
    const perfil = await cargarPerfil();
    despachar({ tipo: 'INICIADA', ...perfil });
  }, [cargarPerfil]);

  const cerrarLocal = useCallback(async () => {
    tokens.limpiar();
    await borrarRefreshGuardado();
    despachar({ tipo: 'CERRADA' });
  }, []);

  // Al abrir la app: si hay refresh token guardado, se renueva la sesión.
  useEffect(() => {
    tokens.alExpirar(() => { cerrarLocal(); });
    (async () => {
      try {
        if (!(await leerRefreshGuardado())) throw new Error('sin sesión');
        await renovarSesion();
        const perfil = await cargarPerfil();
        despachar({ tipo: 'INICIADA', ...perfil });
      } catch (err) {
        // Sin conexión se conserva el refresh token para reintentar en el próximo inicio.
        if (err.status === 0) despachar({ tipo: 'CERRADA' });
        else await cerrarLocal();
      }
    })();
  }, [cargarPerfil, cerrarLocal]);

  /** Procesa la respuesta de login / social: sesión directa o pedido de 2FA. */
  const procesarRespuestaLogin = useCallback(async (respuesta) => {
    if (respuesta.requiere2fa) {
      despachar({ tipo: 'REQUIERE_2FA', tokenTemporal: respuesta.tokenTemporal });
      return { requiere2fa: true };
    }
    await abrirSesion(respuesta);
    return { requiere2fa: false };
  }, [abrirSesion]);

  const acciones = useMemo(() => ({
    async login(email, password) {
      const r = await api('/auth/login', { metodo: 'POST', cuerpo: { email, password }, conToken: false });
      return procesarRespuestaLogin(r);
    },

    async loginSocial(proveedor, datos) {
      const r = await api(`/auth/social/${proveedor}`, { metodo: 'POST', cuerpo: datos, conToken: false });
      return procesarRespuestaLogin(r);
    },

    async registrar(datos) {
      const sesion = await api('/auth/registro', { metodo: 'POST', cuerpo: datos, conToken: false });
      await abrirSesion(sesion);
    },

    async completar2fa(metodo, codigo) {
      const sesion = await api('/auth/2fa/verificar', {
        metodo: 'POST',
        cuerpo: { tokenTemporal: estado.pendiente2fa?.tokenTemporal, metodo, codigo },
        conToken: false,
      });
      await abrirSesion(sesion);
    },

    async enviarCodigo2faPorEmail() {
      await api('/auth/2fa/email', {
        metodo: 'POST', cuerpo: { tokenTemporal: estado.pendiente2fa?.tokenTemporal }, conToken: false,
      });
    },

    cancelar2fa() {
      despachar({ tipo: 'CANCELAR_2FA' });
    },

    /** Recarga perfil y permisos (después de verificar el email, activar 2FA, etc.). */
    async refrescarPerfil() {
      const perfil = await cargarPerfil();
      despachar({ tipo: 'PERFIL', ...perfil });
    },

    /** Reemplaza la sesión (el backend emite una nueva al cambiar la contraseña). */
    abrirSesion,

    async logout({ todas = false } = {}) {
      try {
        if (todas) await api('/auth/logout-todas', { metodo: 'POST' });
        else {
          const refreshToken = await leerRefreshGuardado();
          if (refreshToken) await api('/auth/logout', { metodo: 'POST', cuerpo: { refreshToken }, conToken: false });
        }
      } catch {
        // Aunque falle la llamada (sin conexión), la sesión local se cierra igual.
      }
      await cerrarLocal();
    },
  }), [abrirSesion, cargarPerfil, cerrarLocal, estado.pendiente2fa, procesarRespuestaLogin]);

  const valor = useMemo(() => ({ ...estado, ...acciones }), [estado, acciones]);
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const valor = use(SesionContext);
  if (!valor) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return valor;
}

/** ¿El usuario puede hacer `accion` en `modulo`? Solo para mostrar u ocultar UI: el servidor valida siempre. */
export function usePuede() {
  const { permisos } = useSesion();
  return useCallback((modulo, accion = 'ver') => Boolean(permisos?.[modulo]?.[accion]), [permisos]);
}
