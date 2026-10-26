// Etiqueta QR para pegar en una pieza, una máquina o un estante del depósito.
// El contenido es un código interno (BC:OT:OT-2026-0001), nunca un enlace: al escanearlo,
// la app le pregunta a la API qué es y si el usuario lo puede ver.
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Boton } from './ui';
import { espacio, radio, sombra, useTema } from '../tema';

/** Botón que abre la etiqueta en grande (para mostrarla, imprimirla o sacarle captura). */
export default function EtiquetaQR({ codigo, titulo, sub, textoBoton = 'Etiqueta QR' }) {
  const t = useTema();
  const [abierta, setAbierta] = useState(false);
  const imprimible = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function';

  return (
    <>
      <Boton titulo={textoBoton} icono="qr-code-outline" variante="secundario" chico onPress={() => setAbierta(true)} estilo={{ marginBottom: 0 }} />
      <Modal visible={abierta} transparent animationType="fade" onRequestClose={() => setAbierta(false)}>
        <Pressable style={estilos.fondo} onPress={() => setAbierta(false)} accessibilityLabel="Cerrar">
          <Pressable style={[estilos.caja, sombra, { backgroundColor: t.superficie, borderColor: t.borde }]} onPress={() => {}}>
            <Pressable onPress={() => setAbierta(false)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10} style={estilos.cerrar}>
              <Ionicons name="close" size={22} color={t.textoSuave} />
            </Pressable>
            {/* El código, siempre negro sobre blanco para que se lea bien impreso y con poca luz. */}
            <View style={estilos.marco}>
              <QRCode value={codigo} size={220} color="#000000" backgroundColor="#ffffff" ecl="M" />
            </View>
            <Text style={[estilos.titulo, { color: t.texto }]} numberOfLines={2}>{titulo}</Text>
            {sub ? <Text style={[estilos.sub, { color: t.textoSuave }]} numberOfLines={2}>{sub}</Text> : null}
            <Text style={[estilos.codigo, { color: t.textoTenue }]} selectable>{codigo}</Text>
            <View style={estilos.botones}>
              {imprimible ? <Boton titulo="Imprimir" icono="print-outline" chico variante="oscuro" onPress={() => window.print()} estilo={{ marginBottom: 0 }} /> : null}
              <Boton titulo="Cerrar" chico variante="secundario" onPress={() => setAbierta(false)} estilo={{ marginBottom: 0 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: espacio.l },
  caja: { width: '100%', maxWidth: 340, borderRadius: radio.l, borderWidth: 1, padding: espacio.xl, alignItems: 'center' },
  cerrar: { position: 'absolute', top: espacio.s, right: espacio.s, padding: espacio.xs },
  marco: { padding: espacio.m, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#000000', borderRadius: radio.m, marginTop: espacio.m },
  titulo: { fontSize: 17, fontWeight: '700', marginTop: espacio.l, textAlign: 'center' },
  sub: { fontSize: 13, marginTop: 2, textAlign: 'center' },
  codigo: { fontSize: 12, marginTop: espacio.s, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  botones: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.l },
});
