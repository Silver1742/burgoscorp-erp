// Marca BurgosCorp: isotipo "BC" en rojo + nombre con "Corp" en rojo.
import { StyleSheet, Text, View } from 'react-native';
import { useTema } from '../tema';

export default function Logo({ tamano = 72, conNombre = true }) {
  const t = useTema();
  return (
    <View style={estilos.contenedor} accessible accessibilityRole="image" accessibilityLabel="BurgosCorp">
      <View style={[estilos.isotipo, { width: tamano, height: tamano, borderRadius: tamano * 0.22, backgroundColor: t.primario }]}>
        <Text style={[estilos.iniciales, { fontSize: tamano * 0.42 }]}>BC</Text>
        <View style={[estilos.franja, { height: tamano * 0.08, backgroundColor: '#141416' }]} />
      </View>
      {conNombre ? (
        <Text style={[estilos.nombre, { color: t.texto }]}>
          Burgos<Text style={{ color: t.primario }}>Corp</Text>
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center' },
  isotipo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iniciales: { color: '#FFFFFF', fontWeight: '900', letterSpacing: -1 },
  franja: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  nombre: { fontSize: 24, fontWeight: '800', letterSpacing: 0.5, marginTop: 8 },
});
