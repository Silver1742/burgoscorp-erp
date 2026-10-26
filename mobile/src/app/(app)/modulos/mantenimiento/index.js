// Órdenes de mantenimiento: primero las máquinas paradas y lo urgente. Para el área de
// Mantenimiento también avisa qué preventivos vencen esta semana.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EncabezadoPagina, Campo, Opciones, Tarjeta, FilaLista, Insignia, Boton, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import { usePuede, useSesion } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { ESTADO_OM, PRIORIDAD, fechaCorta, fechaHoraCorta } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

export function TarjetaOm({ om, onPress }) {
  const t = useTema();
  return (
    <Tarjeta onPress={onPress}>
      <View style={estilos.fila}>
        <Text style={[estilos.numero, { color: t.primario }]}>{om.numero}</Text>
        <Insignia texto={ESTADO_OM[om.estado].texto} tono={ESTADO_OM[om.estado].tono} />
        {om.tipo === 'preventivo' ? <Insignia texto="Preventivo" /> : null}
        <View style={{ flex: 1 }} />
        <Insignia texto={PRIORIDAD[om.prioridad].texto} tono={PRIORIDAD[om.prioridad].tono} />
      </View>
      <Text style={[estilos.titulo, { color: t.texto }]}>{om.centro_codigo} · {om.centro_nombre}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 14 }} numberOfLines={2}>{om.descripcion}</Text>
      <View style={[estilos.fila, { marginTop: espacio.s }]}>
        {om.detiene_maquina && !['cerrada', 'cancelada'].includes(om.estado) ? (
          <>
            <Ionicons name="stop-circle" size={14} color={t.error} />
            <Text style={{ color: t.error, fontSize: 13, fontWeight: '600' }}>Máquina parada</Text>
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={{ color: t.textoSuave, fontSize: 13 }}>
          {[om.responsable_nombre ?? 'Sin técnico', fechaHoraCorta(om.fecha_apertura)].join(' · ')}
        </Text>
      </View>
    </Tarjeta>
  );
}

export default function OrdenesMantenimiento() {
  const router = useRouter();
  const puede = usePuede();
  const { usuario } = useSesion();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [filtro, setFiltro] = useState('abiertas');
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);
  const filtros = [
    { valor: 'abiertas', titulo: 'Abiertas' },
    ...(usuario.empleadoId ? [{ valor: 'mias', titulo: 'A mi cargo' }] : []),
    { valor: 'todas', titulo: 'Todas' },
  ];

  const consulta = useMemo(() => ({
    limite: 50,
    q: busqueda.trim() || undefined,
    abiertas: filtro === 'abiertas' ? 1 : undefined,
    mias: filtro === 'mias' ? 1 : undefined,
  }), [filtro, busqueda]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const [r, p] = await Promise.all([api('/ordenes-mantenimiento', { consulta }), api('/ordenes-mantenimiento/planes-proximos')]);
      if (id !== pedido.current) return;
      setLista(r.data);
      setTotal(r.meta.total);
      setPlanes(p);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [consulta]);

  useEffect(() => {
    const espera = setTimeout(cargar, busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [cargar, busqueda]);

  const sinOrden = planes.filter((p) => !p.con_orden);

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
          <EncabezadoPagina titulo="Mantenimiento" icono="build" sub="Fallas reportadas y preventivos de las máquinas."
            acciones={(
              <>
                <Boton titulo="Escanear" icono="qr-code-outline" chico variante="secundario" onPress={() => router.push('/modulos/escanear', { withAnchor: true })} />
                {puede('MANT', 'crear') ? <Boton titulo="Reportar falla" icono="warning-outline" chico onPress={() => router.push('/modulos/mantenimiento/nueva')} /> : null}
              </>
            )} />
          {sinOrden.length && puede('MANT', 'aprobar') ? (
            <Tarjeta titulo="Preventivos de esta semana" icono="calendar-outline" sinRelleno>
              {sinOrden.slice(0, 5).map((p, i) => (
                <FilaLista key={p.id} ultima={i === Math.min(sinOrden.length, 5) - 1} onPress={() => router.push(`/modulos/mantenimiento/maquina/${p.centro_trabajo_id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.texto, fontWeight: '600' }}>{p.nombre}</Text>
                    <Text style={{ color: t.textoSuave, fontSize: 13 }}>{p.centro_codigo} {p.centro_nombre} · {fechaCorta(p.proxima_fecha)}</Text>
                  </View>
                  {p.vencido ? <Insignia texto="Vencido" tono="error" /> : <Insignia texto="Próximo" tono="aviso" />}
                  <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
                </FilaLista>
              ))}
            </Tarjeta>
          ) : null}
          <Campo placeholder="Buscar por número, máquina o falla…" value={busqueda} onChangeText={setBusqueda}
            maxLength={100} autoCapitalize="none" accessibilityLabel="Buscar órdenes de mantenimiento"
            derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />} />
          <Opciones opciones={filtros} valor={filtro} alCambiar={setFiltro} />
          {lista ? <Text style={[estilos.contador, { color: t.textoSuave }]}>{total} {total === 1 ? 'orden' : 'órdenes'}</Text> : null}
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={cargar} />
        : !lista ? <EsqueletoLista /> : <Vacio icono="build-outline" titulo={filtro === 'abiertas' ? 'No hay fallas abiertas' : 'No hay órdenes'} texto={busqueda ? 'Probá con otra búsqueda.' : null} />}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
          <TarjetaOm om={item} onPress={() => router.push(`/modulos/mantenimiento/${item.id}`)} />
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
