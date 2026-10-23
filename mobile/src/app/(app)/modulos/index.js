// Grilla de módulos que el rol puede ver. Se adapta al ancho (2 a 4 columnas).
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, Texto, Vacio } from '../../../componentes/ui';
import { useSesion } from '../../../contexto/sesion';
import { MODULOS } from '../../../modulos';
import { espacio, useTema, usePantalla } from '../../../tema';

export default function Modulos() {
  const { permisos } = useSesion();
  const router = useRouter();
  const t = useTema();
  const { columnas } = usePantalla();
  const visibles = MODULOS.filter((m) => permisos[m.codigo]?.ver);

  return (
    <FlatList
      key={columnas} // FlatList necesita remontarse si cambia la cantidad de columnas (rotación)
      data={visibles}
      numColumns={columnas}
      keyExtractor={(m) => m.codigo}
      contentContainerStyle={estilos.lista}
      style={{ backgroundColor: t.fondo }}
      ListEmptyComponent={<Vacio titulo="No tenés módulos habilitados" texto="Pedile a un administrador que revise tu rol." />}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columnas, padding: espacio.xs }}>
          <Tarjeta onPress={() => router.push(`/modulos/${item.codigo}`)} estilo={estilos.tarjeta}>
            <Ionicons name={item.icono} size={30} color={t.acento} />
            <Texto estilo={estilos.titulo}>{item.titulo}</Texto>
            <Texto suave estilo={{ fontSize: 13 }}>{item.descripcion}</Texto>
            {!item.recursos.length ? <Texto suave estilo={estilos.pronto}>Próximamente</Texto> : null}
          </Tarjeta>
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.m, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  tarjeta: { minHeight: 140, marginBottom: 0 },
  titulo: { fontSize: 16, fontWeight: '700', marginTop: espacio.s },
  pronto: { fontSize: 12, marginTop: espacio.s, fontStyle: 'italic' },
});
