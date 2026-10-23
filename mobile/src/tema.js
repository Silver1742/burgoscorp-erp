// Identidad visual de BurgosCorp: la misma del portal R3 (React/R3 V, packages/ui/src/styles/index.css).
// Rojo corporativo + negro + escala de grises (zinc), en modo claro y oscuro.
// El modo lo elige el usuario (Sistema / Claro / Oscuro) y queda guardado en el dispositivo.
import { createContext, use, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { leerPreferencia, guardarPreferencia } from './lib/preferencias';

const claro = {
  modo: 'claro',
  // --bc-red y variantes
  primario: '#c8102e',
  primarioPresionado: '#a50d26',
  primarioTexto: '#ffffff',
  rojoSuave: '#fde8eb',
  rojoTexto: '#8f0b21',
  acento: '#c8102e',
  marcaAcento: '#c8102e',     // "Corp" sobre fondo claro
  negro: '#111111',
  // superficies y texto
  fondo: '#f4f4f5',           // --bc-page
  superficie: '#ffffff',      // --bc-surface
  superficieAlt: '#fafafa',   // --bc-muted-surface
  superficieSec: '#e4e4e7',   // --bs-secondary-bg
  borde: '#e4e4e7',           // --bc-gray-200
  texto: '#18181b',           // --bc-gray-900
  textoSuave: '#52525b',      // --bc-gray-600
  textoTenue: '#a1a1aa',      // --bc-gray-400
  // insignia de jefe: negra en claro, invertida en oscuro
  insigniaJefeFondo: '#111111',
  insigniaJefeTexto: '#ffffff',
  // estados (Bootstrap)
  exito: '#198754',
  exitoSuave: '#d1e7dd',
  exitoTexto: '#0a3622',
  error: '#dc3545',
  errorSuave: '#f8d7da',
  errorTexto: '#58151c',
  aviso: '#ffc107',
  avisoSuave: '#fff3cd',
  avisoTexto: '#664d03',
  // barra superior y pestañas: siempre negras (identidad), en ambos modos
  barra: '#111111',
  barraBorde: '#26262b',
  barraTexto: '#ffffff',
  barraTextoSuave: '#d4d4d8',
  barraTextoInactivo: '#a1a1aa',
  marcaAcentoBarra: '#ff4d61',
};

const oscuro = {
  ...claro,
  modo: 'oscuro',
  primario: '#ef3b4f',
  primarioPresionado: '#f45d6e',
  rojoSuave: 'rgba(239, 59, 79, 0.14)',
  rojoTexto: '#ff8a97',
  acento: '#ef3b4f',
  marcaAcento: '#ff4d61',
  fondo: '#0b0b0c',
  superficie: '#17171a',
  superficieAlt: '#1f1f23',
  superficieSec: '#26262b',
  borde: '#2a2a30',
  texto: '#e4e4e7',
  textoSuave: '#a1a1aa',
  textoTenue: '#71717a',
  insigniaJefeFondo: '#e4e4e7',
  insigniaJefeTexto: '#111111',
  exitoSuave: 'rgba(25, 135, 84, 0.18)',
  exitoTexto: '#75b798',
  errorSuave: 'rgba(220, 53, 69, 0.18)',
  errorTexto: '#ea868f',
  avisoSuave: 'rgba(255, 193, 7, 0.15)',
  avisoTexto: '#ffda6a',
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radio = { s: 6, m: 6, l: 8, xl: 12 }; // botones y campos como Bootstrap (0.375rem); tarjetas 0.5rem

// Tipografías: la marca usa serif (Georgia en web/iOS); el resto, la del sistema.
export const fuentes = {
  marca: Platform.select({ ios: 'Georgia', android: 'serif', default: "Georgia, 'Times New Roman', serif" }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Consolas, monospace' }),
};

// Sombra suave de tarjeta (.shadow-sm)
export const sombra = Platform.select({
  web: { boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' },
  default: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});

export const PREFERENCIAS_TEMA = [
  { valor: 'sistema', titulo: 'Sistema', icono: 'desktop-outline' },
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

/** Preferencia del usuario y función para cambiarla. */
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
    esAncho: width >= 992, // como el breakpoint lg de Bootstrap (panel de marca del login)
    columnas: width >= 1000 ? 4 : width >= 700 ? 3 : 2,
  };
}

/** Opciones comunes de cabecera para todos los Stack: barra negra con texto blanco. */
export function opcionesCabecera(t) {
  return {
    headerStyle: { backgroundColor: t.barra },
    headerTintColor: t.barraTexto,
    headerTitleStyle: { color: t.barraTexto, fontWeight: '600' },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: t.fondo },
  };
}
