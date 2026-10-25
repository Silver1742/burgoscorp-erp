// Listado de tareas con filtros. Lo usan "Mis tareas" (mias) y "Tareas del área" (jefe).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { EncabezadoPagina, Opciones, EsqueletoLista, ErrorCarga, Vacio } from './ui';
import TarjetaTarea from './TarjetaTarea';
import { api } from '../lib/api';
import { espacio, useTema, usePantalla } from '../tema';

export default function ListaTareas({ mias = false, titulo, sub, icono, filtros, acciones, rutaDetalle }) {
  const router = useRouter();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [filtro, setFiltro] = useState(filtros[0].valor);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  const consulta = useMemo(() => {
    const f = filtros.find((x) => x.valor === filtro);
    return { limite: 100, mias: mias ? 1 : undefined, ...f.consulta };
  }, [filtro, filtros, mias]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api('/tareas', { consulta });
      if (id === pedido.current) setLista(r.data);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [consulta]);

  // Carga al entrar, al cambiar el filtro y al volver del detalle (donde pudo cambiar el estado).
  useEffect(() => { setLista(null); }, [filtro]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const enCurso = lista?.find((x) => x.estado === 'en_curso');

  return (
    <FlatList
      key={columnas}
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={estilos.lista}
      data={lista ?? []}
      numColumns={columnas}
      keyExtractor={(x) => String(x.id)}
      refreshing={recargando}
      onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }}
      ListHeaderComponent={(
        <View>
          <EncabezadoPagina titulo={titulo} icono={icono} sub={sub} acciones={acciones} />
          <Opciones opciones={filtros} valor={filtro} alCambiar={setFiltro} />
          {mias && enCurso ? (
            <Text style={[estilos.aviso, { color: t.textoSuave }]}>Estás trabajando en «{enCurso.titulo}». Pausala para empezar otra.</Text>
          ) : null}
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={cargar} />
        : !lista ? <EsqueletoLista />
          : <Vacio icono="checkbox-outline" titulo={mias ? 'No tenés tareas acá' : 'No hay tareas'}
            texto={mias ? 'Cuando tu jefe te asigne una operación, la vas a ver acá.' : null} />}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
          <TarjetaTarea tarea={item} accionRapida={mias} alCambiar={cargar} onPress={() => router.push(rutaDetalle(item.id))} />
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  aviso: { fontSize: 13, marginBottom: espacio.m, fontStyle: 'italic' },
});
