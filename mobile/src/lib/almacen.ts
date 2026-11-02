// Guarda el refresh token en el almacenamiento cifrado del sistema (Keystore en Android,
// Keychain en iOS) con expo-secure-store. Nunca en AsyncStorage.
// En la web SecureStore no existe: se guarda en localStorage para que la sesión sobreviva a
// recargar la página o abrir un QR en otra pestaña. Lo que limita el riesgo: el token es de un solo
// uso (cada renovación lo cambia y reusar uno viejo cierra todas las sesiones), vence en días y
// "Cerrar sesión" lo borra y lo revoca en el servidor.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE_REFRESH = 'burgoscorp.refresh';
const esWeb = Platform.OS === 'web';

// localStorage puede no estar o tirar error (modo privado, cookies bloqueadas): entonces la sesión
// dura hasta recargar, como antes.
const enMemoria = new Map();
const web = {
  leer: () => { try { return globalThis.localStorage.getItem(CLAVE_REFRESH); } catch { return enMemoria.get(CLAVE_REFRESH) ?? null; } },
  guardar: (v) => { try { globalThis.localStorage.setItem(CLAVE_REFRESH, v); } catch { enMemoria.set(CLAVE_REFRESH, v); } },
  borrar: () => { try { globalThis.localStorage.removeItem(CLAVE_REFRESH); } catch { /* nada */ } enMemoria.delete(CLAVE_REFRESH); },
};

export async function leerRefresh() {
  if (esWeb) return web.leer();
  try {
    return await SecureStore.getItemAsync(CLAVE_REFRESH);
  } catch {
    return null;
  }
}

export async function guardarRefresh(token) {
  if (esWeb) {
    web.guardar(token);
    return;
  }
  await SecureStore.setItemAsync(CLAVE_REFRESH, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function borrarRefresh() {
  if (esWeb) {
    web.borrar();
    return;
  }
  try {
    await SecureStore.deleteItemAsync(CLAVE_REFRESH);
  } catch {
    // si no existía no hay nada que borrar
  }
}
