// Calidad: las OT que esperan inspección (con su QR se llega a la pieza) y las últimas inspecciones.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Insignia, Boton, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import { usePuede } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { PRIORIDAD, RESULTADO_INSPECCION, fechaCorta, fechaHoraCorta } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

export default function Calidad() {
  const router = useRouter();
  const puede = usePuede();
  const t = useTema();
  const [pendientes, setPendientes] = useState(null);
  const [inspecciones, setInspecciones] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [p, i] = await Promise.all([api('/calidad/pendientes'), api('/inspecciones', { consulta: { limite: 20 } })]);
      setPendientes(p);
      setInspecciones(i.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const inspecciona = puede('CAL', 'crear');

  return (
    <Pantalla anchoMax={1140}>
      <EncabezadoPagina titulo="Calidad" icono="ribbon" sub="Inspección final de cada orden antes de entregarla." />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}

      <Tarjeta titulo="Para inspeccionar" icono="hourglass-outline" sinRelleno
        derecha={pendientes ? <Text style={{ color: t.textoSuave, fontSize: 13 }}>{pendientes.length}</Text> : null}>
        {!pendientes && !error ? <View style={{ padding: espacio.l }}><EsqueletoLista filas={2} /></View> : null}
        {pendientes?.length === 0 ? <Vacio icono="checkmark-circle-outline" titulo="Nada esperando inspección" /> : null}
        {pendientes?.map((o, i) => (
          <FilaLista key={o.id} ultima={i === pendientes.length - 1}
            onPress={inspecciona ? () => router.push(`/modulos/calidad/inspeccionar/${o.id}`) : undefined}>
            <View style={{ flex: 1 }}>
              <View style={estilos.fila}>
                <Text style={{ color: t.primario, fontWeight: '700', fontSize: 13 }}>{o.numero}</Text>
                <Insignia texto={PRIORIDAD[o.prioridad].texto} tono={PRIORIDAD[o.prioridad].tono} />
                {o.rechazos ? <Insignia texto={`${o.rechazos} rechazo${o.rechazos > 1 ? 's' : ''}`} tono="error" /> : null}
              </View>
              <Text style={{ color: t.texto, fontWeight: '600', marginTop: 2 }}>{o.titulo}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {[o.cliente_nombre ?? 'Trabajo interno', o.area_nombre, `Entrega ${fechaCorta(o.fecha_entrega_plan)}`].join(' · ')}
              </Text>
            </View>
            {inspecciona ? <Ionicons name="chevron-forward" size={18} color={t.textoTenue} /> : null}
          </FilaLista>
        ))}
      </Tarjeta>

      {inspecciona ? (
        <Boton titulo="Escanear la pieza" icono="qr-code-outline" variante="secundario" onPress={() => router.push('/modulos/escanear')} />
      ) : null}

      <Tarjeta titulo="Últimas inspecciones" icono="list-outline" sinRelleno>
        {inspecciones?.length === 0 ? <Vacio icono="ribbon-outline" titulo="Todavía no hay inspecciones" /> : null}
        {inspecciones?.map((x, i) => {
          const r = RESULTADO_INSPECCION[x.resultado];
          return (
            <FilaLista key={x.id} ultima={i === inspecciones.length - 1} onPress={() => router.push(`/modulos/calidad/${x.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{x.numero} · {x.ot_numero}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={2}>
                  {[x.ot_titulo, x.inspector_nombre, fechaHoraCorta(x.fecha)].join(' · ')}
                </Text>
              </View>
              <Insignia texto={r.texto} tono={r.tono} />
            </FilaLista>
          );
        })}
      </Tarjeta>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
});
