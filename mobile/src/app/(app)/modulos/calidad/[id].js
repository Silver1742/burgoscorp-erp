// Detalle de una inspección: resultado, mediciones (lo que quedó fuera, en rojo) y fotos.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Esqueleto, ErrorCarga, Vacio } from '../../../../componentes/ui';
import Fotos from '../../../../componentes/Fotos';
import { usePuede } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { RESULTADO_INSPECCION, fechaHoraCorta } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const n = (v) => Number(v).toLocaleString('es-AR', { maximumFractionDigits: 4 });

export default function DetalleInspeccion() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const puede = usePuede();
  const t = useTema();
  const [x, setX] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setX(await api(`/inspecciones/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!x) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const r = RESULTADO_INSPECCION[x.resultado];
  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: x.numero }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{x.numero}</Text>
          <Insignia texto={r.texto} tono={r.tono} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{x.ot_numero} · {x.ot_titulo}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Cliente">{x.cliente_nombre ?? 'Trabajo interno'}</Dato>
          <Dato etiqueta="Inspector">{x.inspector_nombre}</Dato>
          <Dato etiqueta="Fecha">{fechaHoraCorta(x.fecha)}</Dato>
          <Dato etiqueta="Piezas">{`${x.cantidad_inspeccionada} inspeccionadas · ${x.cantidad_rechazada} rechazadas`}</Dato>
          {x.tarea_titulo ? <Dato etiqueta="A rehacer">{`${x.tarea_secuencia} · ${x.tarea_titulo}`}</Dato> : null}
        </View>
        {x.observaciones ? <Text style={{ color: t.texto, marginBottom: espacio.s }}>{x.observaciones}</Text> : null}
        {puede('PROD', 'ver') ? (
          <Boton titulo={`Ver ${x.ot_numero}`} icono="clipboard-outline" chico variante="secundario"
            onPress={() => router.push(`/modulos/produccion/${x.orden_trabajo_id}`)} estilo={{ marginBottom: 0, alignSelf: 'flex-start' }} />
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Mediciones" icono="resize-outline" sinRelleno>
        {x.mediciones.length === 0 ? <Vacio icono="resize-outline" titulo="Inspección visual, sin mediciones" /> : null}
        {x.mediciones.map((m, i) => (
          <FilaLista key={m.id} ultima={i === x.mediciones.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{m.caracteristica}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {n(m.valor_nominal)} {m.unidad} (+{n(m.tolerancia_mas)} / −{n(m.tolerancia_menos)})
              </Text>
            </View>
            <Text style={{ color: m.conforme ? t.exito : t.error, fontWeight: '700' }}>{n(m.valor_medido)} {m.unidad}</Text>
          </FilaLista>
        ))}
      </Tarjeta>

      <Fotos entidad="inspeccion" entidadId={x.id} titulo="Fotos de la inspección"
        vacio="Sacale una foto a la pieza y, si no es conforme, a la falla con el instrumento de medición." />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 19, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
});
