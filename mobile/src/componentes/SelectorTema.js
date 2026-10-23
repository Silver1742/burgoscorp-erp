// Elección de modo claro / oscuro.
//   <SelectorTema />           tres opciones (Perfil)
//   <SelectorTema compacto />  un botón que alterna claro ↔ oscuro (pantallas sin sesión)
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Texto } from './ui';
import { PREFERENCIAS_TEMA, espacio, radio, useTema, usePreferenciaTema } from '../tema';

export default function SelectorTema({ compacto = false }) {
  const t = useTema();
  const { preferencia, cambiar } = usePreferenciaTema();

  if (compacto) {
    const oscuro = t.modo === 'oscuro';
    return (
      <Pressable
        onPress={() => cambiar(oscuro ? 'claro' : 'oscuro')}
        accessibilityRole="button"
        accessibilityLabel={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        hitSlop={8}
        style={({ pressed }) => [estilos.compacto, { borderColor: t.borde, backgroundColor: t.superficie, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={oscuro ? 'sunny-outline' : 'moon-outline'} size={20} color={t.texto} />
      </Pressable>
    );
  }

  return (
    <View style={[estilos.grupo, { borderColor: t.borde, backgroundColor: t.superficie }]} accessibilityRole="radiogroup">
      {PREFERENCIAS_TEMA.map((p) => {
        const activo = preferencia === p.valor;
        return (
          <Pressable
            key={p.valor}
            onPress={() => cambiar(p.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
            style={[estilos.opcion, activo && { backgroundColor: t.primario }]}
          >
            <Ionicons name={p.icono} size={18} color={activo ? t.primarioTexto : t.textoSuave} />
            <Texto estilo={{ fontSize: 13, marginTop: 2, color: activo ? t.primarioTexto : t.texto, fontWeight: activo ? '700' : '400' }}>
              {p.titulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  compacto: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grupo: { flexDirection: 'row', borderWidth: 1, borderRadius: radio.m, padding: 3 },
  opcion: { flex: 1, alignItems: 'center', paddingVertical: espacio.s, borderRadius: radio.m - 2 },
});
