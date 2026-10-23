// Cambio de modo claro / oscuro (ThemeToggle de R3).
//   <SelectorTema />               botones Sistema / Claro / Oscuro (Perfil)
//   <SelectorTema compacto />      botón redondo luna/sol (login y registro)
//   <SelectorTema compacto barra/> ícono para la barra negra
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { Opciones } from './ui';
import { PREFERENCIAS_TEMA, useTema, usePreferenciaTema } from '../tema';

export default function SelectorTema({ compacto = false, barra = false }) {
  const t = useTema();
  const { preferencia, cambiar } = usePreferenciaTema();

  if (compacto) {
    const oscuro = t.modo === 'oscuro';
    return (
      <Pressable
        onPress={() => cambiar(oscuro ? 'claro' : 'oscuro')}
        accessibilityRole="button"
        accessibilityLabel={oscuro ? 'Activar modo claro' : 'Activar modo oscuro'}
        hitSlop={8}
        style={({ pressed }) => [
          barra ? estilos.barra : [estilos.redondo, { borderColor: t.textoTenue }],
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name={oscuro ? 'sunny-outline' : 'moon-outline'} size={barra ? 20 : 16} color={barra ? t.barraTextoSuave : t.textoSuave} />
      </Pressable>
    );
  }

  return <Opciones opciones={PREFERENCIAS_TEMA} valor={preferencia} alCambiar={cambiar} />;
}

const estilos = StyleSheet.create({
  redondo: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  barra: { paddingHorizontal: 10, paddingVertical: 6 },
});
