import { Stack } from 'expo-router';
import { useTema } from '../../../tema';

export const unstable_settings = { anchor: 'index' };

export default function LayoutPerfil() {
  const t = useTema();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: t.superficie },
      headerTintColor: t.texto,
      contentStyle: { backgroundColor: t.fondo },
    }}>
      <Stack.Screen name="index" options={{ title: 'Perfil' }} />
      <Stack.Screen name="dos-pasos" options={{ title: 'Verificación en dos pasos' }} />
      <Stack.Screen name="notificaciones" options={{ title: 'Avisos' }} />
    </Stack>
  );
}
