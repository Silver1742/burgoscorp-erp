import { Stack } from 'expo-router';
import { useTema, opcionesCabecera } from '../../../tema';

// Si se entra directo a un listado (desde Inicio), la grilla de módulos queda debajo para poder volver.
export const unstable_settings = { anchor: 'index' };

export default function LayoutModulos() {
  const t = useTema();
  return (
    <Stack screenOptions={opcionesCabecera(t)}>
      <Stack.Screen name="index" options={{ title: 'Módulos' }} />
      <Stack.Screen name="rrhh/licencias" options={{ title: 'Mis licencias y vacaciones' }} />
      <Stack.Screen name="rrhh/aprobaciones" options={{ title: 'Aprobar licencias' }} />
      <Stack.Screen name="rrhh/organigrama" options={{ title: 'Organigrama' }} />
      <Stack.Screen name="rrhh/legajo/[id]" options={{ title: 'Legajo' }} />
    </Stack>
  );
}
