// Confirmación para acciones destructivas o sensibles (igual que ConfirmDialog de R3).
// Es un diálogo propio de la app, no el Alert del sistema. `alConfirmar` puede ser async:
// mientras corre, el diálogo queda bloqueado para evitar doble envío.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton } from './ui';
import { espacio, radio, sombra, useTema } from '../tema';

export default function ConfirmDialog({
  visible, titulo, mensaje, textoConfirmar = 'Confirmar', variante = 'peligro', alConfirmar, alCerrar, children,
}) {
  const t = useTema();
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    setOcupado(true);
    try {
      await alConfirmar();
      alCerrar();
    } catch {
      // quien llama ya avisó el error (toast); el diálogo queda abierto para reintentar
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !ocupado && alCerrar()}>
      <Pressable style={estilos.fondo} onPress={() => !ocupado && alCerrar()} accessibilityLabel="Cerrar">
        <Pressable style={[estilos.caja, sombra, { backgroundColor: t.superficie, borderColor: t.borde }]} onPress={() => {}}>
          <View style={[estilos.cabecera, { borderBottomColor: t.borde }]}>
            <Text style={[estilos.titulo, { color: t.texto }]} accessibilityRole="header">{titulo}</Text>
          </View>
          {/* Con un formulario adentro puede no entrar en un celular chico: el cuerpo hace scroll */}
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={estilos.cuerpo} keyboardShouldPersistTaps="handled">
            {mensaje ? <Text style={{ color: t.texto, fontSize: 15, lineHeight: 22 }}>{mensaje}</Text> : null}
            {children}
          </ScrollView>
          <View style={[estilos.pie, { borderTopColor: t.borde }]}>
            <Boton titulo="Cancelar" variante="secundario" onPress={alCerrar} deshabilitado={ocupado} chico estilo={{ marginBottom: 0 }} />
            <Boton titulo={textoConfirmar} variante={variante} onPress={confirmar} cargando={ocupado} chico estilo={{ marginBottom: 0 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: espacio.l },
  caja: { width: '100%', maxWidth: 500, alignSelf: 'center', borderRadius: radio.l, borderWidth: 1 },
  cabecera: { padding: espacio.l, borderBottomWidth: 1 },
  titulo: { fontSize: 18, fontWeight: '600' },
  cuerpo: { padding: espacio.l },
  pie: { flexDirection: 'row', justifyContent: 'flex-end', gap: espacio.s, padding: espacio.m, borderTopWidth: 1 },
});
