// Ventas: solicitudes de los clientes y presupuestos, primero lo que espera una acción.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EncabezadoPagina, Campo, Opciones, Tarjeta, Insignia, Boton, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import { usePuede } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { ESTADO_PRESUPUESTO, ESTADO_SOLICITUD, TIPO_TRABAJO, fechaCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const VISTAS = [
  { valor: 'solicitudes', titulo: 'Solicitudes' },
  { valor: 'mias', titulo: 'A mi cargo' },
  { valor: 'sin_asignar', titulo: 'Para asignar' },
  { valor: 'presupuestos', titulo: 'Presupuestos' },
];

export default function Ventas() {
  const router = useRouter();
  const puede = usePuede();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [vista, setVista] = useState('solicitudes');
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  const [ruta, consulta] = useMemo(() => (vista === 'presupuestos'
    ? ['/presupuestos', { limite: 50, q: busqueda.trim() || undefined }]
    : ['/solicitudes', { limite: 50, q: busqueda.trim() || undefined, mias: vista === 'mias' ? 1 : undefined, sin_asignar: vista === 'sin_asignar' ? 1 : undefined }]), [vista, busqueda]);

  const cargar = useCallback(async () => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api(ruta, { consulta });
      if (id === pedido.current) setLista(r.data);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [ruta, consulta]);

  useEffect(() => {
    setLista(null);
    const espera = setTimeout(cargar, busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [cargar, busqueda]);

  const esPresupuesto = vista === 'presupuestos';

  return (
    <FlatList
      key={columnas}
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={estilos.lista}
      data={lista ?? []}
      numColumns={columnas}
      keyExtractor={(x) => `${vista}-${x.id}`}
      refreshing={recargando}
      onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View>
          <EncabezadoPagina titulo="Ventas" icono="briefcase" sub="Del pedido del cliente al presupuesto y la orden de trabajo."
            acciones={puede('VEN', 'crear') ? <Boton titulo="Nueva" icono="add" chico onPress={() => router.push('/modulos/ventas/nueva')} /> : null} />
          <Campo placeholder="Buscar por número, cliente o pedido…" value={busqueda} onChangeText={setBusqueda}
            maxLength={100} autoCapitalize="none" accessibilityLabel="Buscar en ventas"
            derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />} />
          <Opciones opciones={VISTAS} valor={vista} alCambiar={setVista} />
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={cargar} />
        : !lista ? <EsqueletoLista /> : <Vacio icono="briefcase-outline" titulo={esPresupuesto ? 'No hay presupuestos' : 'No hay solicitudes'} />}
      renderItem={({ item: x }) => {
        const estado = esPresupuesto ? ESTADO_PRESUPUESTO[x.estado] : ESTADO_SOLICITUD[x.estado];
        return (
          <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
            <Tarjeta onPress={() => router.push(esPresupuesto ? `/modulos/ventas/presupuesto/${x.id}` : `/modulos/ventas/solicitud/${x.id}`)}>
              <View style={estilos.fila}>
                <Text style={[estilos.numero, { color: t.primario }]}>{x.numero}</Text>
                <Insignia texto={estado.texto} tono={estado.tono} />
                <View style={{ flex: 1 }} />
                {esPresupuesto ? <Text style={{ color: t.texto, fontWeight: '700' }}>{pesosAr(x.total)}</Text> : null}
                {!esPresupuesto && x.fotos ? <Insignia texto={String(x.fotos)} icono="camera" /> : null}
              </View>
              <Text style={[estilos.titulo, { color: t.texto }]}>{esPresupuesto ? (x.solicitud_titulo ?? x.cliente_nombre) : x.titulo}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {(esPresupuesto
                  ? [x.cliente_nombre, x.ot_numero && `Generó ${x.ot_numero}`, x.estado === 'enviado' && `Vence ${fechaCorta(x.vence)}`]
                  : [x.cliente_nombre, TIPO_TRABAJO[x.tipo_trabajo], x.asignada_a_nombre ?? 'Sin asignar']).filter(Boolean).join(' · ')}
              </Text>
            </Tarjeta>
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  titulo: { fontSize: 16, fontWeight: '600', marginTop: espacio.s },
});
