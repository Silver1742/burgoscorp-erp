// "Volver" al lugar de donde se vino.
//
// Las pantallas de detalle (una tarea, una OT, un legajo) viven dentro de la pila de Módulos o de
// Mis tareas. Si se abren desde otra pestaña (Inicio, Tareas del jefe, Buscar, la ficha de una
// persona), el "atrás" de la pila llevaba a la grilla de Módulos en vez de volver a donde estabas.
// Acá se recuerda el recorrido y, si lo anterior es de otra pestaña, se vuelve ahí.
//
//   <RegistroRutas />                  una vez, en el layout con sesión
//   botonVolver('/modulos')            headerLeft de la pila (flecha de la cabecera)
//   useAtrasDelTelefono('/modulos')    el botón "atrás" de Android
import { useEffect } from 'react';
import { BackHandler, Pressable } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const historial = [];
const MAX = 50;

export function RegistroRutas() {
  const ruta = usePathname();
  useEffect(() => {
    if (historial[historial.length - 1] === ruta) return;
    historial.push(ruta);
    if (historial.length > MAX) historial.shift();
  }, [ruta]);
  return null;
}

/** Vuelve: dentro de la misma pila, el atrás de siempre; si se vino de otra pestaña, a esa pestaña. */
function volver(router, pila) {
  const anterior = historial[historial.length - 2];
  if (!anterior || anterior.startsWith(pila)) {
    if (router.canGoBack()) router.back();
    return;
  }
  historial.pop(); // la pantalla que se deja; al llegar, la anterior queda última (no se duplica)
  if (router.canGoBack()) router.back(); // deja la pila en su pantalla inicial para la próxima vez
  router.navigate(anterior);
}

function BotonVolver({ pila, color }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => volver(router, pila)} accessibilityRole="button" accessibilityLabel="Volver"
      hitSlop={10} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Ionicons name="arrow-back" size={24} color={color} />
    </Pressable>
  );
}

/** Para `screenOptions.headerLeft` de una pila: la flecha aparece en todas sus pantallas menos la inicial. */
export const botonVolver = (pila) => function FlechaVolver({ canGoBack, tintColor }) {
  const anterior = historial[historial.length - 2];
  if (!canGoBack && !(anterior && !anterior.startsWith(pila))) return null;
  return <BotonVolver pila={pila} color={tintColor} />;
};

/** El "atrás" del teléfono hace lo mismo que la flecha (solo dentro de esa pila, no en su inicio). */
export function useAtrasDelTelefono(pila) {
  const router = useRouter();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const actual = historial[historial.length - 1];
      if (!actual?.startsWith(`${pila}/`)) return false; // otra pestaña, o la pantalla inicial de la pila
      volver(router, pila);
      return true;
    });
    return () => sub.remove();
  }, [router, pila]);
}
