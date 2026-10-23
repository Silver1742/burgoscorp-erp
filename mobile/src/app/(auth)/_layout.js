import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../tema';

export default function LayoutAuth() {
  const t = useTema();
  return (
    <Stack screenOptions={opcionesCabecera(t)}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="olvide" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="restablecer" options={{ title: 'Nueva contraseña' }} />
    </Stack>
  );
}
