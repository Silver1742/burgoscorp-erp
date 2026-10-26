// Bandeja de aprobación: lo que este jefe (o RRHH) tiene que resolver ahora.
// Aprobar y rechazar se confirman con un diálogo propio (el rechazo pide el motivo).
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Insignia, Avatar, Boton, Campo,
  EsqueletoLista, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Fotos from '../../../../componentes/Fotos';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_LICENCIA, TIPO_LICENCIA, fechaCorta, diasHabiles } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

export default function Aprobaciones() {
  const t = useTema();
  const toast = useToast();
  const { ancho } = usePantalla();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const [accion, setAccion] = useState(null); // { tipo: 'aprobar' | 'rechazar', l }
  const [comentario, setComentario] = useState('');
  const [errorComentario, setErrorComentario] = useState(null);
  const [viendo, setViendo] = useState(null); // solicitud de la que se ve el certificado

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setLista((await api('/licencias', { consulta: { para_aprobar: 1, limite: 50 } })).data);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  function abrir(tipo, l) {
    setComentario('');
    setErrorComentario(null);
    setAccion({ tipo, l });
  }

  async function resolver() {
    const { tipo, l } = accion;
    if (tipo === 'rechazar' && !comentario.trim()) {
      setErrorComentario('Escribí el motivo del rechazo');
      throw new Error('falta el motivo');
    }
    try {
      const r = await api(`/licencias/${l.id}/${tipo}`, { metodo: 'POST', cuerpo: { comentario: comentario.trim() || undefined } });
      const nombre = `${l.nombre} ${l.apellido}`;
      if (tipo === 'rechazar') toast.exito(`Se rechazó la solicitud de ${nombre}.`);
      else if (r.estado === 'aprobada') toast.exito(`Licencia de ${nombre} aprobada.`);
      else toast.exito(`Aprobaste la licencia de ${nombre}. Falta la aprobación de RRHH.`);
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  const apilado = ancho < 520;
  return (
    <Pantalla refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <EncabezadoPagina titulo="Aprobar licencias" icono="checkmark-done" sub="Solicitudes de tu equipo que esperan tu respuesta."
        acciones={lista?.length ? <Insignia texto={`${lista.length} pendientes`} tono="aviso" /> : null} />

      <Tarjeta sinRelleno>
        {error ? <ErrorCarga error={error} onReintentar={cargar} /> : null}
        {lista === null && !error ? <View style={{ padding: espacio.m }}><EsqueletoLista filas={3} /></View> : null}
        {lista?.length === 0 ? (
          <Vacio icono="checkmark-done-outline" titulo="No hay solicitudes para resolver" texto="Cuando alguien de tu equipo pida una licencia, aparece acá." />
        ) : null}
        {lista?.map((l, i) => (
          <FilaLista key={l.id} ultima={i === lista.length - 1}>
            <View style={[estilos.item, apilado && { flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={estilos.persona}>
                <Avatar nombre={`${l.nombre} ${l.apellido}`} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.texto, fontWeight: '600' }}>{l.apellido}, {l.nombre}</Text>
                  <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                    {l.area_nombre} · {TIPO_LICENCIA[l.tipo]} · {fechaCorta(l.fecha_desde)} al {fechaCorta(l.fecha_hasta)} ({diasHabiles(l.dias)})
                  </Text>
                  {l.motivo ? <Text style={{ color: t.textoSuave, fontSize: 13, fontStyle: 'italic' }}>“{l.motivo}”</Text> : null}
                  <View style={{ marginTop: espacio.xs }}><Insignia texto={ESTADO_LICENCIA[l.estado].texto} tono="aviso" /></View>
                </View>
              </View>
              <View style={estilos.botones}>
                <Boton titulo="Certificado" icono="attach" variante="secundario" chico onPress={() => setViendo(viendo?.id === l.id ? null : l)} />
                <Boton titulo="Rechazar" icono="close" variante="contornoPeligro" chico onPress={() => abrir('rechazar', l)} />
                <Boton titulo="Aprobar" icono="checkmark" variante="exito" chico onPress={() => abrir('aprobar', l)} />
              </View>
            </View>
          </FilaLista>
        ))}
      </Tarjeta>

      {viendo ? (
        <Fotos key={viendo.id} entidad="licencia" entidadId={viendo.id}
          titulo={`Certificado de ${viendo.nombre} ${viendo.apellido}`} vacio="No adjuntó ningún certificado." />
      ) : null}

      <ConfirmDialog
        visible={Boolean(accion)}
        titulo={accion?.tipo === 'rechazar' ? 'Rechazar solicitud' : 'Aprobar solicitud'}
        mensaje={accion ? `${TIPO_LICENCIA[accion.l.tipo]} de ${accion.l.nombre} ${accion.l.apellido}, del ${fechaCorta(accion.l.fecha_desde)} al ${fechaCorta(accion.l.fecha_hasta)}.` : ''}
        textoConfirmar={accion?.tipo === 'rechazar' ? 'Rechazar' : 'Aprobar'}
        variante={accion?.tipo === 'rechazar' ? 'peligro' : 'exito'}
        alConfirmar={resolver}
        alCerrar={() => setAccion(null)}
      >
        <Campo
          etiqueta={accion?.tipo === 'rechazar' ? 'Motivo del rechazo' : 'Comentario (opcional)'}
          value={comentario} onChangeText={setComentario} error={errorComentario}
          maxLength={500} multiline estilo={{ marginTop: espacio.l, marginBottom: 0 }}
        />
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  persona: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, justifyContent: 'flex-end' },
});
