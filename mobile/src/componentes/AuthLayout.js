// Estructura de las pantallas sin sesión (AuthLayout de R3): panel de marca + formulario.
// En pantallas anchas el panel negro/rojo va a la izquierda; en el celular, el escudo arriba.
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import Marca from './Marca';
import SelectorTema from './SelectorTema';
import { espacio, useTema, usePantalla } from '../tema';

const DESTACADOS = [
  { icono: 'shield-checkmark-outline', texto: 'Contraseñas cifradas y verificación en dos pasos' },
  { icono: 'id-card-outline', texto: 'Permisos por rol y por área' },
  { icono: 'document-text-outline', texto: 'Auditoría de cada acción sensible' },
];

/** Fondo del panel de marca (.bc-hero): degradado negro con resplandores rojos. */
function FondoHero() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="heroBase" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#0a0a0a" />
          <Stop offset="0.6" stopColor="#18181b" />
          <Stop offset="1" stopColor="#2a0a10" />
        </LinearGradient>
        <RadialGradient id="heroRojo1" cx="85%" cy="15%" r="45%">
          <Stop offset="0" stopColor="#c8102e" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#c8102e" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="heroRojo2" cx="10%" cy="90%" r="40%">
          <Stop offset="0" stopColor="#c8102e" stopOpacity="0.25" />
          <Stop offset="1" stopColor="#c8102e" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#heroBase)" />
      <Rect width="100%" height="100%" fill="url(#heroRojo1)" />
      <Rect width="100%" height="100%" fill="url(#heroRojo2)" />
    </Svg>
  );
}

export default function AuthLayout({ titulo, sub, children, sellado = false }) {
  const t = useTema();
  const { esAncho } = usePantalla();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: esAncho ? '#0a0a0a' : t.fondo }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {esAncho ? (
          <View style={estilos.hero}>
            <FondoHero />
            <Marca tamano={56} sobreOscuro animado sellado={sellado} />
            <View>
              <Text style={estilos.heroTitulo}>Sistema de gestión</Text>
              <Text style={estilos.heroLead}>
                Producción, tareas, personal, compras y finanzas del taller en un único lugar seguro.
              </Text>
              {DESTACADOS.map((d) => (
                <View key={d.texto} style={estilos.heroItem}>
                  <Ionicons name={d.icono} size={17} color="rgba(255,255,255,0.75)" />
                  <Text style={estilos.heroItemTexto}>{d.texto}</Text>
                </View>
              ))}
            </View>
            <Text style={estilos.heroPie}>BurgosCorp ERP · App móvil</Text>
          </View>
        ) : null}

        <View style={{ flex: 7, backgroundColor: t.fondo }}>
          <View style={estilos.selector}><SelectorTema compacto /></View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">
              <View style={estilos.tarjeta}>
                {!esAncho ? (
                  <View style={{ alignItems: 'center', marginBottom: espacio.xl }}>
                    <Marca tamano={56} vertical animado sellado={sellado} />
                  </View>
                ) : null}
                <Text accessibilityRole="header" style={[estilos.titulo, { color: t.texto }]}>{titulo}</Text>
                {sub ? <Text style={[estilos.sub, { color: t.textoSuave }]}>{sub}</Text> : null}
                {children}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  hero: { flex: 5, padding: 48, justifyContent: 'space-between', overflow: 'hidden' },
  heroTitulo: { color: '#ffffff', fontSize: 38, fontWeight: '600', marginBottom: espacio.l },
  heroLead: { color: 'rgba(255,255,255,0.75)', fontSize: 19, lineHeight: 28, marginBottom: espacio.xl, maxWidth: 460 },
  heroItem: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s },
  heroItemTexto: { color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  heroPie: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  selector: { position: 'absolute', top: espacio.l, right: espacio.l, zIndex: 2 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: espacio.xl },
  tarjeta: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  titulo: { fontSize: 26, fontWeight: '500', marginBottom: espacio.xs },
  sub: { fontSize: 16, marginBottom: espacio.xl, lineHeight: 22 },
});
