// Ficha de una máquina (lo que se abre al escanear la etiqueta QR pegada en ella): estado,
// fallas abiertas, planes preventivos y las últimas reparaciones. Desde acá se reporta una falla.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Esqueleto, ErrorCarga, Vacio } from '../../../../../componentes/ui';
import EtiquetaQR from '../../../../../componentes/EtiquetaQR';
import { usePuede } from '../../../../../contexto/sesion';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { ESTADO_MAQUINA, ESTADO_OM, fechaCorta, fechaHoraCorta } from '../../../../../modulos';
import { espacio, useTema } from '../../../../../tema';

export default function FichaMaquina() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const puede = usePuede();
  const toast = useToast();
  const t = useTema();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [generando, setGenerando] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setM(await api(`/maquinas/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function generar(plan) {
    setGenerando(plan.id);
    try {
      const om = await api('/ordenes-mantenimiento', {
        metodo: 'POST', cuerpo: { centro_trabajo_id: m.id, plan_id: plan.id, tipo: 'preventivo', descripcion: plan.descripcion ?? plan.nombre },
      });
      toast.exito(`${om.numero} generada. Asignale un técnico.`);
      router.push(`/modulos/mantenimiento/${om.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerando(null);
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!m) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const operativa = m.estado === 'operativo';

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: m.codigo }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{m.codigo}</Text>
          <Insignia texto={ESTADO_MAQUINA[m.estado]} tono={operativa ? 'exito' : 'error'} icono={operativa ? 'checkmark-circle' : 'stop-circle'} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{m.nombre}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Área">{m.area_nombre}</Dato>
          <Dato etiqueta="Ubicación">{m.ubicacion ?? '—'}</Dato>
          <Dato etiqueta="Marca y modelo">{[m.marca, m.modelo].filter(Boolean).join(' ') || '—'}</Dato>
          {m.nro_serie ? <Dato etiqueta="N.º de serie">{m.nro_serie}</Dato> : null}
        </View>
        <View style={estilos.fila}>
          {puede('MANT', 'crear') ? (
            <Boton titulo="Reportar una falla" icono="warning-outline" chico
              onPress={() => router.push({ pathname: '/modulos/mantenimiento/nueva', params: { maquina: m.id } })} estilo={{ marginBottom: 0 }} />
          ) : null}
          <EtiquetaQR codigo={`BC:MAQ:${m.codigo}`} titulo={m.nombre} sub={`${m.codigo} · ${m.area_nombre}`} textoBoton="QR de la máquina" />
        </View>
      </Tarjeta>

      <Tarjeta titulo="Fallas abiertas" icono="warning-outline" sinRelleno>
        {m.abiertas.length === 0 ? <Vacio icono="checkmark-circle-outline" titulo="Sin fallas abiertas" /> : null}
        {m.abiertas.map((o, i) => (
          <FilaLista key={o.id} ultima={i === m.abiertas.length - 1} onPress={() => router.push(`/modulos/mantenimiento/${o.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.primario, fontWeight: '700', fontSize: 13 }}>{o.numero}{o.detiene_maquina ? ' · máquina parada' : ''}</Text>
              <Text style={{ color: t.texto }} numberOfLines={2}>{o.descripcion}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 12 }}>{fechaHoraCorta(o.fecha_apertura)}</Text>
            </View>
            <Insignia texto={ESTADO_OM[o.estado].texto} tono={ESTADO_OM[o.estado].tono} />
            <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
          </FilaLista>
        ))}
      </Tarjeta>

      <Tarjeta titulo="Preventivos" icono="calendar-outline" sinRelleno>
        {m.planes.length === 0 ? <Vacio icono="calendar-outline" titulo="Sin planes preventivos" /> : null}
        {m.planes.map((p, i) => (
          <FilaLista key={p.id} ultima={i === m.planes.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{p.nombre}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                Cada {p.frecuencia_dias} días · próximo {fechaCorta(p.proxima_fecha)}{p.ultima_ejecucion ? ` · último ${fechaCorta(p.ultima_ejecucion)}` : ''}
              </Text>
            </View>
            {p.vencido ? <Insignia texto="Vencido" tono="error" /> : null}
            {m.puede_generar_preventivo ? (
              <Boton titulo="Generar" icono="add" chico variante="secundario" cargando={generando === p.id} onPress={() => generar(p)} estilo={{ marginBottom: 0 }} />
            ) : null}
          </FilaLista>
        ))}
      </Tarjeta>

      {m.ultimas.length ? (
        <Tarjeta titulo="Últimas reparaciones" icono="time-outline" sinRelleno>
          {m.ultimas.map((o, i) => (
            <FilaLista key={o.id} ultima={i === m.ultimas.length - 1} onPress={() => router.push(`/modulos/mantenimiento/${o.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }} numberOfLines={1}>{o.descripcion}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={2}>{o.numero} · {fechaHoraCorta(o.fecha_cierre)} · {o.solucion}</Text>
              </View>
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
});
