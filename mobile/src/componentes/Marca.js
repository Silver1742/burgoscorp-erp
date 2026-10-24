// Isologo de BurgosCorp: el mismo escudo del portal R3 (BrandLogo / ShieldSeal).
// Monograma "BC" sobre un escudo negro con borde rojo, dibujado con react-native-svg.
//  - animado: al montarse el borde rojo se "dibuja", aparece el cuerpo y después las iniciales;
//  - sellado: aparece el candado de "acceso verificado" (se usa al ingresar).
// Con "reducir movimiento" activado en el sistema, se muestra sin animar.
import { useEffect, useId, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { fuentes, useTema } from '../tema';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const LARGO_BORDE = 118; // largo aproximado del borde interior del escudo (para dibujarlo)

export function Escudo({ tamano = 48, animado = false, sellado = false }) {
  const id = useId().replace(/:/g, '');
  const trazo = useRef(new Animated.Value(animado ? LARGO_BORDE : 0)).current;
  const cuerpo = useRef(new Animated.Value(animado ? 0 : 1)).current;
  const letras = useRef(new Animated.Value(animado ? 0 : 1)).current;
  const candado = useRef(new Animated.Value(sellado ? 1 : 0)).current;

  useEffect(() => {
    if (!animado) return;
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (cancelado) return;
      if (reducir) {
        trazo.setValue(0);
        cuerpo.setValue(1);
        letras.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.timing(trazo, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(cuerpo, { toValue: 1, duration: 450, delay: 150, useNativeDriver: false }),
        Animated.timing(letras, { toValue: 1, duration: 400, delay: 550, useNativeDriver: false }),
      ]).start();
    });
    return () => { cancelado = true; };
  }, [animado, trazo, cuerpo, letras]);

  useEffect(() => {
    Animated.spring(candado, { toValue: sellado ? 1 : 0, friction: 6, tension: 120, useNativeDriver: false }).start();
  }, [sellado, candado]);

  // En la web, react-native-svg no admite animar sus piezas (pasa atributos inválidos al DOM):
  // ahí el escudo entra con un fundido completo y el candado aparece sin animación.
  if (Platform.OS === 'web') {
    return (
      <Animated.View style={{ opacity: cuerpo, transform: [{ scale: cuerpo.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
        <EscudoEstatico tamano={tamano} sellado={sellado} id={id} />
      </Animated.View>
    );
  }

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 48 48" accessibilityLabel={sellado ? 'BurgosCorp · acceso verificado' : 'BurgosCorp'}>
      <Defs>
        <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2e2e33" />
          <Stop offset="1" stopColor="#050505" />
        </LinearGradient>
      </Defs>
      <AnimatedG opacity={cuerpo}>
        <Path d="M24 2 43 9v14c0 11.5-8 19.8-19 23C13 42.8 5 34.5 5 23V9Z" fill={`url(#g${id})`} />
      </AnimatedG>
      <AnimatedPath
        d="M24 5.5 40 11.4V23c0 9.7-6.6 16.8-16 19.8C14.6 39.8 8 32.7 8 23V11.4Z"
        fill="none"
        stroke="#e11d2e"
        strokeWidth="1.75"
        strokeDasharray={[LARGO_BORDE, LARGO_BORDE]}
        strokeDashoffset={trazo}
      />
      <AnimatedG opacity={letras}>
        <SvgText x="24" y="30" textAnchor="middle" fontFamily={fuentes.marca} fontSize="17" fontWeight="700" fill="#ffffff">BC</SvgText>
      </AnimatedG>
      {/* Candado de "acceso verificado" */}
      <AnimatedG opacity={candado}>
        <Circle cx="38" cy="38" r="9" fill="#e11d2e" stroke="#ffffff" strokeWidth="1.5" />
        <Path d="M35 37v-2.2a3 3 0 0 1 6 0V37" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        <Rect x="33.5" y="36.5" width="9" height="6.5" rx="1.3" fill="#ffffff" />
      </AnimatedG>
    </Svg>
  );
}

function EscudoEstatico({ tamano, sellado, id }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 48 48" accessibilityLabel={sellado ? 'BurgosCorp · acceso verificado' : 'BurgosCorp'}>
      <Defs>
        <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2e2e33" />
          <Stop offset="1" stopColor="#050505" />
        </LinearGradient>
      </Defs>
      <Path d="M24 2 43 9v14c0 11.5-8 19.8-19 23C13 42.8 5 34.5 5 23V9Z" fill={`url(#g${id})`} />
      <Path d="M24 5.5 40 11.4V23c0 9.7-6.6 16.8-16 19.8C14.6 39.8 8 32.7 8 23V11.4Z" fill="none" stroke="#e11d2e" strokeWidth="1.75" />
      <SvgText x="24" y="30" textAnchor="middle" fontFamily={fuentes.marca} fontSize="17" fontWeight="700" fill="#ffffff">BC</SvgText>
      {sellado ? (
        <G>
          <Circle cx="38" cy="38" r="9" fill="#e11d2e" stroke="#ffffff" strokeWidth="1.5" />
          <Path d="M35 37v-2.2a3 3 0 0 1 6 0V37" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
          <Rect x="33.5" y="36.5" width="9" height="6.5" rx="1.3" fill="#ffffff" />
        </G>
      ) : null}
    </Svg>
  );
}

/** "Burgos" + "Corp" en rojo, en serif. `sobreOscuro` para la barra negra o el panel de marca. */
export function NombreMarca({ tamano = 20, sobreOscuro = false }) {
  const t = useTema();
  return (
    <Text style={[estilos.nombre, { fontSize: tamano, color: sobreOscuro ? '#ffffff' : t.texto }]}>
      Burgos<Text style={{ color: sobreOscuro ? t.marcaAcentoBarra : t.marcaAcento }}>Corp</Text>
    </Text>
  );
}

/** Escudo + nombre, en fila (barra) o en columna (login). */
export default function Marca({ tamano = 36, conNombre = true, vertical = false, sobreOscuro = false, animado = false, sellado = false }) {
  return (
    <View style={[estilos.marca, vertical && estilos.vertical]} accessible accessibilityRole="image" accessibilityLabel="BurgosCorp">
      <Escudo tamano={tamano} animado={animado} sellado={sellado} />
      {conNombre ? <NombreMarca tamano={vertical ? tamano * 0.42 : tamano * 0.55} sobreOscuro={sobreOscuro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vertical: { flexDirection: 'column', gap: 6 },
  nombre: { fontFamily: fuentes.marca, fontWeight: '700', letterSpacing: 0.2 },
});
