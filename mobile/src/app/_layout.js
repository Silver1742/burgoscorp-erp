// Layout raíz: provee la sesión y decide qué grupo de pantallas se puede ver.
//   sin sesión                 → (auth): login, registro, recuperar contraseña
//   login pidió el 2do paso    → dos-pasos
//   sesión sin email verificado → verificar-email
//   sesión completa            → (app): pestañas según el rol
// Las rutas protegidas solo ordenan la navegación: los permisos reales los valida la API.
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '../contexto/sesion';
import { TemaProvider, useTema, opcionesCabecera } from '../tema';
import { ToastProvider } from '../contexto/toast';
import IntroSplash from '../componentes/IntroSplash';

SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <ToastProvider>
          <SesionProvider>
            <ControlSplash />
            <Navegador />
          </SesionProvider>
          <IntroSplash />
        </ToastProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

function ControlSplash() {
  const { cargando } = useSesion();
  if (!cargando) SplashScreen.hide();
  return null;
}

function Navegador() {
  const { cargando, usuario, pendiente2fa } = useSesion();
  const t = useTema();
  if (cargando) return null;

  const conSesion = Boolean(usuario);
  const verificado = Boolean(usuario?.emailVerificado);
  // Un único destino según el estado: si cada grupo redirigiera a un lugar fijo,
  // las redirecciones podrían rebotar entre grupos bloqueados (ej. login → / → login).
  const destino = conSesion
    ? (verificado ? '/' : '/verificar-email')
    : (pendiente2fa ? '/dos-pasos' : '/login');

  return (
    <>
      {/* Con sesión la cabecera es negra (íconos blancos); sin sesión el fondo sigue el modo */}
      <StatusBar style={conSesion || t.modo === 'oscuro' ? 'light' : 'dark'} />
      <Stack screenOptions={opcionesCabecera(t)}>
        <Stack.Protected guard={conSesion && verificado} redirectTo={destino}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={conSesion && !verificado} redirectTo={destino}>
          <Stack.Screen name="verificar-email" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!conSesion && Boolean(pendiente2fa)} redirectTo={destino}>
          <Stack.Screen name="dos-pasos" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!conSesion && !pendiente2fa} redirectTo={destino}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
