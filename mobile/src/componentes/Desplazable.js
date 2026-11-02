// Botón "volver arriba": aparece cuando bajaste más de una pantalla y media en una lista larga y,
// al tocarlo, sube hasta el principio.
//
//   <ListaConArriba ... />   reemplaza a <FlatList ... /> (mismas props)
//   <ScrollConArriba ...>    reemplaza a <ScrollView ...> (mismas props)
//   <BotonArriba />          lo usa también <Pantalla> (componentes/ui.js)
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const ROJO = '#c8102e';

export function BotonArriba({ visible, alTocar }) {
  if (!visible) return null;
  return (
    <Pressable onPress={alTocar} accessibilityRole="button" accessibilityLabel="Volver arriba" hitSlop={8}
      style={({ pressed }) => [estilos.boton, pressed && { opacity: 0.8 }]}>
      <Ionicons name="arrow-up" size={22} color="#ffffff" />
    </Pressable>
  );
}

/** Lleva la cuenta de cuánto se bajó y dice si mostrar el botón. */
export function useArriba() {
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const umbral = height * 1.5;
  const alDesplazar = useCallback((e) => {
    const abajo = e.nativeEvent.contentOffset.y > umbral;
    setVisible((v) => (v === abajo ? v : abajo));
  }, [umbral]);
  return { visible, alDesplazar };
}

function conArriba(Componente, subir) {
  return forwardRef(function ConArriba({ onScroll, ...props }, ref) {
    const lista = useRef(null);
    useImperativeHandle(ref, () => lista.current);
    const { visible, alDesplazar } = useArriba();
    return (
      <View style={estilos.contenedor}>
        <Componente ref={lista} scrollEventThrottle={64} {...props}
          onScroll={(e) => { alDesplazar(e); onScroll?.(e); }} />
        <BotonArriba visible={visible} alTocar={() => subir(lista.current)} />
      </View>
    );
  });
}

export const ListaConArriba = conArriba(FlatList, (l) => l?.scrollToOffset({ offset: 0, animated: true }));
export const ScrollConArriba = conArriba(ScrollView, (s) => s?.scrollTo({ y: 0, animated: true }));

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  boton: {
    position: 'absolute', right: 16, bottom: 16, width: 46, height: 46, borderRadius: 23,
    backgroundColor: ROJO, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 6px 18px rgba(200,16,46,0.45)' },
      default: { elevation: 6, shadowColor: ROJO, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
  },
});
