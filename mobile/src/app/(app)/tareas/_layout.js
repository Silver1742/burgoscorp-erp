// Navegación de "Mis tareas": la lista y el detalle de cada una.
import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../../tema';
import { botonVolver, useAtrasDelTelefono } from '../../../lib/volver';

export const unstable_settings = { anchor: 'index' };

export default function LayoutMisTareas() {
  const t = useTema();
  useAtrasDelTelefono('/tareas');
  return (
    <Stack screenOptions={{ ...opcionesCabecera(t), headerLeft: botonVolver('/tareas') }}>
      <Stack.Screen name="index" options={{ title: 'Mis tareas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Tarea' }} />
    </Stack>
  );
}
