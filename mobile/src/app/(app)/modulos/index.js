// Grilla de módulos que el rol puede ver. Se adapta al ancho (2 a 4 columnas).
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EncabezadoPagina, Tarjeta, Vacio, Insignia } from '../../../componentes/ui';
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
      ListHeaderComponent={<EncabezadoPagina titulo="Módulos" icono="apps" sub="Las áreas del sistema a las que tenés acceso." />}
      ListEmptyComponent={<Vacio titulo="No tenés módulos habilitados" texto="Pedile a un administrador que revise tu rol." />}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columnas, padding: espacio.xs }}>
          <Tarjeta onPress={() => router.push(`/modulos/${item.codigo}`)} acentoArriba estilo={estilos.tarjeta}>
            <View style={[estilos.icono, { backgroundColor: t.rojoSuave }]}>
              <Ionicons name={item.icono.replace('-outline', '')} size={22} color={t.primario} />
            </View>
            <Text style={[estilos.titulo, { color: t.texto }]}>{item.titulo}</Text>
            <Text style={{ color: t.textoSuave, fontSize: 13 }}>{item.descripcion}</Text>
            {!item.recursos.length && !item.acciones?.length
              ? <View style={{ marginTop: espacio.s }}><Insignia texto="Próximamente" /></View> : null}
          </Tarjeta>
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center' },
  tarjeta: { minHeight: 150, marginBottom: 0 },
  icono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '600', marginTop: espacio.m, marginBottom: 2 },
});
