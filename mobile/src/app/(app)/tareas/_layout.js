// Navegación de "Mis tareas": la lista y el detalle de cada una.
import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../../tema';
import { botonVolver, useReiniciarAlSalir } from '../../../lib/volver';

export const unstable_settings = { anchor: 'index' };

const VOLVER = botonVolver('/tareas');

export default function LayoutMisTareas() {
  const t = useTema();
  useReiniciarAlSalir('tareas');
  return (
    <Stack screenOptions={{ ...opcionesCabecera(t), headerLeft: VOLVER }}>
      <Stack.Screen name="index" options={{ title: 'Mis tareas' }} />
      <Stack.Screen name="[id]" options={{ title: 'Tarea' }} />
    </Stack>
  );
}
