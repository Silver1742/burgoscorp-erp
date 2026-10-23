// Listado genérico de un recurso de la API: búsqueda, paginación infinita,
// "tirar para actualizar" y estados de carga, vacío y error.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Aviso, Campo, Cargando, Etiqueta, Tarjeta, Texto, Vacio } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { buscarRecurso } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const POR_PAGINA = 20;

export default function ListaRecurso() {
  const { recurso: ruta } = useLocalSearchParams();
  // useMemo: un objeto nuevo en cada render dispararía el efecto de carga en bucle.
  const encontrado = useMemo(() => buscarRecurso(String(ruta)), [ruta]);
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error | mas
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedidoActual = useRef(0);

  const cargar = useCallback(async (numPagina, q) => {
    const id = ++pedidoActual.current; // descarta respuestas viejas si el usuario sigue escribiendo
    setError(null);
    setEstado(numPagina === 1 ? 'cargando' : 'mas');
    try {
      const r = await api(`/${ruta}`, { consulta: { pagina: numPagina, limite: POR_PAGINA, q: q || undefined } });
      if (id !== pedidoActual.current) return;
      setItems((prev) => (numPagina === 1 ? r.data : [...prev, ...r.data]));
      setTotal(r.meta.total);
      setPagina(numPagina);
      setEstado('listo');
    } catch (err) {
      if (id !== pedidoActual.current) return;
      setError(err.message);
      setEstado('error');
    }
  }, [ruta]);

  // Búsqueda con espera de 400 ms para no consultar en cada tecla.
  useEffect(() => {
    if (!encontrado) return undefined;
    const espera = setTimeout(() => cargar(1, busqueda.trim()), busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [busqueda, cargar, encontrado]);

  async function recargar() {
    setRecargando(true);
    await cargar(1, busqueda.trim());
    setRecargando(false);
  }

  function cargarMas() {
    if (estado === 'listo' && items.length < total) cargar(pagina + 1, busqueda.trim());
  }

  if (!encontrado) return <Vacio titulo="Recurso desconocido" />;
  const { recurso } = encontrado;

  const tonos = { exito: t.exito, aviso: t.aviso, error: t.error };

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <Stack.Screen options={{ title: recurso.titulo }} />
      <FlatList
        key={columnas}
        data={items}
        numColumns={columnas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={estilos.lista}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.4}
        refreshing={recargando}
        onRefresh={recargar}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View>
            <Campo
              placeholder="Buscar…"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={100}
              returnKeyType="search"
              accessibilityLabel={`Buscar en ${recurso.titulo}`}
            />
            {estado !== 'cargando' && !error ? (
              <Texto suave estilo={{ marginBottom: espacio.s, fontSize: 13 }}>{total} {total === 1 ? 'registro' : 'registros'}</Texto>
            ) : null}
            <Aviso onReintentar={() => cargar(1, busqueda.trim())}>{error}</Aviso>
          </View>
        )}
        ListEmptyComponent={estado === 'cargando'
          ? <Cargando />
          : !error ? <Vacio titulo={busqueda ? 'Sin resultados' : 'No hay registros'} texto={busqueda ? 'Probá con otra búsqueda.' : null} /> : null}
        ListFooterComponent={estado === 'mas' ? <ActivityIndicator style={{ margin: espacio.l }} color={t.primario} /> : null}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
            <Tarjeta>
              <Texto estilo={estilos.titular}>{recurso.titular(item)}</Texto>
              {recurso.detalle?.(item) ? <Texto suave estilo={estilos.detalle}>{recurso.detalle(item)}</Texto> : null}
              {recurso.chips ? (
                <View style={estilos.chips}>
                  {recurso.chips(item).filter((c) => c?.texto).map((c) => (
                    <Etiqueta key={c.texto} texto={c.texto} color={tonos[c.tono]} />
                  ))}
                </View>
              ) : null}
            </Tarjeta>
          </View>
        )}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1100, width: '100%', alignSelf: 'center', flexGrow: 1 },
  titular: { fontSize: 16, fontWeight: '600' },
  detalle: { fontSize: 13, marginTop: espacio.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs, marginTop: espacio.s },
});
