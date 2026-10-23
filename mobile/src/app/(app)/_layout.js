// Pestañas principales. "Módulos" muestra solo los módulos que el rol puede ver.
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTema } from '../../tema';

const icono = (nombre) => ({ color, size }) => <Ionicons name={nombre} size={size} color={color} />;

export default function LayoutApp() {
  const t = useTema();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.barra },
      headerTintColor: t.barraTexto,
      headerTitleStyle: { color: t.barraTexto },
      tabBarStyle: { backgroundColor: t.barra, borderTopColor: t.barraBorde },
      tabBarActiveTintColor: t.acento,
      tabBarInactiveTintColor: t.barraTextoSuave,
      sceneStyle: { backgroundColor: t.fondo },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono('home-outline') }} />
      <Tabs.Screen name="tareas" options={{ title: 'Mis tareas', tabBarIcon: icono('checkbox-outline') }} />
      <Tabs.Screen name="modulos" options={{ title: 'Módulos', headerShown: false, tabBarIcon: icono('apps-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', headerShown: false, tabBarIcon: icono('person-circle-outline') }} />
    </Tabs>
  );
}
