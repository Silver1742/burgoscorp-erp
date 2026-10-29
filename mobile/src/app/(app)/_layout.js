// Pestañas principales. Barra negra en los dos modos; la pestaña activa en blanco con línea roja
// (como .bc-navbar .nav-link.active del portal R3). A la derecha: escanear QR, modo claro/oscuro y avatar.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Escudo } from '../../componentes/Marca';
import SelectorTema from '../../componentes/SelectorTema';
import { Avatar } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { useToast } from '../../contexto/toast';
import { destinoEscaneo } from '../../componentes/Escaner';
import { api } from '../../lib/api';
import { tomarQrPendiente } from '../../lib/qr';
import { useTema } from '../../tema';

function IconoPestana({ nombre, color, size, focused, rojo }) {
  return (
    <View style={estilos.icono}>
      {focused ? <View style={[estilos.indicador, { backgroundColor: rojo }]} /> : null}
      <Ionicons name={focused ? nombre : `${nombre}-outline`} size={size - 2} color={color} />
    </View>
  );
}

function AccionesCabecera() {
  const { usuario } = useSesion();
  const router = useRouter();
  return (
    <View style={estilos.acciones}>
      <Pressable onPress={() => router.push('/modulos/escanear', { withAnchor: true })} accessibilityRole="button" accessibilityLabel="Escanear un código QR" hitSlop={6} style={{ paddingHorizontal: 6 }}>
        <Ionicons name="qr-code-outline" size={22} color="#ffffff" />
      </Pressable>
      <SelectorTema compacto barra />
      <Pressable onPress={() => router.navigate('/perfil')} accessibilityRole="button" accessibilityLabel="Mi perfil" hitSlop={6} style={{ marginRight: 12 }}>
        <Avatar nombre={`${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`} tamano={30} />
      </Pressable>
    </View>
  );
}

/** Si antes de entrar se escaneó una etiqueta con la cámara del teléfono, se abre al entrar. */
function AbrirQrPendiente() {
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    const codigo = tomarQrPendiente();
    if (!codigo) return;
    api('/escaneo', { consulta: { codigo } })
      .then((r) => { const destino = destinoEscaneo(r); if (destino) router.push(destino, { withAnchor: true }); })
      .catch((err) => toast.error(err.message));
  }, [router, toast]);
  return null;
}

export default function LayoutApp() {
  return (
    <>
      <AbrirQrPendiente />
      <Pestanas />
    </>
  );
}

function Pestanas() {
  const t = useTema();
  const icono = (nombre) => (props) => <IconoPestana nombre={nombre} rojo={t.primario} {...props} />;
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.barra, borderBottomWidth: 1, borderBottomColor: t.barraBorde },
      headerTintColor: t.barraTexto,
      headerTitleStyle: { color: t.barraTexto, fontWeight: '600' },
      headerShadowVisible: false,
      headerLeft: () => <View style={{ marginLeft: 14 }}><Escudo tamano={28} /></View>,
      headerRight: () => <AccionesCabecera />,
      tabBarStyle: { backgroundColor: t.barra, borderTopColor: t.barraBorde },
      tabBarActiveTintColor: '#ffffff',
      tabBarInactiveTintColor: t.barraTextoInactivo,
      tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      sceneStyle: { backgroundColor: t.fondo },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono('home') }} />
      <Tabs.Screen name="tareas" options={{ title: 'Mis tareas', headerShown: false, tabBarIcon: icono('checkbox') }} />
      <Tabs.Screen name="modulos" options={{ title: 'Módulos', headerShown: false, tabBarIcon: icono('apps') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', headerShown: false, tabBarIcon: icono('person-circle') }} />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  icono: { alignItems: 'center', justifyContent: 'center' },
  indicador: { position: 'absolute', top: -7, width: 28, height: 3, borderRadius: 2 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
