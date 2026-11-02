// Pestañas principales (como la barra del portal R3). Barra negra con una línea roja y sombra roja
// abajo; la pestaña activa con el color del rol. A la derecha: escanear QR, modo claro/oscuro y el
// menú del avatar (Mi perfil, Notificaciones, Ayuda, Cerrar sesión).
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { VigiaCambios } from '../../lib/cambios';

function IconoPestana({ nombre, color, size, focused, rojo }) {
  return (
    <View style={estilos.icono}>
      {focused ? <View style={[estilos.indicador, { backgroundColor: rojo }]} /> : null}
      <Ionicons name={focused ? nombre : `${nombre}-outline`} size={size - 2} color={color} />
    </View>
  );
}

/** Menú del avatar (como el UserMenu de R3): nombre, rol, y los accesos de la cuenta. */
function MenuUsuario() {
  const { usuario, logout } = useSesion();
  const router = useRouter();
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const r = perfilRol(usuario?.rol);
  const ir = (ruta) => { setAbierto(false); router.push(ruta, { withAnchor: true }); };
  const opciones = [
    { texto: 'Mi perfil', icono: 'person-circle-outline', accion: () => ir('/perfil') },
    { texto: 'Notificaciones', icono: 'notifications-outline', accion: () => ir('/perfil/notificaciones') },
    { texto: 'Verificación en dos pasos', icono: 'shield-checkmark-outline', accion: () => ir('/perfil/dos-pasos') },
    { texto: 'Ayuda', icono: 'help-circle-outline', accion: () => ir('/perfil/ayuda') },
    { texto: 'Cerrar sesión', icono: 'log-out-outline', peligro: true, accion: async () => { setAbierto(false); await logout(); } },
  ];
  return (
    <>
      <Pressable onPress={() => setAbierto(true)} accessibilityRole="button" accessibilityLabel="Menú de la cuenta" hitSlop={6} style={{ marginRight: 12 }}>
        <Avatar nombre={`${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`} tamano={30} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={estilos.menuFondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar el menú">
          <View style={[estilos.menu, { backgroundColor: t.superficie, borderColor: r.color }]}>
            <View style={[estilos.menuCabecera, { borderBottomColor: t.borde }]}>
              <Text style={{ color: t.texto, fontWeight: '700' }}>{usuario?.nombre} {usuario?.apellido}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 12 }}>{usuario?.email}</Text>
              <Text style={{ color: r.color, fontSize: 12, fontWeight: '700' }}>{r.titulo}{usuario?.area ? ` · ${usuario.area.nombre}` : ''}</Text>
            </View>
            {opciones.map((o) => (
              <Pressable key={o.texto} onPress={o.accion} accessibilityRole="menuitem"
                style={({ pressed }) => [estilos.menuItem, pressed && { backgroundColor: t.superficieSec }]}>
                <Ionicons name={o.icono} size={18} color={o.peligro ? t.error : t.textoSuave} />
                <Text style={{ color: o.peligro ? t.error : t.texto, fontSize: 15 }}>{o.texto}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function AccionesCabecera() {
  const router = useRouter();
  return (
    <View style={estilos.acciones}>
      <Pressable onPress={() => router.push('/modulos/escanear', { withAnchor: true })} accessibilityRole="button" accessibilityLabel="Escanear un código QR" hitSlop={6} style={{ paddingHorizontal: 6 }}>
        <Ionicons name="qr-code-outline" size={22} color="#ffffff" />
      </Pressable>
      <SelectorTema compacto barra />
      <MenuUsuario />
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
      <VigiaCambios />
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

// Las pestañas de cada rol (lo demás se abre desde Buscar o desde Inicio):
//   Empleado      Inicio · Mis tareas · Buscar
//   Jefe de área  Inicio · Tareas · Mi equipo · Buscar
//   Gerencia      Inicio · Tablero · Áreas · Personas · Buscar
//   Administrador Inicio · Personas · Áreas · Buscar
// Perfil, Notificaciones y Ayuda están en el menú del avatar.
const PESTANAS = {
  EMPLEADO: ['index', 'tareas', 'buscar'],
  JEFE: ['index', 'trabajo', 'equipo', 'buscar'],
  GERENCIA: ['index', 'tablero', 'equipo', 'personas', 'buscar'],
  ADMIN: ['index', 'personas', 'equipo', 'buscar'],
};

function Pestanas() {
  const t = useTema();
  const { usuario } = useSesion();
  const rol = usuario?.rol ?? 'EMPLEADO';
  const r = perfilRol(rol);
  const icono = (nombre) => (props) => <IconoPestana nombre={nombre} rojo={r.color} {...props} />;
  const visibles = PESTANAS[rol] ?? PESTANAS.EMPLEADO;
  // Una pestaña que el rol no usa no muestra botón, pero su pantalla se sigue pudiendo abrir.
  const oculta = (nombre) => (visibles.includes(nombre) ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } });
  return (
    <Tabs screenOptions={{
      headerStyle: {
        backgroundColor: t.barra, borderBottomWidth: 2, borderBottomColor: '#c8102e',
        ...Platform.select({ web: { boxShadow: '0 6px 24px rgba(200,16,46,0.35)' }, default: {} }),
      },
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
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icono('home') }} />
      <Tabs.Screen name="tareas" options={{ title: 'Mis tareas', headerShown: false, tabBarIcon: icono('checkbox'), ...oculta('tareas') }} />
      <Tabs.Screen name="trabajo" options={{ title: 'Tareas', tabBarIcon: icono('list'), ...oculta('trabajo') }} />
      <Tabs.Screen name="tablero" options={{ title: 'Tablero', tabBarIcon: icono('stats-chart'), ...oculta('tablero') }} />
      <Tabs.Screen name="equipo" options={{ title: rol === 'JEFE' ? 'Mi equipo' : 'Áreas', tabBarIcon: icono(rol === 'JEFE' ? 'people' : 'business'), ...oculta('equipo') }} />
      <Tabs.Screen name="personas" options={{ title: 'Personas', tabBarIcon: icono('id-card'), ...oculta('personas') }} />
      <Tabs.Screen name="buscar" options={{ title: 'Buscar', tabBarIcon: icono('search') }} />
      <Tabs.Screen name="modulos" options={{ title: 'Menú', headerShown: false, ...oculta('modulos') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', headerShown: false, ...oculta('perfil') }} />
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
  menuFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', paddingTop: 56, paddingRight: 10 },
  menu: {
    width: 270, borderWidth: 1, borderRadius: 12, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 12px 40px rgba(200,16,46,0.35)' }, default: { elevation: 12, shadowColor: '#c8102e', shadowOpacity: 0.4, shadowRadius: 16 } }),
  },
  menuCabecera: { padding: 14, borderBottomWidth: 1, gap: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
