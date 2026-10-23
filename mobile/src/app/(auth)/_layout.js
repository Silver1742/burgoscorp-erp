import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../tema';

// Las pantallas sin sesión usan AuthLayout (panel de marca), sin cabecera de navegación.
export default function LayoutAuth() {
  const t = useTema();
  return <Stack screenOptions={{ ...opcionesCabecera(t), headerShown: false }} />;
}
