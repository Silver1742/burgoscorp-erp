// Tarjeta de una tarea en un listado. Con `accionRapida` muestra Iniciar / Pausar (Mis tareas).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, Insignia, Boton } from './ui';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { ESTADO_TAREA, PRIORIDAD, fechaHoraCorta, horas } from '../modulos';
import { espacio, useTema } from '../tema';

export default function TarjetaTarea({ tarea, onPress, accionRapida = false, alCambiar }) {
  const t = useTema();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const est = ESTADO_TAREA[tarea.estado];
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && !['aprobada', 'cancelada'].includes(tarea.estado);
  const maquinaParada = tarea.centro_trabajo_id && tarea.centro_estado !== 'operativo';
  const puedeIniciar = ['pendiente', 'pausada', 'rechazada'].includes(tarea.estado) && !maquinaParada;

  async function rapida(ruta, mensaje) {
    setOcupado(true);
    try {
      await api(`/tareas/${tarea.id}/${ruta}`, { metodo: 'POST' });
      toast.exito(mensaje);
      alCambiar?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOcupado(false);
    }
  }

  // La tarjeta no es un botón: adentro hay botones (Iniciar / Pausar) y en la web un botón
  // no puede contener otro. Solo la parte informativa es tocable.
  return (
    <Tarjeta estilo={tarea.estado === 'en_curso' && { borderColor: t.primario, borderWidth: 1.5 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${tarea.titulo}`}
        style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <View style={estilos.fila}>
        <Insignia texto={est.texto} tono={est.tono} icono={tarea.estado === 'en_curso' ? 'radio-button-on' : undefined} />
        {tarea.prioridad === 'urgente' || tarea.prioridad === 'alta'
          ? <Insignia texto={PRIORIDAD[tarea.prioridad].texto} tono={PRIORIDAD[tarea.prioridad].tono} /> : null}
        <View style={{ flex: 1 }} />
        {tarea.ot_numero ? <Text style={{ color: t.primario, fontWeight: '600', fontSize: 13 }}>{tarea.ot_numero} · {tarea.secuencia}</Text> : null}
      </View>
      <Text style={[estilos.titulo, { color: t.texto }]}>{tarea.titulo}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={2}>
        {[tarea.centro_codigo && `${tarea.centro_codigo} ${tarea.centro_nombre}`, tarea.asignados ?? 'Sin asignar'].filter(Boolean).join(' · ')}
      </Text>
      <View style={[estilos.fila, { marginTop: espacio.s }]}>
        {tarea.fecha_limite ? (
          <>
            <Ionicons name="alarm-outline" size={14} color={vencida ? t.error : t.textoSuave} />
            <Text style={{ color: vencida ? t.error : t.textoSuave, fontSize: 13, fontWeight: vencida ? '600' : '400' }}>
              {vencida ? 'Vencida ' : 'Vence '}{fechaHoraCorta(tarea.fecha_limite)}
            </Text>
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={{ color: t.textoSuave, fontSize: 13 }}>{horas(tarea.horas_reales)}{tarea.horas_estimadas != null ? ` / ${horas(tarea.horas_estimadas)}` : ''}</Text>
      </View>
      {maquinaParada ? (
        <View style={[estilos.fila, { marginTop: espacio.s }]}>
          <Ionicons name="warning" size={14} color={t.avisoTexto} />
          <Text style={{ color: t.avisoTexto, fontSize: 13 }}>Máquina en mantenimiento</Text>
        </View>
      ) : null}
      </Pressable>
      {accionRapida && (puedeIniciar || tarea.estado === 'en_curso') ? (
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          {tarea.estado === 'en_curso'
            ? <Boton titulo="Pausar" icono="pause" variante="oscuro" chico cargando={ocupado} onPress={() => rapida('pausar', 'Tarea pausada.')} />
            : <Boton titulo={tarea.estado === 'pendiente' ? 'Iniciar' : 'Reanudar'} icono="play" chico cargando={ocupado} onPress={() => rapida('iniciar', 'Tarea en curso.')} />}
        </View>
      ) : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  titulo: { fontSize: 16, fontWeight: '600', marginTop: espacio.s },
});
