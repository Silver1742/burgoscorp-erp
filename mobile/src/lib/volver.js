// "Volver" al lugar de donde se vino.
//
// Las pantallas de detalle (una tarea, una OT, un legajo, una notificación) viven dentro de una pila
// (Módulos, Mis tareas o Perfil) cuya pantalla inicial es la grilla de Módulos, la lista de tareas o el
// perfil. Si se abren desde otra pestaña (Inicio, Tareas del jefe, Buscar, Pendientes, la ficha de una
// persona, el QR) o después de un alta que reemplaza la pantalla ("Nueva tarea" → la tarea creada),
// lo que queda debajo en la pila es esa pantalla inicial, y el "atrás" de siempre llevaba ahí.
//
// Reglas:
//   1. Al salir de una pila hacia otra pestaña, la pila vuelve a su pantalla inicial
//      (useReiniciarAlSalir). Así no quedan pantallas viejas apiladas que aparezcan al volver.
//   2. Al volver se mira qué hay realmente debajo en la pila:
//      - una pantalla de verdad (la OT desde la que se abrió la tarea) → atrás normal;
//      - solo la pantalla inicial, y no se vino de ella → se vuelve a donde estabas antes de entrar.
// Lo mismo para la flecha de la cabecera y para el botón "atrás" de Android.
//
//   <RegistroRutas />                       una vez, en el layout con sesión
//   useReiniciarAlSalir('modulos')          en el layout de cada pila (nombre de su pestaña)
//   headerLeft: botonVolver('/modulos', { inicioOculto: true })
//       inicioOculto: la pantalla inicial de la pila no es una pestaña visible (la grilla de Módulos,
//       Perfil): ahí también hace falta la flecha para volver a donde estabas.
import { useEffect } from 'react';
import { BackHandler, Pressable } from 'react-native';
import { useNavigation, usePathname, useRouter } from 'expo-router';
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

/** Posición en el historial de la última pantalla fuera de esta pila (o su pantalla inicial). */
function indiceOrigen(pila) {
  for (let i = historial.length - 2; i >= 0; i -= 1) {
    if (!historial[i].startsWith(`${pila}/`)) return i;
  }
  return -1;
}

/** Qué hace "volver" en esta pantalla: { tipo: 'atras' } | { tipo: 'origen', ruta, indice } | null. */
function destinoVolver(navigation, pila, inicioOculto) {
  const estado = navigation.getState();
  const debajo = estado && estado.index > 0 ? estado.routes[estado.index - 1] : null;
  const i = indiceOrigen(pila);
  const origen = i >= 0 ? historial[i] : null;
  const vengoDeOtroLado = origen && origen !== pila;
  if (debajo && debajo.name !== 'index') return { tipo: 'atras' }; // una pantalla de verdad
  // En la pantalla inicial de una pestaña visible (Mis tareas) no hay "volver": es una pestaña.
  if (vengoDeOtroLado && (debajo || inicioOculto)) return { tipo: 'origen', ruta: origen, indice: i, debajo: Boolean(debajo) };
  return debajo ? { tipo: 'atras' } : null;
}

function volver(router, navigation, pila, inicioOculto) {
  const d = destinoVolver(navigation, pila, inicioOculto);
  if (!d) return false;
  if (d.tipo === 'atras') {
    navigation.goBack(); // atrás dentro de esta pila (no el de las pestañas)
    return true;
  }
  historial.length = d.indice + 1; // al llegar, el origen queda último (no se duplica)
  router.navigate(d.ruta); // la pila se reinicia sola al perder el foco (useReiniciarAlSalir)
  return true;
}

/**
 * En el layout de una pila que es pestaña: cuando se va a otra pestaña, la pila vuelve a su
 * pantalla inicial. `useNavigation` acá es la de la pestaña (el layout es su pantalla).
 */
export function useReiniciarAlSalir(pestana) {
  const navigation = useNavigation();
  useEffect(() => navigation.addListener('blur', () => {
    const pila = navigation.getState()?.routes.find((r) => r.name === pestana)?.state;
    if (pila?.key && pila.index > 0) navigation.dispatch({ type: 'POP_TO_TOP', target: pila.key });
  }), [navigation, pestana]);
}

function FlechaVolver({ pila, inicioOculto, color }) {
  const router = useRouter();
  const navigation = useNavigation();

  // Botón "atrás" del teléfono: solo actúa la pantalla que está a la vista.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (
      navigation.isFocused() ? volver(router, navigation, pila, inicioOculto) : false
    ));
    return () => sub.remove();
  }, [router, navigation, pila, inicioOculto]);

  if (!destinoVolver(navigation, pila, inicioOculto)) return null;
  return (
    <Pressable onPress={() => volver(router, navigation, pila, inicioOculto)} accessibilityRole="button" accessibilityLabel="Volver"
      hitSlop={10} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Ionicons name="arrow-back" size={24} color={color} />
    </Pressable>
  );
}

/** Para `screenOptions.headerLeft` de una pila. */
export const botonVolver = (pila, { inicioOculto = false } = {}) => function HeaderVolver({ tintColor }) {
  return <FlechaVolver pila={pila} inicioOculto={inicioOculto} color={tintColor} />;
};
