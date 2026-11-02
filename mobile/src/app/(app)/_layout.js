// Pestañas principales. Barra negra en los dos modos; la pestaña activa en blanco con línea de color
// (como .bc-navbar .nav-link.active del portal R3). A la derecha: escanear QR, modo claro/oscuro y avatar.
//
// Cada rol tiene sus pestañas y su color (lib/roles.js), así se nota desde dónde se está usando:
//   Empleado      Mi día · Mis tareas · Buscar · Perfil
//   Jefe de área  Mi área · Mis tareas · Mi equipo · Buscar · Perfil
//   Gerencia      La empresa · Áreas · Buscar · Perfil
//   Administrador Administración · Áreas · Buscar · Perfil
// "Módulos" ya no es una pestaña: el menú completo está en Buscar.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { perfilRol } from '../../lib/roles';

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

/** Escudo y, al lado, el rol con su color: se ve en cada pantalla principal. */
function MarcaRol({ rol }) {
  const r = perfilRol(rol);
  return (
    <View style={estilos.marca}>
      <Escudo tamano={28} />
      <View style={[estilos.pildora, { backgroundColor: r.color }]}>
        <Ionicons name={r.icono} size={12} color="#ffffff" />
        <Text style={estilos.pildoraTexto}>{r.titulo}</Text>
      </View>
    </View>
  );
}

function Pestanas() {
  const t = useTema();
  const { usuario } = useSesion();
  const rol = usuario?.rol ?? 'EMPLEADO';
  const r = perfilRol(rol);
  const icono = (nombre) => (props) => <IconoPestana nombre={nombre} rojo={r.color} {...props} />;
  const conTareas = Boolean(usuario?.empleadoId) && ['EMPLEADO', 'JEFE'].includes(rol);
  const verEquipo = ['JEFE', 'GERENCIA', 'ADMIN'].includes(rol);
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.barra, borderBottomWidth: 1, borderBottomColor: t.barraBorde },
      headerTintColor: t.barraTexto,
      headerTitleStyle: { color: t.barraTexto, fontWeight: '600' },
      headerShadowVisible: false,
      headerTitle: '',
      headerLeft: () => <MarcaRol rol={rol} />,
      headerRight: () => <AccionesCabecera />,
      tabBarStyle: { backgroundColor: t.barra, borderTopColor: r.color, borderTopWidth: 3 },
      tabBarActiveTintColor: '#ffffff',
      tabBarInactiveTintColor: t.barraTextoInactivo,
      tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      sceneStyle: { backgroundColor: t.fondo },
    }}>
      <Tabs.Screen name="index" options={{ title: r.panel, tabBarIcon: icono('home') }} />
      <Tabs.Screen name="tareas" options={{ title: 'Mis tareas', headerShown: false, tabBarIcon: icono('checkbox'), href: conTareas ? undefined : null }} />
      <Tabs.Screen name="equipo" options={{
        title: rol === 'JEFE' ? 'Mi equipo' : 'Áreas', tabBarIcon: icono(rol === 'JEFE' ? 'people' : 'business'), href: verEquipo ? undefined : null,
      }} />
      <Tabs.Screen name="buscar" options={{ title: 'Buscar', tabBarIcon: icono('search') }} />
      {/* Sin botón en la barra (el menú está en Buscar), pero sus pantallas se siguen abriendo. */}
      <Tabs.Screen name="modulos" options={{ title: 'Menú', headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', headerShown: false, tabBarIcon: icono('person-circle') }} />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  icono: { alignItems: 'center', justifyContent: 'center' },
  indicador: { position: 'absolute', top: -7, width: 28, height: 3, borderRadius: 2 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 14 },
  pildora: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pildoraTexto: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});
