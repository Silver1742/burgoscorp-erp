// Colores y medidas de la app. Paleta industrial: azul acero + naranja de seguridad.
import { useColorScheme, useWindowDimensions } from 'react-native';

const claro = {
  fondo: '#F3F5F8',
  superficie: '#FFFFFF',
  superficieAlt: '#E9EDF2',
  borde: '#D3DAE3',
  texto: '#16202C',
  textoSuave: '#5A6878',
  primario: '#1F3A5F',
  primarioTexto: '#FFFFFF',
  acento: '#E8590C',
  exito: '#2B8A3E',
  error: '#C92A2A',
  errorFondo: '#FFF0F0',
  aviso: '#B8650B',
  avisoFondo: '#FFF6E5',
};

const oscuro = {
  fondo: '#0F1620',
  superficie: '#18222F',
  superficieAlt: '#223042',
  borde: '#2E3E52',
  texto: '#E8EEF5',
  textoSuave: '#9AA9BA',
  primario: '#5B8FCF',
  primarioTexto: '#0F1620',
  acento: '#FF7A33',
  exito: '#51CF66',
  error: '#FF6B6B',
  errorFondo: '#3A1B1E',
  aviso: '#FFB84D',
  avisoFondo: '#3A2C14',
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radio = { s: 6, m: 10, l: 16 };

export function useTema() {
  return useColorScheme() === 'dark' ? oscuro : claro;
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
