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
      <Stack.Screen name="rrhh/personal" options={{ title: 'Personal' }} />
      <Stack.Screen name="rrhh/legajo/[id]" options={{ title: 'Legajo' }} />
      <Stack.Screen name="produccion/index" options={{ title: 'Órdenes de trabajo' }} />
      <Stack.Screen name="produccion/nueva" options={{ title: 'Nueva orden de trabajo' }} />
      <Stack.Screen name="produccion/[id]" options={{ title: 'Orden de trabajo' }} />
      <Stack.Screen name="tareas/index" options={{ title: 'Tareas del área' }} />
      <Stack.Screen name="tareas/nueva" options={{ title: 'Nueva tarea' }} />
      <Stack.Screen name="tareas/[id]" options={{ title: 'Tarea' }} />
      <Stack.Screen name="escanear" options={{ title: 'Escanear' }} />
      <Stack.Screen name="inventario/index" options={{ title: 'Stock' }} />
      <Stack.Screen name="inventario/[id]" options={{ title: 'Producto' }} />
      <Stack.Screen name="compras/index" options={{ title: 'Órdenes de compra' }} />
      <Stack.Screen name="compras/nueva" options={{ title: 'Nueva orden de compra' }} />
      <Stack.Screen name="compras/[id]" options={{ title: 'Orden de compra' }} />
      <Stack.Screen name="mantenimiento/index" options={{ title: 'Mantenimiento' }} />
      <Stack.Screen name="mantenimiento/nueva" options={{ title: 'Reportar una falla' }} />
      <Stack.Screen name="mantenimiento/[id]" options={{ title: 'Orden de mantenimiento' }} />
      <Stack.Screen name="mantenimiento/maquina/[id]" options={{ title: 'Máquina' }} />
      <Stack.Screen name="ventas/index" options={{ title: 'Ventas' }} />
      <Stack.Screen name="ventas/nueva" options={{ title: 'Nueva solicitud' }} />
      <Stack.Screen name="ventas/solicitud/[id]" options={{ title: 'Solicitud' }} />
      <Stack.Screen name="ventas/presupuesto/nuevo" options={{ title: 'Nuevo presupuesto' }} />
      <Stack.Screen name="ventas/presupuesto/[id]" options={{ title: 'Presupuesto' }} />
      <Stack.Screen name="calidad/index" options={{ title: 'Calidad' }} />
      <Stack.Screen name="calidad/inspeccionar/[otId]" options={{ title: 'Inspección' }} />
      <Stack.Screen name="calidad/[id]" options={{ title: 'Inspección' }} />
      <Stack.Screen name="finanzas/index" options={{ title: 'Finanzas' }} />
      <Stack.Screen name="finanzas/[id]" options={{ title: 'Comprobante' }} />
      <Stack.Screen name="tablero" options={{ title: 'Tablero' }} />
      <Stack.Screen name="usuarios/index" options={{ title: 'Usuarios' }} />
      <Stack.Screen name="usuarios/nuevo" options={{ title: 'Nuevo usuario' }} />
      <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuario' }} />
      <Stack.Screen name="usuarios/solicitudes" options={{ title: 'Solicitudes de acceso' }} />
    </Stack>
  );
}
