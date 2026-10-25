// Órdenes de trabajo: lo urgente y lo que vence antes primero, con el avance de cada una.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EncabezadoPagina, Campo, Opciones, Tarjeta, Insignia, BarraProgreso, Boton, EsqueletoLista, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import { usePuede } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { ESTADO_OT, PRIORIDAD, TIPO_TRABAJO, fechaCorta } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const FILTROS = [
  { valor: 'abiertas', titulo: 'Abiertas' },
  { valor: 'control_calidad', titulo: 'En calidad' },
  { valor: 'todas', titulo: 'Todas' },
];
const hoy = () => new Date().toISOString().slice(0, 10);

export function TarjetaOt({ ot, onPress }) {
  const t = useTema();
  const atrasada = ot.fecha_entrega_plan && ot.fecha_entrega_plan < hoy() && !['terminada', 'entregada', 'cancelada'].includes(ot.estado);
  return (
    <Tarjeta onPress={onPress}>
      <View style={estilos.fila}>
        <Text style={[estilos.numero, { color: t.primario }]}>{ot.numero}</Text>
        <Insignia texto={ESTADO_OT[ot.estado].texto} tono={ESTADO_OT[ot.estado].tono} />
        <View style={{ flex: 1 }} />
        <Insignia texto={PRIORIDAD[ot.prioridad].texto} tono={PRIORIDAD[ot.prioridad].tono} icono={ot.prioridad === 'urgente' ? 'flame' : undefined} />
      </View>
      <Text style={[estilos.titulo, { color: t.texto }]}>{ot.titulo}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }}>
        {[ot.cliente_nombre ?? 'Trabajo interno', TIPO_TRABAJO[ot.tipo_trabajo], ot.area_nombre].join(' · ')}
      </Text>
      <View style={{ marginTop: espacio.m }}>
        <BarraProgreso valor={ot.operaciones_aprobadas} total={ot.operaciones} />
      </View>
      <View style={[estilos.fila, { marginTop: espacio.s }]}>
        <Ionicons name="calendar-outline" size={14} color={atrasada ? t.error : t.textoSuave} />
        <Text style={{ color: atrasada ? t.error : t.textoSuave, fontSize: 13, fontWeight: atrasada ? '600' : '400' }}>
          Entrega {fechaCorta(ot.fecha_entrega_plan)}{atrasada ? ' · atrasada' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        {ot.responsable_nombre ? <Text style={{ color: t.textoSuave, fontSize: 13 }}>{ot.responsable_nombre}</Text> : null}
      </View>
    </Tarjeta>
  );
}

export default function OrdenesTrabajo() {
  const router = useRouter();
  const puede = usePuede();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [filtro, setFiltro] = useState('abiertas');
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  const consulta = useMemo(() => ({
    limite: 50,
    q: busqueda.trim() || undefined,
    abiertas: filtro === 'abiertas' ? 1 : undefined,
    estado: filtro === 'control_calidad' ? 'control_calidad' : undefined,
  }), [filtro, busqueda]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api('/ordenes-trabajo', { consulta });
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
      keyExtractor={(o) => String(o.id)}
      refreshing={recargando}
      onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View>
          <EncabezadoPagina titulo="Órdenes de trabajo" icono="clipboard" sub="Trabajos del taller y su avance."
            acciones={puede('PROD', 'crear') ? <Boton titulo="Nueva" icono="add" chico onPress={() => router.push('/modulos/produccion/nueva')} /> : null} />
          <Campo placeholder="Buscar por número, título o cliente…" value={busqueda} onChangeText={setBusqueda}
            maxLength={100} autoCapitalize="none" accessibilityLabel="Buscar órdenes de trabajo"
            derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />} />
          <Opciones opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
          {lista ? <Text style={[estilos.contador, { color: t.textoSuave }]}>{total} {total === 1 ? 'orden' : 'órdenes'}</Text> : null}
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={cargar} />
        : !lista ? <EsqueletoLista /> : <Vacio icono="clipboard-outline" titulo="No hay órdenes de trabajo" texto={busqueda ? 'Probá con otra búsqueda.' : null} />}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
          <TarjetaOt ot={item} onPress={() => router.push(`/modulos/produccion/${item.id}`)} />
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  titulo: { fontSize: 16, fontWeight: '600', marginTop: espacio.s },
  contador: { marginBottom: espacio.s, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
});
