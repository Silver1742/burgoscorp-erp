import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../../tema';

export const unstable_settings = { anchor: 'index' };

export default function LayoutMisTareas() {
  const t = useTema();
  return (
    <Stack screenOptions={opcionesCabecera(t)}>
      <Stack.Screen name="index" options={{ title: 'Mis tareas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Tarea' }} />
    </Stack>
  );
}
