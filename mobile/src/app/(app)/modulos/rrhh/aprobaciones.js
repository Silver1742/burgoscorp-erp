// Bandeja de aprobación: lo que este jefe (o RRHH) tiene que resolver ahora.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Aviso, Boton, Campo, Cargando, Etiqueta, Tarjeta, Texto, Vacio } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { ESTADO_LICENCIA, TIPO_LICENCIA, fechaCorta, diasHabiles } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

function Solicitud({ l, alResolver }) {
  const t = useTema();
  const [comentario, setComentario] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function resolver(accion) {
    if (accion === 'rechazar' && !comentario.trim()) {
      setError('Escribí el motivo del rechazo');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await api(`/licencias/${l.id}/${accion}`, { metodo: 'POST', cuerpo: { comentario: comentario.trim() || undefined } });
      alResolver();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={estilos.cabecera}>
        <Texto estilo={{ fontWeight: '700', flex: 1 }}>{l.apellido}, {l.nombre}</Texto>
        <Etiqueta texto={ESTADO_LICENCIA[l.estado].texto} color={t.aviso} />
      </View>
      <Texto suave>{l.area_nombre} · {TIPO_LICENCIA[l.tipo]}</Texto>
      <Texto estilo={{ marginTop: espacio.xs }}>Del {fechaCorta(l.fecha_desde)} al {fechaCorta(l.fecha_hasta)} · {diasHabiles(l.dias)}</Texto>
      {l.motivo ? <Texto suave estilo={{ marginTop: espacio.xs, fontStyle: 'italic' }}>“{l.motivo}”</Texto> : null}
      <Aviso>{error}</Aviso>
      {rechazando ? (
        <>
          <Campo etiqueta="Motivo del rechazo" value={comentario} onChangeText={setComentario} maxLength={500} multiline estilo={{ marginTop: espacio.m }} />
          <View style={estilos.botones}>
            <Boton titulo="Confirmar rechazo" variante="peligro" onPress={() => resolver('rechazar')} cargando={enviando} estilo={{ flex: 1 }} />
            <Boton titulo="Volver" variante="texto" onPress={() => setRechazando(false)} estilo={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <View style={[estilos.botones, { marginTop: espacio.m }]}>
          <Boton titulo="Aprobar" icono="checkmark" onPress={() => resolver('aprobar')} cargando={enviando} estilo={{ flex: 1 }} />
          <Boton titulo="Rechazar" variante="peligro" onPress={() => setRechazando(true)} deshabilitado={enviando} estilo={{ flex: 1 }} />
        </View>
      )}
    </Tarjeta>
  );
}

export default function Aprobaciones() {
  const t = useTema();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await api('/licencias', { consulta: { para_aprobar: 1, limite: 50 } });
      setLista(r.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        <Aviso onReintentar={cargar}>{error}</Aviso>
        {lista === null && !error ? <Cargando /> : null}
        {lista?.length === 0 ? <Vacio icono="checkmark-done-outline" titulo="No hay solicitudes para resolver" texto="Cuando alguien de tu equipo pida una licencia, aparece acá." /> : null}
        {lista?.map((l) => <Solicitud key={l.id} l={l} alResolver={cargar} />)}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.xs },
  botones: { flexDirection: 'row', gap: espacio.m },
});
