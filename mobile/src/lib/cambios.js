// Recarga automática de las pantallas.
//
//   useCargar(cargar)     carga al abrir la pantalla y vuelve a cargar sola cuando hay cambios.
//   useAlCambiar(fn)      solo la parte "cuando hay cambios" (para pantallas que cargan a su manera).
//   VigiaCambios          va una vez en el layout con sesión: cada 15 s (con la app abierta y a la
//                         vista) le pregunta a la API si hubo cambios (GET /cambios).
//
// Hay cambios cuando cualquiera guarda algo (también vos: después de guardar se revisa enseguida).
// Una pantalla que no está a la vista no recarga en ese momento: recarga al volver a ella.
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, alGuardar } from './api';

const INTERVALO_MS = 15000;
const oyentes = new Set();

function avisarCambio() {
  for (const fn of oyentes) fn();
}

/** Corre `fn` cuando hay cambios (si la pantalla está a la vista) y al volver a la pantalla. */
export function useAlCambiar(fn) {
  const ultima = useRef(fn);
  ultima.current = fn;
  const enfocada = useRef(false);
  const primeraVez = useRef(true);

  useFocusEffect(useCallback(() => {
    enfocada.current = true;
    // Al abrir la pantalla carga useCargar (o la propia pantalla); acá solo al volver a ella.
    if (primeraVez.current) primeraVez.current = false;
    else ultima.current();
    return () => { enfocada.current = false; };
  }, []));

  useEffect(() => {
    const oyente = () => { if (enfocada.current) ultima.current(); };
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  }, []);
}

/** Reemplaza `useEffect(() => { cargar(); }, [cargar])`: carga y se mantiene al día. */
export function useCargar(cargar) {
  useEffect(() => { cargar(); }, [cargar]);
  useAlCambiar(cargar);
}

const aLaVista = () => AppState.currentState === 'active'
  && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);

export function VigiaCambios() {
  useEffect(() => {
    let vivo = true;
    let conocida = null;
    let temporizador;

    async function revisar() {
      clearTimeout(temporizador);
      if (aLaVista()) {
        try {
          const { version } = await api('/cambios');
          if (conocida !== null && version !== conocida) avisarCambio();
          conocida = version;
        } catch {
          // Sin conexión o servidor dormido: se vuelve a probar en la próxima vuelta.
        }
      }
      if (vivo) temporizador = setTimeout(revisar, INTERVALO_MS);
    }

    revisar();
    // Después de guardar algo, revisar enseguida (en vez de esperar la próxima vuelta).
    const dejarDeOir = alGuardar(() => { clearTimeout(temporizador); temporizador = setTimeout(revisar, 300); });
    const alVolver = AppState.addEventListener('change', (estado) => { if (estado === 'active') revisar(); });
    const alMostrar = () => { if (!document.hidden) revisar(); };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', alMostrar);

    return () => {
      vivo = false;
      clearTimeout(temporizador);
      dejarDeOir();
      alVolver.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', alMostrar);
    };
  }, []);
  return null;
}
