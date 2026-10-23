// Guarda el refresh token en el almacenamiento cifrado del sistema (Keystore en Android,
// Keychain en iOS) con expo-secure-store. Nunca en AsyncStorage.
// En la web (solo para probar en el navegador) SecureStore no existe: se guarda en memoria,
// así que la sesión no sobrevive a recargar la página. En el celular sí persiste.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE_REFRESH = 'burgoscorp.refresh';
const enMemoria = new Map();
const esWeb = Platform.OS === 'web';

export async function leerRefresh() {
  if (esWeb) return enMemoria.get(CLAVE_REFRESH) ?? null;
  try {
    return await SecureStore.getItemAsync(CLAVE_REFRESH);
  } catch {
    return null;
  }
}

export async function guardarRefresh(token) {
  if (esWeb) {
    enMemoria.set(CLAVE_REFRESH, token);
    return;
  }
  await SecureStore.setItemAsync(CLAVE_REFRESH, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function borrarRefresh() {
  if (esWeb) {
    enMemoria.delete(CLAVE_REFRESH);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(CLAVE_REFRESH);
  } catch {
    // si no existía no hay nada que borrar
  }
}
