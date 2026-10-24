// Mis licencias: pedir vacaciones / licencias y ver en qué estado está cada pedido.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Pantalla, EncabezadoPagina, Campo, Boton, Opciones, Tarjeta, FilaLista, Insignia,
  EsqueletoLista, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { TIPO_LICENCIA, ESTADO_LICENCIA, fechaCorta, diasHabiles } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const manana = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const OPCIONES_TIPO = Object.entries(TIPO_LICENCIA).map(([valor, titulo]) => ({ valor, titulo }));

export default function MisLicencias() {
  const t = useTema();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [errorLista, setErrorLista] = useState(null);
  const [form, setForm] = useState({ tipo: 'vacaciones', fecha_desde: manana(), fecha_hasta: manana(), motivo: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aCancelar, setACancelar] = useState(null);

  const cargar = useCallback(async () => {
    setErrorLista(null);
    try {
      setLista((await api('/licencias', { consulta: { limite: 50 } })).data);
    } catch (err) {
      setErrorLista(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function pedir() {
    const e = {};
    if (!esFecha(form.fecha_desde)) e.fecha_desde = 'Formato AAAA-MM-DD';
    if (!esFecha(form.fecha_hasta)) e.fecha_hasta = 'Formato AAAA-MM-DD';
    if (!e.fecha_desde && !e.fecha_hasta && form.fecha_hasta < form.fecha_desde) e.fecha_hasta = 'No puede ser anterior al inicio';
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const r = await api('/licencias', { metodo: 'POST', cuerpo: { ...form, motivo: form.motivo.trim() || undefined } });
      toast.exito(`Solicitud enviada (${diasHabiles(r.dias)}). Te avisamos cuando la aprueben.`);
      setForm((f) => ({ ...f, motivo: '' }));
      cargar();
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    try {
      await api(`/licencias/${aCancelar.id}/cancelar`, { metodo: 'POST' });
      toast.exito('Solicitud cancelada.');
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err; // el diálogo queda abierto para reintentar
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Mis licencias" icono="airplane" sub="La aprueba tu jefe y después RRHH. Se cuentan solo los días hábiles." />

      <Tarjeta titulo="Nueva solicitud" icono="add-circle-outline">
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Tipo</Text>
        <Opciones opciones={OPCIONES_TIPO} valor={form.tipo} alCambiar={(tipo) => setForm((f) => ({ ...f, tipo }))} />
        <View style={estilos.fila}>
          <Campo etiqueta="Desde" value={form.fecha_desde} onChangeText={(v) => setForm((f) => ({ ...f, fecha_desde: v }))}
            error={errores.fecha_desde} placeholder="AAAA-MM-DD" maxLength={10} estilo={{ flex: 1 }} />
          <Campo etiqueta="Hasta" value={form.fecha_hasta} onChangeText={(v) => setForm((f) => ({ ...f, fecha_hasta: v }))}
            error={errores.fecha_hasta} placeholder="AAAA-MM-DD" maxLength={10} estilo={{ flex: 1 }} />
        </View>
        <Campo etiqueta="Motivo (opcional)" value={form.motivo} onChangeText={(v) => setForm((f) => ({ ...f, motivo: v }))}
          error={errores.motivo} maxLength={500} multiline />
        <Boton titulo="Enviar solicitud" onPress={pedir} cargando={enviando} textoCargando="Enviando…" icono="send-outline" estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <Tarjeta titulo="Mis solicitudes" icono="list-outline" sinRelleno>
        {errorLista ? <ErrorCarga error={errorLista} onReintentar={cargar} /> : null}
        {lista === null && !errorLista ? <View style={{ padding: espacio.m }}><EsqueletoLista filas={2} /></View> : null}
        {lista?.length === 0 ? <Vacio icono="airplane-outline" titulo="Todavía no pediste licencias" /> : null}
        {lista?.map((l, i) => {
          const estado = ESTADO_LICENCIA[l.estado];
          const cancelable = ['pendiente', 'aprobada_jefe'].includes(l.estado);
          return (
            <FilaLista key={l.id} ultima={i === lista.length - 1}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{TIPO_LICENCIA[l.tipo]}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>Del {fechaCorta(l.fecha_desde)} al {fechaCorta(l.fecha_hasta)} · {diasHabiles(l.dias)}</Text>
                {l.comentario_resolucion ? <Text style={{ color: t.textoSuave, fontSize: 13, fontStyle: 'italic' }}>“{l.comentario_resolucion}”</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: espacio.xs }}>
                <Insignia texto={estado.texto} tono={estado.tono ?? 'gris'} />
                {cancelable ? <Boton titulo="Cancelar" variante="contornoPeligro" chico onPress={() => setACancelar(l)} /> : null}
              </View>
            </FilaLista>
          );
        })}
      </Tarjeta>

      <ConfirmDialog
        visible={Boolean(aCancelar)}
        titulo="Cancelar solicitud"
        mensaje={aCancelar ? `¿Cancelar la solicitud de ${TIPO_LICENCIA[aCancelar.tipo].toLowerCase()} del ${fechaCorta(aCancelar.fecha_desde)} al ${fechaCorta(aCancelar.fecha_hasta)}?` : ''}
        textoConfirmar="Cancelar solicitud"
        alConfirmar={cancelar}
        alCerrar={() => setACancelar(null)}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
});
