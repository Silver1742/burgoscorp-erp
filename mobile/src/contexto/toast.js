// Notificaciones breves (toasts), como el ToastContext del portal R3.
// Reemplazan a las cajas de aviso y a los Alert del sistema: aparecen abajo, se cierran solas
// o tocándolas, y no interrumpen. El texto se muestra como texto plano (nunca HTML).
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const ToastContext = createContext(null);

// Colores de Bootstrap (text-bg-success / danger / warning / dark), igual que en R3.
const VARIANTES = {
  exito: { icono: 'checkmark-circle', fondo: '#198754', texto: '#ffffff' },
  error: { icono: 'close-circle', fondo: '#dc3545', texto: '#ffffff' },
  aviso: { icono: 'warning', fondo: '#ffc107', texto: '#000000' },
  info: { icono: 'information-circle', fondo: '#212529', texto: '#ffffff' },
};

function Toast({ toast, alCerrar }) {
  const v = VARIANTES[toast.variante];
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entrada, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
  }, [entrada]);
  return (
    <Animated.View style={{ opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <Pressable onPress={alCerrar} accessibilityRole="alert" accessibilityHint="Tocá para cerrar"
        style={[estilos.toast, { backgroundColor: v.fondo }]}>
        <Ionicons name={v.icono} size={18} color={v.texto} style={{ marginTop: 1 }} />
        <Text style={[estilos.texto, { color: v.texto }]}>{toast.mensaje}</Text>
        <Ionicons name="close" size={18} color={v.texto} style={{ opacity: 0.8 }} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const siguiente = useRef(0);
  const inset = useSafeAreaInsets();

  const cerrar = useCallback((id) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const mostrar = useCallback((variante, mensaje, { duracion = 4500 } = {}) => {
    if (!mensaje) return;
    const id = ++siguiente.current;
    setToasts((l) => [...l.slice(-2), { id, variante, mensaje: String(mensaje) }]);
    if (duracion) setTimeout(() => cerrar(id), duracion);
  }, [cerrar]);

  const api = useMemo(() => ({
    exito: (m, o) => mostrar('exito', m, o),
    error: (m, o) => mostrar('error', m, o),
    aviso: (m, o) => mostrar('aviso', m, o),
    info: (m, o) => mostrar('info', m, o),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[estilos.contenedor, { bottom: inset.bottom + 64 }]} accessibilityLiveRegion="polite">
        {toasts.map((t) => <Toast key={t.id} toast={t} alCerrar={() => cerrar(t.id)} />)}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const estilos = StyleSheet.create({
  contenedor: { position: 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8 },
  toast: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%', maxWidth: 420,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  texto: { flex: 1, fontSize: 14, lineHeight: 20 },
});
