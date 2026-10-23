import { Stack } from 'expo-router';
import { useTema } from '../../tema';

export default function LayoutAuth() {
  const t = useTema();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: t.superficie },
      headerTintColor: t.texto,
      contentStyle: { backgroundColor: t.fondo },
    }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="olvide" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="restablecer" options={{ title: 'Nueva contraseña' }} />
    </Stack>
  );
}
