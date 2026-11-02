// Navegación del perfil: datos, verificación en dos pasos, avisos y ayuda.
import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../../tema';
import { botonVolver, useReiniciarAlSalir } from '../../../lib/volver';

export const unstable_settings = { anchor: 'index' };

const VOLVER = botonVolver('/perfil', { inicioOculto: true });

export default function LayoutPerfil() {
  const t = useTema();
  useReiniciarAlSalir('perfil');
  return (
    // Perfil se abre desde el menú del avatar: "volver" lleva a la pantalla donde estabas.
    <Stack id={undefined} screenOptions={{ ...opcionesCabecera(t), headerLeft: VOLVER }}>
      <Stack.Screen name="index" options={{ title: 'Perfil' }} />
      <Stack.Screen name="dos-pasos" options={{ title: 'Verificación en dos pasos' }} />
      <Stack.Screen name="notificaciones" options={{ title: 'Avisos' }} />
      <Stack.Screen name="ayuda" options={{ title: 'Ayuda' }} />
    </Stack>
  );
}
