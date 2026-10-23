// Listado genérico de un recurso de la API: búsqueda, paginación infinita,
// "tirar para actualizar", esqueletos mientras carga y estados vacío / error.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Campo, EsqueletoLista, ErrorCarga, Insignia, Tarjeta, Vacio } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { buscarRecurso } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const POR_PAGINA = 20;

export default function ListaRecurso() {
  const { recurso: ruta } = useLocalSearchParams();
  // useMemo: un objeto nuevo en cada render dispararía el efecto de carga en bucle.
  const encontrado = useMemo(() => buscarRecurso(String(ruta)), [ruta]);
  const router = useRouter();
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
      const r = await api(`/${ruta}`, { consulta: { pagina: numPagina, limite: POR_PAGINA, q: encontrado?.recurso.sinBusqueda ? undefined : q || undefined } });
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
  }, [ruta, encontrado]);

  // Búsqueda con espera de 400 ms para no consultar en cada tecla.
  useEffect(() => {
    if (!encontrado) return undefined;
    const espera = setTimeout(() => cargar(1, busqueda.trim()), busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [busqueda, cargar, encontrado]);

  if (!encontrado) return <Vacio titulo="Recurso desconocido" />;
  const { recurso } = encontrado;

  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <Stack.Screen options={{ title: recurso.titulo }} />
      <FlatList
        key={columnas}
        data={estado === 'cargando' ? [] : items}
        numColumns={columnas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={estilos.lista}
        onEndReached={() => { if (estado === 'listo' && items.length < total) cargar(pagina + 1, busqueda.trim()); }}
        onEndReachedThreshold={0.4}
        refreshing={recargando}
        onRefresh={async () => { setRecargando(true); await cargar(1, busqueda.trim()); setRecargando(false); }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View>
            {recurso.sinBusqueda ? null : (
              <Campo
                placeholder="Buscar…" value={busqueda} onChangeText={setBusqueda}
                autoCapitalize="none" autoCorrect={false} maxLength={100} returnKeyType="search"
                accessibilityLabel={`Buscar en ${recurso.titulo}`}
                derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />}
              />
            )}
            {estado !== 'cargando' && !error ? (
              <Text style={[estilos.contador, { color: t.textoSuave }]}>{total} {total === 1 ? 'registro' : 'registros'}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={estado === 'cargando'
          ? <EsqueletoLista />
          : error ? <ErrorCarga error={error} onReintentar={() => cargar(1, busqueda.trim())} />
            : <Vacio titulo={busqueda ? 'Sin resultados' : 'No hay registros'} texto={busqueda ? 'Probá con otra búsqueda.' : null} />}
        ListFooterComponent={estado === 'mas' ? <ActivityIndicator style={{ margin: espacio.l }} color={t.primario} /> : null}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
            <Tarjeta onPress={recurso.abrir ? () => router.push(recurso.abrir(item)) : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[estilos.titular, { color: t.texto }]}>{recurso.titular(item)}</Text>
                  {recurso.detalle?.(item) ? <Text style={[estilos.detalle, { color: t.textoSuave }]}>{recurso.detalle(item)}</Text> : null}
                </View>
                {recurso.abrir ? <Ionicons name="chevron-forward" size={18} color={t.textoTenue} /> : null}
              </View>
              {recurso.chips ? (
                <View style={estilos.chips}>
                  {recurso.chips(item).filter((c) => c?.texto).map((c) => <Insignia key={c.texto} texto={c.texto} tono={c.tono ?? 'gris'} />)}
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
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  contador: { marginBottom: espacio.s, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  titular: { fontSize: 16, fontWeight: '600' },
  detalle: { fontSize: 13, marginTop: espacio.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs, marginTop: espacio.s },
});
