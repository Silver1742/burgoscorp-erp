// Mis licencias: pedir vacaciones / licencias y ver en qué estado está cada pedido.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Pantalla, Titulo, Campo, Boton, Aviso, Tarjeta, Texto, Etiqueta, Cargando, Vacio } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { TIPO_LICENCIA, ESTADO_LICENCIA, fechaCorta, diasHabiles } from '../../../../modulos';
import { espacio, radio, useTema } from '../../../../tema';

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
const manana = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function MisLicencias() {
  const t = useTema();
  const [lista, setLista] = useState(null);
  const [errorLista, setErrorLista] = useState(null);
  const [form, setForm] = useState({ tipo: 'vacaciones', fecha_desde: manana(), fecha_hasta: manana(), motivo: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setErrorLista(null);
    try {
      const r = await api('/licencias', { consulta: { limite: 50 } });
      setLista(r.data);
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
    setError(null);
    setOk(null);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const r = await api('/licencias', { metodo: 'POST', cuerpo: { ...form, motivo: form.motivo.trim() || undefined } });
      setOk(`Solicitud enviada: ${diasHabiles(r.dias)}. Te avisamos cuando la aprueben.`);
      setForm((f) => ({ ...f, motivo: '' }));
      cargar();
    } catch (err) {
      setError(err.message);
      setErrores(err.porCampo ?? {});
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id) {
    try {
      await api(`/licencias/${id}/cancelar`, { metodo: 'POST' });
      cargar();
    } catch (err) {
      setErrorLista(err.message);
    }
  }

  return (
    <Pantalla>
      <Titulo sub="La aprueba tu jefe y después RRHH. Se cuentan solo los días hábiles.">Nueva solicitud</Titulo>
      <Aviso tipo="exito">{ok}</Aviso>
      <Aviso>{error}</Aviso>

      <Texto estilo={estilos.etiqueta}>Tipo</Texto>
      <View style={estilos.opciones}>
        {Object.entries(TIPO_LICENCIA).map(([valor, texto]) => {
          const activo = form.tipo === valor;
          return (
            <Pressable key={valor} onPress={() => setForm((f) => ({ ...f, tipo: valor }))}
              accessibilityRole="radio" accessibilityState={{ selected: activo }}
              style={[estilos.opcion, { borderColor: activo ? t.acento : t.borde, backgroundColor: activo ? t.superficieAlt : t.superficie }]}>
              <Texto estilo={{ fontSize: 14, fontWeight: activo ? '700' : '400' }}>{texto}</Texto>
            </Pressable>
          );
        })}
      </View>

      <View style={estilos.fila}>
        <Campo etiqueta="Desde" value={form.fecha_desde} onChangeText={(v) => setForm((f) => ({ ...f, fecha_desde: v }))}
          error={errores.fecha_desde} placeholder="AAAA-MM-DD" maxLength={10} estilo={{ flex: 1 }} />
        <Campo etiqueta="Hasta" value={form.fecha_hasta} onChangeText={(v) => setForm((f) => ({ ...f, fecha_hasta: v }))}
          error={errores.fecha_hasta} placeholder="AAAA-MM-DD" maxLength={10} estilo={{ flex: 1 }} />
      </View>
      <Campo etiqueta="Motivo (opcional)" value={form.motivo} onChangeText={(v) => setForm((f) => ({ ...f, motivo: v }))}
        maxLength={500} multiline />
      <Boton titulo="Enviar solicitud" onPress={pedir} cargando={enviando} icono="send-outline" />

      <Titulo>Mis solicitudes</Titulo>
      <Aviso onReintentar={cargar}>{errorLista}</Aviso>
      {lista === null && !errorLista ? <Cargando /> : null}
      {lista?.length === 0 ? <Vacio icono="airplane-outline" titulo="Todavía no pediste licencias" /> : null}
      {lista?.map((l) => (
        <Tarjeta key={l.id}>
          <View style={estilos.cabecera}>
            <Texto estilo={{ fontWeight: '700', flex: 1 }}>{TIPO_LICENCIA[l.tipo]}</Texto>
            <Etiqueta texto={ESTADO_LICENCIA[l.estado].texto} color={{ exito: t.exito, aviso: t.aviso, error: t.error }[ESTADO_LICENCIA[l.estado].tono]} />
          </View>
          <Texto suave>Del {fechaCorta(l.fecha_desde)} al {fechaCorta(l.fecha_hasta)} · {diasHabiles(l.dias)}</Texto>
          {l.comentario_resolucion ? <Texto suave estilo={{ marginTop: espacio.xs, fontStyle: 'italic' }}>“{l.comentario_resolucion}”</Texto> : null}
          {['pendiente', 'aprobada_jefe'].includes(l.estado)
            ? <Boton titulo="Cancelar solicitud" variante="texto" onPress={() => cancelar(l.id)} estilo={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 0 }} />
            : null}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 14, fontWeight: '600', marginBottom: espacio.xs },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.l },
  opcion: { borderWidth: 1.5, borderRadius: radio.m, paddingHorizontal: espacio.m, paddingVertical: espacio.s, minHeight: 40, justifyContent: 'center' },
  fila: { flexDirection: 'row', gap: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.xs },
});
