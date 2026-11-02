// Identidad BurgosCorp: fondo negro con degradado y resplandores rojos, partículas encendidas que
// suben despacio (como chispas de soldadura) y una sombra roja alrededor. Se usa en el encabezado de
// Inicio, en el panel del login y donde la página tenga que sentirse imponente.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Degradado negro → bordó con dos resplandores rojos. */
export function FondoBurgos({ intensidad = 1 }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="bcBase" x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor="#050505" />
            <Stop offset="0.55" stopColor="#141416" />
            <Stop offset="1" stopColor="#3a0710" />
          </LinearGradient>
          <RadialGradient id="bcRojo1" cx="88%" cy="10%" r="55%">
            <Stop offset="0" stopColor="#ef233c" stopOpacity={0.6 * intensidad} />
            <Stop offset="1" stopColor="#c8102e" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bcRojo2" cx="5%" cy="100%" r="50%">
            <Stop offset="0" stopColor="#c8102e" stopOpacity={0.35 * intensidad} />
            <Stop offset="1" stopColor="#c8102e" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bcBase)" />
        <Rect width="100%" height="100%" fill="url(#bcRojo1)" />
        <Rect width="100%" height="100%" fill="url(#bcRojo2)" />
      </Svg>
    </View>
  );
}

function Chispa({ izquierda, tamano, duracion, demora, alto }) {
  const avance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const ciclo = Animated.loop(Animated.sequence([
      Animated.delay(demora),
      Animated.timing(avance, { toValue: 1, duration: duracion, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(avance, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [avance, duracion, demora]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[estilos.chispa, {
        left: `${izquierda}%`, width: tamano, height: tamano, borderRadius: tamano / 2,
        opacity: avance.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [
          { translateY: avance.interpolate({ inputRange: [0, 1], outputRange: [alto, -10] }) },
          { translateX: avance.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, tamano * 3, -tamano * 2] }) },
        ],
      }]}
    />
  );
}

/** Chispas rojas que suben (pocas y livianas: corren con el driver nativo, no traban el celular). */
export function Particulas({ cantidad = 16, alto = 220 }) {
  const chispas = useMemo(() => Array.from({ length: cantidad }, (_, i) => ({
    izquierda: (i * 97) % 100,
    tamano: 2 + ((i * 7) % 4),
    duracion: 5000 + ((i * 1311) % 6000),
    demora: (i * 733) % 5000,
  })), [cantidad]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {chispas.map((c, i) => <Chispa key={i} {...c} alto={alto} />)}
    </View>
  );
}

/** Sombra roja amenazante alrededor de un bloque. */
export const sombraRoja = Platform.select({
  web: { boxShadow: '0 0 0 1px rgba(200,16,46,0.55), 0 12px 42px rgba(200,16,46,0.38)' },
  default: { shadowColor: '#c8102e', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
});

/** Bloque con fondo BurgosCorp, chispas y sombra roja. */
export function BloqueImponente({ children, estilo, alto = 200, particulas = true }) {
  return (
    <View style={[estilos.bloque, sombraRoja, estilo]}>
      <FondoBurgos />
      {particulas ? <Particulas alto={alto} /> : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { borderRadius: 14, overflow: Platform.OS === 'web' ? 'hidden' : 'visible', borderWidth: 1, borderColor: 'rgba(239,35,60,0.45)' },
  chispa: {
    position: 'absolute', bottom: 0, backgroundColor: '#ff3b52',
    ...Platform.select({
      web: { boxShadow: '0 0 8px 2px rgba(255,59,82,0.85)' },
      default: { shadowColor: '#ff3b52', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    }),
  },
});
