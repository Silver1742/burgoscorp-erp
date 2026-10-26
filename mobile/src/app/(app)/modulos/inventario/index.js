// Stock: cuánto hay, cuánto está reservado para órdenes de trabajo y cuánto queda disponible.
// Lo que está bajo el mínimo aparece primero.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EncabezadoPagina, Campo, Opciones, Tarjeta, Insignia, Boton, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { TIPO_PRODUCTO, cantidad } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const FILTROS = [{ valor: 'todos', titulo: 'Todos' }, { valor: 'bajo', titulo: 'Bajo mínimo' }];

function Numero({ etiqueta, valor, unidad, tono }) {
  const t = useTema();
  return (
    <View style={{ flex: 1, minWidth: 80 }}>
      <Text style={{ color: t.textoTenue, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{etiqueta}</Text>
      <Text style={{ color: tono ?? t.texto, fontSize: 16, fontWeight: '600' }}>{cantidad(valor, unidad)}</Text>
    </View>
  );
}

export default function Stock() {
  const router = useRouter();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  const consulta = useMemo(() => ({ limite: 100, q: busqueda.trim() || undefined, bajo_minimo: filtro === 'bajo' ? 1 : undefined }), [filtro, busqueda]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api('/inventario/stock', { consulta });
      if (id !== pedido.current) return;
      setLista(r.data);
      setTotal(r.meta.total);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [consulta]);

  useEffect(() => {
    const espera = setTimeout(cargar, busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [cargar, busqueda]);

  return (
    <FlatList
      key={columnas}
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={estilos.lista}
      data={lista ?? []}
      numColumns={columnas}
      keyExtractor={(p) => String(p.id)}
      refreshing={recargando}
      onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View>
          <EncabezadoPagina titulo="Stock" icono="cube" sub="Disponible = lo que hay menos lo reservado para órdenes de trabajo."
            acciones={<Boton titulo="Escanear" icono="qr-code-outline" chico variante="secundario" onPress={() => router.push('/modulos/escanear', { withAnchor: true })} />} />
          <Campo placeholder="Buscar por código o nombre…" value={busqueda} onChangeText={setBusqueda}
            maxLength={100} autoCapitalize="none" accessibilityLabel="Buscar productos"
            derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />} />
          <Opciones opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
          {lista ? <Text style={[estilos.contador, { color: t.textoSuave }]}>{total} {total === 1 ? 'producto' : 'productos'}</Text> : null}
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={cargar} />
        : !lista ? <EsqueletoLista /> : <Vacio icono="cube-outline" titulo={filtro === 'bajo' ? 'Nada bajo el mínimo' : 'No hay productos'} texto={busqueda ? 'Probá con otra búsqueda.' : null} />}
      renderItem={({ item: p }) => (
        <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
          <Tarjeta onPress={() => router.push(`/modulos/inventario/${p.id}`)}>
            <View style={estilos.fila}>
              <Text style={[estilos.codigo, { color: t.primario }]}>{p.codigo}</Text>
              <Insignia texto={TIPO_PRODUCTO[p.tipo]} />
              <View style={{ flex: 1 }} />
              {p.bajo_minimo ? <Insignia texto="Bajo mínimo" tono="error" icono="alert-circle" /> : null}
            </View>
            <Text style={[estilos.nombre, { color: t.texto }]}>{p.nombre}</Text>
            <View style={[estilos.fila, { marginTop: espacio.s }]}>
              <Numero etiqueta="Hay" valor={p.stock_total} unidad={p.unidad} tono={p.bajo_minimo ? t.error : undefined} />
              <Numero etiqueta="Reservado" valor={p.reservado} unidad={p.unidad} />
              <Numero etiqueta="Disponible" valor={p.disponible} unidad={p.unidad} tono={Number(p.disponible) === 0 ? t.error : t.exito} />
            </View>
            {Number(p.en_camino) > 0 ? (
              <View style={[estilos.fila, { marginTop: espacio.s }]}>
                <Ionicons name="car-outline" size={14} color={t.textoSuave} />
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>En camino: {cantidad(p.en_camino, p.unidad)}</Text>
              </View>
            ) : null}
          </Tarjeta>
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  codigo: { fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  nombre: { fontSize: 16, fontWeight: '600', marginTop: espacio.s },
  contador: { marginBottom: espacio.s, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
});
