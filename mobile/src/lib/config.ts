// Configuración de la app. Las variables EXPO_PUBLIC_* quedan DENTRO del APK:
// solo pueden contener datos públicos (URLs, ids de cliente OAuth), nunca secretos.

const url = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');

// En la versión de producción la API solo se usa por HTTPS (los tokens no pueden viajar en claro).
if (!__DEV__ && !url.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL debe usar https:// en la versión de producción');
}

export const API_URL = url;
export const TIMEOUT_MS = 15000;
