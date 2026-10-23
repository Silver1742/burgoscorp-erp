// Identidad visual de BurgosCorp: rojo, negro y gris, en modo claro y oscuro.
// El modo lo elige el usuario (Sistema / Claro / Oscuro) y queda guardado en el dispositivo.
import { createContext, use, useEffect, useMemo, useState } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import { leerPreferencia, guardarPreferencia } from './lib/preferencias';

// Rojo BurgosCorp y sus variantes
const ROJO = '#C8102E';
const ROJO_CLARO = '#E5383B';

const claro = {
  modo: 'claro',
  fondo: '#F2F2F3',
  superficie: '#FFFFFF',
  superficieAlt: '#E9E9EB',
  borde: '#D2D2D6',
  texto: '#151517',
  textoSuave: '#5C5C63',
  primario: ROJO,
  primarioTexto: '#FFFFFF',
  acento: ROJO,
  // Barras (cabecera y pestañas): negras en los dos modos, como la marca
  barra: '#141416',
  barraTexto: '#FFFFFF',
  barraTextoSuave: '#9A9AA2',
  barraBorde: '#2A2A2E',
  exito: '#2B8A3E',
  error: '#B3261E',
  errorFondo: '#FCEBEA',
  aviso: '#A85A00',
  avisoFondo: '#FFF4E0',
};

const oscuro = {
  modo: 'oscuro',
  fondo: '#0C0C0D',
  superficie: '#18181B',
  superficieAlt: '#242428',
  borde: '#34343A',
  texto: '#F2F2F3',
  textoSuave: '#A3A3AB',
  primario: ROJO_CLARO,
  primarioTexto: '#FFFFFF',
  acento: ROJO_CLARO,
  barra: '#000000',
  barraTexto: '#FFFFFF',
  barraTextoSuave: '#8E8E96',
  barraBorde: '#26262A',
  exito: '#51CF66',
  error: '#FF6B6B',
  errorFondo: '#3A1517',
  aviso: '#FFB84D',
  avisoFondo: '#3A2C14',
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radio = { s: 6, m: 10, l: 16 };

export const PREFERENCIAS_TEMA = [
  { valor: 'sistema', titulo: 'Como el sistema', icono: 'phone-portrait-outline' },
  { valor: 'claro', titulo: 'Claro', icono: 'sunny-outline' },
  { valor: 'oscuro', titulo: 'Oscuro', icono: 'moon-outline' },
];

const TemaContext = createContext(null);

export function TemaProvider({ children }) {
  const delSistema = useColorScheme();
  const [preferencia, setPreferencia] = useState('sistema');

  useEffect(() => {
    leerPreferencia('tema').then((v) => {
      if (['sistema', 'claro', 'oscuro'].includes(v)) setPreferencia(v);
    });
  }, []);

  const valor = useMemo(() => {
    const efectivo = preferencia === 'sistema' ? (delSistema === 'dark' ? 'oscuro' : 'claro') : preferencia;
    return {
      colores: efectivo === 'oscuro' ? oscuro : claro,
      preferencia,
      cambiarPreferencia(nueva) {
        setPreferencia(nueva);
        guardarPreferencia('tema', nueva);
      },
    };
  }, [preferencia, delSistema]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

/** Colores del tema activo. */
export function useTema() {
  const ctx = use(TemaContext);
  return ctx ? ctx.colores : claro;
}

/** Preferencia del usuario y función para cambiarla (pantalla Perfil, botón del login). */
export function usePreferenciaTema() {
  const ctx = use(TemaContext);
  return { preferencia: ctx?.preferencia ?? 'sistema', cambiar: ctx?.cambiarPreferencia ?? (() => {}) };
}

/** Datos de la pantalla para adaptar el diseño (teléfono vertical, horizontal o tablet). */
export function usePantalla() {
  const { width, height } = useWindowDimensions();
  return {
    ancho: width,
    horizontal: width > height,
    esTablet: Math.min(width, height) >= 600,
    // Columnas para grillas de tarjetas según el ancho disponible.
    columnas: width >= 1000 ? 4 : width >= 700 ? 3 : 2,
  };
}

/** Opciones comunes de cabecera para todos los Stack: barra negra con texto blanco. */
export function opcionesCabecera(t) {
  return {
    headerStyle: { backgroundColor: t.barra },
    headerTintColor: t.barraTexto,
    headerTitleStyle: { color: t.barraTexto },
    contentStyle: { backgroundColor: t.fondo },
  };
}
