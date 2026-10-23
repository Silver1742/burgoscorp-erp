// Preferencias de la app que NO son sensibles (ej. modo claro/oscuro).
// En el celular se guardan con SecureStore (ya está instalado); en la web, en localStorage.
// Los tokens nunca pasan por acá: van en lib/almacen.js.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const prefijo = 'burgoscorp.pref.';

export async function leerPreferencia(clave) {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(prefijo + clave) ?? null;
    return await SecureStore.getItemAsync(prefijo + clave);
  } catch {
    return null;
  }
}

export async function guardarPreferencia(clave, valor) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(prefijo + clave, valor);
    else await SecureStore.setItemAsync(prefijo + clave, valor);
  } catch {
    // si no se puede guardar, la preferencia vale solo hasta cerrar la app
  }
}
