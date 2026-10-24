// Intro de apertura (animación 10 del portal R3).
// Pantalla negra con resplandor rojo: el escudo se dibuja, "BurgosCorp" aparece letra por letra,
// una línea roja barre debajo y todo sale con fundido. Una vez por apertura de la app;
// se saltea tocando la pantalla y no aparece con "reducir movimiento".
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Escudo } from './Marca';
import { fuentes } from '../tema';

const LETRAS = ['B', 'u', 'r', 'g', 'o', 's', 'C', 'o', 'r', 'p'];
const VISIBLE_MS = 2000;
const SALIDA_MS = 550;
let yaSeMostro = false; // una vez por apertura de la app

export default function IntroSplash() {
  const [fase, setFase] = useState(() => (yaSeMostro ? 'fin' : 'mostrando'));
  const salida = useRef(new Animated.Value(1)).current;
  const letras = useRef(LETRAS.map(() => new Animated.Value(0))).current;
  const linea = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (fase !== 'mostrando') return undefined;
    yaSeMostro = true;
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (cancelado) return;
      if (reducir) { setFase('fin'); return; }
      Animated.stagger(55, letras.map((v) => Animated.timing(v, { toValue: 1, duration: 260, delay: 700, useNativeDriver: true }))).start();
      Animated.timing(linea, { toValue: 1, duration: 700, delay: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    });
    const t = setTimeout(() => salir(), VISIBLE_MS);
    return () => { cancelado = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  function salir() {
    setFase((f) => {
      if (f !== 'mostrando') return f;
      Animated.timing(salida, { toValue: 0, duration: SALIDA_MS, useNativeDriver: true }).start(() => setFase('fin'));
      return 'saliendo';
    });
  }

  if (fase === 'fin') return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilos.fondo, {
      opacity: salida,
      transform: [{ scale: salida.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] }) }],
    }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={salir} accessibilityLabel="Cargando BurgosCorp. Tocá para continuar">
        {/* El SVG va dentro de una capa absoluta: en la web, un <svg> suelto ocupa lugar en el flujo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="brillo" cx="50%" cy="42%" r="55%">
                <Stop offset="0" stopColor="#c8102e" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#c8102e" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#brillo)" />
          </Svg>
        </View>
        <View style={estilos.contenido} pointerEvents="none">
          <Escudo tamano={112} animado />
          <View style={estilos.palabra}>
            {LETRAS.map((l, i) => (
              <Animated.Text key={i} style={[estilos.letra, i >= 6 && { color: '#ff4d61' }, {
                opacity: letras[i],
                transform: [{ translateY: letras[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              }]}>{l}</Animated.Text>
            ))}
          </View>
          <View style={estilos.carril}>
            <Animated.View style={[estilos.linea, { transform: [{ scaleX: linea }] }]} />
          </View>
          <Text style={estilos.lema}>Sistema de gestión · Acceso seguro</Text>
        </View>
        <Text style={estilos.saltear}>Tocá para continuar</Text>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  fondo: { backgroundColor: '#050505', zIndex: 1000, elevation: 1000 },
  contenido: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  palabra: { flexDirection: 'row', marginTop: 18 },
  letra: { fontFamily: fuentes.marca, fontSize: 34, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  carril: { width: 200, height: 2, marginTop: 12, overflow: 'hidden' },
  linea: { flex: 1, backgroundColor: '#e11d2e' },
  lema: { color: '#a1a1aa', marginTop: 14, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  saltear: { position: 'absolute', bottom: 40, alignSelf: 'center', color: '#71717a', fontSize: 12 },
});
