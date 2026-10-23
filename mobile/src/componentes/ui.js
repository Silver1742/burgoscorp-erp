// Componentes de interfaz reutilizables. Todos toman los colores del tema (claro/oscuro).
import { forwardRef } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTema, espacio, radio } from '../tema';

/** Contenedor de pantalla: zona segura, scroll, teclado y ancho máximo en pantallas grandes. */
export function Pantalla({ children, scroll = true, anchoMax = 560, bordes = ['bottom'], estilo }) {
  const t = useTema();
  const contenido = <View style={[estilos.centrado, { maxWidth: anchoMax }, estilo]}>{children}</View>;
  return (
    <SafeAreaView edges={bordes} style={{ flex: 1, backgroundColor: t.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll
          ? <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">{contenido}</ScrollView>
          : <View style={[estilos.scroll, { flex: 1 }]}>{contenido}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Titulo({ children, sub }) {
  const t = useTema();
  return (
    <View style={{ marginBottom: espacio.l }}>
      <Text accessibilityRole="header" style={[estilos.titulo, { color: t.texto }]}>{children}</Text>
      {sub ? <Text style={[estilos.sub, { color: t.textoSuave }]}>{sub}</Text> : null}
    </View>
  );
}

export function Texto({ children, suave, estilo, ...props }) {
  const t = useTema();
  return <Text style={[{ color: suave ? t.textoSuave : t.texto, fontSize: 15, lineHeight: 21 }, estilo]} {...props}>{children}</Text>;
}

/** Campo de texto con etiqueta y mensaje de error. */
export const Campo = forwardRef(function Campo({ etiqueta, error, ayuda, estilo, ...props }, ref) {
  const t = useTema();
  return (
    <View style={[{ marginBottom: espacio.l }, estilo]}>
      {etiqueta ? <Text style={[estilos.etiqueta, { color: t.texto }]}>{etiqueta}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.textoSuave}
        accessibilityLabel={etiqueta}
        style={[estilos.input, {
          color: t.texto, backgroundColor: t.superficie, borderColor: error ? t.error : t.borde,
        }]}
        {...props}
      />
      {error
        ? <Text style={[estilos.ayuda, { color: t.error }]} accessibilityLiveRegion="polite">{error}</Text>
        : ayuda ? <Text style={[estilos.ayuda, { color: t.textoSuave }]}>{ayuda}</Text> : null}
    </View>
  );
});

export function Boton({ titulo, onPress, variante = 'primario', cargando = false, deshabilitado = false, icono, estilo }) {
  const t = useTema();
  const inactivo = deshabilitado || cargando;
  const colores = {
    primario: { fondo: t.primario, texto: t.primarioTexto, borde: t.primario },
    secundario: { fondo: 'transparent', texto: t.texto, borde: t.textoSuave },
    peligro: { fondo: 'transparent', texto: t.error, borde: t.error },
    texto: { fondo: 'transparent', texto: t.primario, borde: 'transparent' },
  }[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [estilos.boton, {
        backgroundColor: colores.fondo, borderColor: colores.borde, opacity: inactivo ? 0.55 : pressed ? 0.8 : 1,
      }, estilo]}
    >
      {cargando
        ? <ActivityIndicator color={colores.texto} />
        : (
          <View style={estilos.filaCentro}>
            {icono ? <Ionicons name={icono} size={18} color={colores.texto} style={{ marginRight: espacio.s }} /> : null}
            <Text style={[estilos.botonTexto, { color: colores.texto }]}>{titulo}</Text>
          </View>
        )}
    </Pressable>
  );
}

export function Tarjeta({ children, onPress, estilo }) {
  const t = useTema();
  const base = [estilos.tarjeta, { backgroundColor: t.superficie, borderColor: t.borde }, estilo];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** Mensaje destacado: error, aviso, éxito o información. */
export function Aviso({ tipo = 'error', children, onReintentar }) {
  const t = useTema();
  const colores = {
    error: [t.errorFondo, t.error, 'alert-circle'],
    aviso: [t.avisoFondo, t.aviso, 'warning'],
    exito: [t.superficieAlt, t.exito, 'checkmark-circle'],
    info: [t.superficieAlt, t.textoSuave, 'information-circle'],
  }[tipo];
  if (!children) return null;
  return (
    <View accessibilityRole="alert" style={[estilos.aviso, { backgroundColor: colores[0], borderColor: colores[1] }]}>
      <Ionicons name={colores[2]} size={20} color={colores[1]} style={{ marginRight: espacio.s }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.texto, fontSize: 14, lineHeight: 20 }}>{children}</Text>
        {onReintentar ? <Boton titulo="Reintentar" variante="texto" onPress={onReintentar} estilo={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36 }} /> : null}
      </View>
    </View>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  const t = useTema();
  return (
    <View style={estilos.estadoVacio}>
      <ActivityIndicator size="large" color={t.primario} />
      <Text style={{ color: t.textoSuave, marginTop: espacio.m }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ icono = 'file-tray-outline', titulo, texto }) {
  const t = useTema();
  return (
    <View style={estilos.estadoVacio}>
      <Ionicons name={icono} size={48} color={t.textoSuave} />
      <Text style={{ color: t.texto, fontSize: 17, fontWeight: '600', marginTop: espacio.m, textAlign: 'center' }}>{titulo}</Text>
      {texto ? <Text style={{ color: t.textoSuave, marginTop: espacio.xs, textAlign: 'center' }}>{texto}</Text> : null}
    </View>
  );
}

export function Etiqueta({ texto, color }) {
  const t = useTema();
  const c = color ?? t.textoSuave;
  return (
    <View style={[estilos.chip, { borderColor: c }]}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}

export function Separador({ texto }) {
  const t = useTema();
  return (
    <View style={[estilos.filaCentro, { marginVertical: espacio.l }]}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.borde }} />
      {texto ? <Text style={{ color: t.textoSuave, marginHorizontal: espacio.m }}>{texto}</Text> : null}
      <View style={{ flex: 1, height: 1, backgroundColor: t.borde }} />
    </View>
  );
}

const estilos = StyleSheet.create({
  scroll: { flexGrow: 1, padding: espacio.l },
  centrado: { width: '100%', alignSelf: 'center' },
  titulo: { fontSize: 26, fontWeight: '700' },
  sub: { fontSize: 15, marginTop: espacio.xs, lineHeight: 21 },
  etiqueta: { fontSize: 14, fontWeight: '600', marginBottom: espacio.xs },
  input: { borderWidth: 1, borderRadius: radio.m, paddingHorizontal: espacio.m, minHeight: 48, fontSize: 16 },
  ayuda: { fontSize: 13, marginTop: espacio.xs },
  boton: {
    minHeight: 48, borderRadius: radio.m, borderWidth: 1.5, paddingHorizontal: espacio.l,
    alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m,
  },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  filaCentro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tarjeta: { borderWidth: 1, borderRadius: radio.l, padding: espacio.l, marginBottom: espacio.m },
  aviso: { flexDirection: 'row', borderWidth: 1, borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.l },
  estadoVacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xxl, minHeight: 200 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: espacio.s, paddingVertical: 2, alignSelf: 'flex-start' },
});
