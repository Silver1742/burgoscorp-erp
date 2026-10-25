// Componentes de interfaz con el estilo del portal R3 (Bootstrap 5 + identidad BurgosCorp).
// No hay cajas de alerta: los resultados se informan con toasts (contexto/toast.js),
// los errores de un campo aparecen debajo del campo y los de carga, como estado vacío con "Reintentar".
import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTema, espacio, radio, sombra } from '../tema';

// ---------------------------------------------------------------- estructura

/** Contenedor de pantalla: zona segura, scroll, teclado y ancho máximo en pantallas grandes. */
export function Pantalla({ children, scroll = true, anchoMax = 720, bordes = ['bottom'], estilo, refreshControl }) {
  const t = useTema();
  const contenido = <View style={[estilos.centrado, { maxWidth: anchoMax }, estilo]}>{children}</View>;
  return (
    <SafeAreaView edges={bordes} style={{ flex: 1, backgroundColor: t.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll
          ? <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>{contenido}</ScrollView>
          : <View style={[estilos.scroll, { flex: 1 }]}>{contenido}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Encabezado de página (PageHeader de R3): ícono rojo, título y subtítulo gris. */
export function EncabezadoPagina({ titulo, sub, icono, acciones }) {
  const t = useTema();
  return (
    <View style={estilos.encabezado}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <View style={estilos.fila}>
          {icono ? <Ionicons name={icono} size={22} color={t.primario} style={{ marginRight: espacio.s }} /> : null}
          <Text accessibilityRole="header" style={[estilos.h3, { color: t.texto }]}>{titulo}</Text>
        </View>
        {sub ? <Text style={[estilos.sub, { color: t.textoSuave }]}>{sub}</Text> : null}
      </View>
      {acciones ? <View style={{ flexDirection: 'row', gap: espacio.s }}>{acciones}</View> : null}
    </View>
  );
}

/** Título simple (h3 + subtítulo). */
export function Titulo({ children, sub }) {
  return <EncabezadoPagina titulo={children} sub={sub} />;
}

export function Texto({ children, suave, estilo, ...props }) {
  const t = useTema();
  return <Text style={[{ color: suave ? t.textoSuave : t.texto, fontSize: 15, lineHeight: 21 }, estilo]} {...props}>{children}</Text>;
}

/** Tarjeta (.card .shadow-sm), con cabecera opcional como las de R3. */
export function Tarjeta({ children, onPress, estilo, titulo, icono, iconoColor, derecha, sinRelleno, acentoArriba }) {
  const t = useTema();
  const base = [
    estilos.tarjeta, sombra,
    { backgroundColor: t.superficie, borderColor: t.borde },
    acentoArriba && { borderTopWidth: 3, borderTopColor: t.primario },
    estilo,
  ];
  const cabecera = titulo ? (
    <View style={[estilos.tarjetaCabecera, { borderBottomColor: t.borde }]}>
      {icono ? <Ionicons name={icono} size={17} color={iconoColor ?? t.primario} style={{ marginRight: espacio.s }} /> : null}
      <Text style={{ flex: 1, color: t.texto, fontWeight: '600', fontSize: 15 }}>{titulo}</Text>
      {derecha}
    </View>
  ) : null;
  const cuerpo = sinRelleno ? children : <View style={estilos.tarjetaCuerpo}>{children}</View>;
  if (!onPress) return <View style={base}>{cabecera}{cuerpo}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {cabecera}{cuerpo}
    </Pressable>
  );
}

/** Fila de lista (.list-group-item) para usar dentro de una Tarjeta sinRelleno. */
export function FilaLista({ children, onPress, ultima }) {
  const t = useTema();
  const estilo = [estilos.filaLista, !ultima && { borderBottomWidth: 1, borderBottomColor: t.borde }];
  if (!onPress) return <View style={estilo}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...estilo, pressed && { backgroundColor: t.rojoSuave }]}>
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------- formularios

/** Campo de texto (.form-control): etiqueta arriba, borde rojo al enfocar, error debajo. */
export const Campo = forwardRef(function Campo({ etiqueta, error, ayuda, estilo, derecha, onFocus, onBlur, ...props }, ref) {
  const t = useTema();
  const [foco, setFoco] = useState(false);
  const colorBorde = error ? t.error : foco ? t.primario : t.borde;
  return (
    <View style={[{ marginBottom: espacio.l }, estilo]}>
      {etiqueta ? <Text style={[estilos.etiqueta, { color: t.texto }]}>{etiqueta}</Text> : null}
      <View style={[estilos.inputCaja, {
        backgroundColor: t.superficie, borderColor: colorBorde,
        ...(foco && !error ? Platform.select({ web: { boxShadow: '0 0 0 .25rem rgba(200,16,46,.18)' }, default: {} }) : {}),
      }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={t.textoTenue}
          accessibilityLabel={props.accessibilityLabel ?? etiqueta}
          onFocus={(e) => { setFoco(true); onFocus?.(e); }}
          onBlur={(e) => { setFoco(false); onBlur?.(e); }}
          style={[estilos.input, { color: t.texto }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          {...props}
        />
        {derecha}
      </View>
      {error
        ? <View style={estilos.filaError}><Ionicons name="alert-circle" size={14} color={t.error} /><Text style={[estilos.ayuda, { color: t.error, marginTop: 0 }]} accessibilityLiveRegion="polite">{error}</Text></View>
        : ayuda ? <Text style={[estilos.ayuda, { color: t.textoSuave }]}>{ayuda}</Text> : null}
    </View>
  );
});

/** Campo de contraseña con botón de mostrar/ocultar (PasswordField de R3). */
export const CampoContrasena = forwardRef(function CampoContrasena(props, ref) {
  const t = useTema();
  const [ver, setVer] = useState(false);
  return (
    <Campo
      ref={ref}
      secureTextEntry={!ver}
      autoCapitalize="none"
      derecha={(
        <Pressable onPress={() => setVer((v) => !v)} accessibilityRole="button" hitSlop={8}
          accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} style={estilos.ojo}>
          <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.textoSuave} />
        </Pressable>
      )}
      {...props}
    />
  );
});

const REQUISITOS = [
  { texto: 'Al menos 10 caracteres', ok: (v) => v.length >= 10 },
  { texto: 'Una letra', ok: (v) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) },
  { texto: 'Un número', ok: (v) => /\d/.test(v) },
];

/** Requisitos de contraseña que se van tildando (PasswordChecklist de R3). */
export function ChecklistContrasena({ valor = '' }) {
  const t = useTema();
  const todos = REQUISITOS.every((r) => r.ok(valor));
  return (
    <View style={{ marginTop: -espacio.s, marginBottom: espacio.l, gap: 2 }}>
      {REQUISITOS.map((r) => {
        const ok = r.ok(valor);
        return (
          <View key={r.texto} style={estilos.fila}>
            <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? t.exito : t.textoTenue} />
            <Text style={{ marginLeft: 6, fontSize: 13, color: ok ? t.exito : t.textoSuave }}>{r.texto}</Text>
          </View>
        );
      })}
      {todos ? (
        <View style={[estilos.fila, { marginTop: 2 }]}>
          <Ionicons name="lock-closed" size={14} color={t.exito} />
          <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: t.exito }}>Contraseña robusta</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Casilla de verificación (.form-check). */
export function Casilla({ marcada, alCambiar, etiqueta }) {
  const t = useTema();
  return (
    <Pressable onPress={() => alCambiar(!marcada)} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}
      style={[estilos.fila, { marginBottom: espacio.l }]} hitSlop={6}>
      <View style={[estilos.casilla, { borderColor: marcada ? t.primario : t.textoTenue, backgroundColor: marcada ? t.primario : t.superficie }]}>
        {marcada ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
      </View>
      <Text style={{ color: t.texto, fontSize: 15, marginLeft: espacio.s }}>{etiqueta}</Text>
    </Pressable>
  );
}

/** Opciones tipo botonera (.btn-group): una seleccionada. */
export function Opciones({ opciones, valor, alCambiar }) {
  const t = useTema();
  return (
    <View style={estilos.opciones} accessibilityRole="radiogroup">
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable key={o.valor} onPress={() => alCambiar(o.valor)} accessibilityRole="radio" accessibilityState={{ selected: activa }}
            style={[estilos.opcion, { borderColor: activa ? t.primario : t.borde, backgroundColor: activa ? t.primario : t.superficie }]}>
            {o.icono ? <Ionicons name={o.icono} size={15} color={activa ? '#ffffff' : t.textoSuave} style={{ marginRight: 4 }} /> : null}
            <Text style={{ fontSize: 14, color: activa ? '#ffffff' : t.texto, fontWeight: activa ? '600' : '400' }}>{o.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- botones

/**
 * Botón con las variantes de Bootstrap del portal:
 *  primario (rojo) · secundario (contorno gris) · peligro (rojo de error) · contornoPeligro
 *  exito (verde) · oscuro (negro de marca) · texto (enlace rojo)
 */
export function Boton({ titulo, onPress, variante = 'primario', cargando = false, textoCargando, deshabilitado = false, icono, estilo, chico = false }) {
  const t = useTema();
  const inactivo = deshabilitado || cargando;
  const v = {
    primario: { fondo: t.primario, presionado: t.primarioPresionado, texto: '#ffffff', borde: t.primario },
    secundario: { fondo: 'transparent', presionado: t.superficieSec, texto: t.textoSuave, borde: t.textoTenue },
    peligro: { fondo: t.error, presionado: '#bb2d3b', texto: '#ffffff', borde: t.error },
    contornoPeligro: { fondo: 'transparent', presionado: t.errorSuave, texto: t.error, borde: t.error },
    exito: { fondo: t.exito, presionado: '#157347', texto: '#ffffff', borde: t.exito },
    aviso: { fondo: t.aviso, presionado: '#ffca2c', texto: '#000000', borde: t.aviso },
    oscuro: { fondo: t.negro, presionado: '#2a2a2e', texto: '#ffffff', borde: t.negro },
    texto: { fondo: 'transparent', presionado: 'transparent', texto: t.primario, borde: 'transparent' },
  }[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [chico ? estilos.botonChico : estilos.boton, {
        backgroundColor: pressed ? v.presionado : v.fondo, borderColor: v.borde, opacity: inactivo && !cargando ? 0.65 : 1,
      }, variante === 'texto' && { paddingHorizontal: 0 }, estilo]}
    >
      <View style={estilos.filaCentro}>
        {cargando
          ? <ActivityIndicator size="small" color={v.texto} style={{ marginRight: textoCargando || titulo ? espacio.s : 0 }} />
          : icono ? <Ionicons name={icono} size={chico ? 15 : 17} color={v.texto} style={{ marginRight: espacio.s }} /> : null}
        <Text style={[chico ? estilos.botonTextoChico : estilos.botonTexto, { color: v.texto }]}>
          {cargando && textoCargando ? textoCargando : titulo}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- insignias y avatar

/** Insignia redondeada (.badge .rounded-pill). tono: rojo | negro | gris | exito | aviso | error */
export function Insignia({ texto, tono = 'gris', icono }) {
  const t = useTema();
  const c = {
    rojo: [t.rojoSuave, t.rojoTexto],
    negro: [t.insigniaJefeFondo, t.insigniaJefeTexto],
    gris: [t.superficieSec, t.textoSuave],
    exito: [t.exito, '#ffffff'],
    aviso: [t.aviso, '#000000'],
    error: [t.error, '#ffffff'],
  }[tono] ?? [t.superficieSec, t.textoSuave];
  return (
    <View style={[estilos.insignia, { backgroundColor: c[0] }]}>
      {icono ? <Ionicons name={icono} size={11} color={c[1]} style={{ marginRight: 3 }} /> : null}
      <Text style={{ color: c[1], fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

const ROL = {
  ADMIN: { texto: 'Administrador', tono: 'rojo', icono: 'shield-half-outline' },
  GERENCIA: { texto: 'Gerencia', tono: 'rojo', icono: 'briefcase-outline' },
  JEFE: { texto: 'Jefe de área', tono: 'negro', icono: 'id-card-outline' },
  EMPLEADO: { texto: 'Empleado', tono: 'gris', icono: 'person-outline' },
};

/** Insignia de rol con los colores del portal: admin rojo suave, jefe negro, empleado gris. */
export function InsigniaRol({ rol }) {
  const r = ROL[rol] ?? ROL.EMPLEADO;
  return <Insignia texto={r.texto} tono={r.tono} icono={r.icono} />;
}

/** Tonos de la paleta corporativa para los avatares (mismos que R3). */
const TONOS_AVATAR = ['#c8102e', '#111111', '#52525b', '#8f0b21', '#3f3f46', '#b91c1c', '#27272a', '#71717a'];

/** Avatar con iniciales: el tono sale del nombre, siempre el mismo para la misma persona. */
export function Avatar({ nombre = '', tamano = 36 }) {
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const tono = TONOS_AVATAR[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % TONOS_AVATAR.length];
  return (
    <View style={[estilos.avatar, { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: tono }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: tamano * 0.4, letterSpacing: 0.3 }}>{iniciales || '?'}</Text>
    </View>
  );
}

/** Ícono en cuadrado de color suave (.bc-stat-icon). */
export function IconoEstadistica({ icono, tono = 'rojo' }) {
  const t = useTema();
  const c = { rojo: [t.rojoSuave, t.primario], exito: [t.exitoSuave, t.exito], aviso: [t.avisoSuave, t.avisoTexto], gris: [t.superficieSec, t.textoSuave] }[tono];
  return (
    <View style={[estilos.iconoEst, { backgroundColor: c[0] }]}>
      <Ionicons name={icono} size={20} color={c[1]} />
    </View>
  );
}

// ---------------------------------------------------------------- estados

export function Cargando({ texto = 'Cargando…' }) {
  const t = useTema();
  return (
    <View style={estilos.cargando}>
      <ActivityIndicator size="small" color={t.primario} />
      <Text style={{ color: t.textoSuave, marginLeft: espacio.s }}>{texto}</Text>
    </View>
  );
}

/** Bloque que "brilla" mientras carga (skeleton de R3). */
export function Esqueleto({ ancho = '100%', alto = 14, estilo }) {
  const t = useTema();
  const brillo = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const bucle = Animated.loop(Animated.sequence([
      Animated.timing(brillo, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(brillo, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    bucle.start();
    return () => bucle.stop();
  }, [brillo]);
  return <Animated.View style={[{ width: ancho, height: alto, borderRadius: 4, backgroundColor: t.superficieSec, opacity: brillo }, estilo]} />;
}

/** Tarjetas de esqueleto mientras carga un listado. */
export function EsqueletoLista({ filas = 4 }) {
  return (
    <View accessibilityLabel="Cargando" accessibilityRole="progressbar">
      {Array.from({ length: filas }, (_, i) => (
        <Tarjeta key={i}>
          <Esqueleto ancho="60%" alto={16} />
          <Esqueleto ancho="85%" alto={12} estilo={{ marginTop: 10 }} />
        </Tarjeta>
      ))}
    </View>
  );
}

/** Estado vacío (EmptyState de R3). */
export function Vacio({ icono = 'file-tray-outline', titulo, texto, children }) {
  const t = useTema();
  return (
    <View style={estilos.vacio}>
      <Ionicons name={icono} size={40} color={t.textoTenue} />
      <Text style={{ color: t.texto, fontSize: 16, fontWeight: '600', marginTop: espacio.s, textAlign: 'center' }}>{titulo}</Text>
      {texto ? <Text style={{ color: t.textoSuave, marginTop: espacio.xs, textAlign: 'center', fontSize: 14 }}>{texto}</Text> : null}
      {children}
    </View>
  );
}

/** Error al cargar datos: estado vacío con "Reintentar" (no es una caja de alerta). */
export function ErrorCarga({ error, onReintentar }) {
  if (!error) return null;
  return (
    <Vacio icono="cloud-offline-outline" titulo="No se pudo cargar" texto={error}>
      {onReintentar ? <Boton titulo="Reintentar" variante="secundario" icono="refresh" chico onPress={onReintentar} estilo={{ marginTop: espacio.m, marginBottom: 0 }} /> : null}
    </Vacio>
  );
}

export function Separador({ texto }) {
  const t = useTema();
  return (
    <View style={[estilos.filaCentro, { marginVertical: espacio.l }]}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.borde }} />
      {texto ? <Text style={{ color: t.textoSuave, marginHorizontal: espacio.m, fontSize: 13 }}>{texto}</Text> : null}
      <View style={{ flex: 1, height: 1, backgroundColor: t.borde }} />
    </View>
  );
}

/** Rótulo de sección en mayúsculas chicas (como los thead de las tablas de R3). */
export function Seccion({ children }) {
  const t = useTema();
  return <Text style={[estilos.seccion, { color: t.textoSuave }]}>{children}</Text>;
}

const estilos = StyleSheet.create({
  scroll: { flexGrow: 1, padding: espacio.l },
  centrado: { width: '100%', alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center' },
  filaCentro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  encabezado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m, marginBottom: espacio.xl },
  h3: { fontSize: 24, fontWeight: '500' },
  sub: { fontSize: 15, marginTop: espacio.xs, lineHeight: 21 },
  tarjeta: { borderWidth: 1, borderRadius: radio.l, marginBottom: espacio.m, overflow: 'hidden' },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.l, paddingVertical: espacio.m, borderBottomWidth: 1 },
  tarjetaCuerpo: { padding: espacio.l },
  filaLista: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l, paddingVertical: 13 },
  etiqueta: { fontSize: 15, marginBottom: 6 },
  inputCaja: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radio.m, minHeight: 44 },
  input: { flex: 1, paddingHorizontal: espacio.m, paddingVertical: 10, fontSize: 16 },
  ojo: { paddingHorizontal: espacio.m, alignSelf: 'stretch', justifyContent: 'center' },
  ayuda: { fontSize: 13, marginTop: espacio.xs },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: espacio.xs },
  casilla: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.l },
  opcion: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radio.m, paddingHorizontal: espacio.m, paddingVertical: 7 },
  boton: { minHeight: 44, borderRadius: radio.m, borderWidth: 1, paddingHorizontal: espacio.l, paddingVertical: 9, justifyContent: 'center', marginBottom: espacio.m },
  botonChico: { minHeight: 34, borderRadius: radio.s, borderWidth: 1, paddingHorizontal: espacio.m, paddingVertical: 5, justifyContent: 'center' },
  botonTexto: { fontSize: 16, fontWeight: '500' },
  botonTextoChico: { fontSize: 14, fontWeight: '500' },
  insignia: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  iconoEst: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cargando: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: espacio.xxl },
  vacio: { alignItems: 'center', justifyContent: 'center', paddingVertical: espacio.xxl, paddingHorizontal: espacio.l },
  seccion: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: espacio.l, marginBottom: espacio.s },
});


/** Barra de avance (.progress de Bootstrap) con el rojo de la marca, o verde al completarse. */
export function BarraProgreso({ valor = 0, total = 0, conTexto = true }) {
  const t = useTema();
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.superficieSec, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct === 100 ? t.exito : t.primario }} />
      </View>
      {conTexto ? <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 4 }}>{valor} de {total} operaciones aprobadas · {pct}%</Text> : null}
    </View>
  );
}

/** Dato con etiqueta chica arriba (para encabezados de detalle). */
export function Dato({ etiqueta, children, estilo }) {
  const t = useTema();
  return (
    <View style={[{ minWidth: 130, flexGrow: 1, flexBasis: 130, marginBottom: espacio.m }, estilo]}>
      <Text style={{ color: t.textoSuave, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>{etiqueta}</Text>
      {typeof children === 'string' || typeof children === 'number'
        ? <Text style={{ color: t.texto, fontSize: 15, marginTop: 2 }}>{children}</Text>
        : <View style={{ marginTop: 3 }}>{children ?? <Text style={{ color: t.textoTenue }}>—</Text>}</View>}
    </View>
  );
}
