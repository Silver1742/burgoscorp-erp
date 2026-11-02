// Tablón de avisos de Inicio. Lo leen todos (los avisos generales y los de su área); publican el jefe
// (para su área) y el administrador (para toda la empresa o un área). Los fijados van primero, los
// importantes en rojo, y lo que no leíste tiene "Nuevo" hasta que lo abrís.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Boton, Campo, Casilla, Esqueleto, Insignia, Opciones, Tarjeta } from './ui';
import ConfirmDialog from './ConfirmDialog';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { fechaCorta } from '../modulos';
import { espacio, radio, useTema } from '../tema';

const VACIO = { titulo: '', texto: '', fijado: false, importante: false, vence_el: '', area: 'empresa' };

function Aviso({ a, alAbrir, abierto, alEditar, alBorrar }) {
  const t = useTema();
  return (
    <Pressable onPress={alAbrir} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
      style={[estilos.aviso, { backgroundColor: t.superficie, borderColor: a.importante ? t.primario : t.borde, borderLeftColor: a.importante ? t.primario : a.fijado ? t.texto : t.borde }]}>
      <View style={estilos.linea}>
        {a.fijado ? <Ionicons name="pin" size={14} color={t.texto} /> : null}
        <Text style={{ color: t.texto, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={abierto ? undefined : 1}>{a.titulo}</Text>
        {!a.leido ? <Insignia texto="Nuevo" tono="rojo" /> : null}
      </View>
      <Text style={{ color: t.texto, fontSize: 14, marginTop: 4 }} numberOfLines={abierto ? undefined : 2}>{a.texto}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 6 }}>
        {a.autor} · {a.area_nombre ?? 'Toda la empresa'} · {fechaCorta(a.created_at)}{a.vence_el ? ` · hasta el ${fechaCorta(a.vence_el)}` : ''}
      </Text>
      {abierto && a.puede_editar ? (
        <View style={[estilos.linea, { marginTop: espacio.s }]}>
          <Boton titulo="Editar" variante="secundario" chico icono="create-outline" onPress={alEditar} estilo={{ marginBottom: 0 }} />
          <Boton titulo="Borrar" variante="contornoPeligro" chico icono="trash-outline" onPress={alBorrar} estilo={{ marginBottom: 0 }} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Tablon() {
  const t = useTema();
  const toast = useToast();
  const { usuario } = useSesion();
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [form, setForm] = useState(null); // { id?, ...campos }
  const [errores, setErrores] = useState({});
  const [borrando, setBorrando] = useState(null);
  const [areas, setAreas] = useState([]);
  const esAdmin = usuario.rol === 'ADMIN';

  const cargar = useCallback(async () => {
    try { setDatos(await api('/tablon')); } catch { setDatos({ data: [], meta: {} }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (esAdmin) api('/areas', { consulta: { activo: 'true', limite: 50 } }).then((r) => setAreas(r.data)).catch(() => {});
  }, [esAdmin]);

  function abrir(a) {
    setAbierto(abierto === a.id ? null : a.id);
    if (!a.leido) {
      api(`/tablon/${a.id}/leido`, { metodo: 'POST' }).catch(() => {});
      setDatos((d) => ({ ...d, data: d.data.map((x) => (x.id === a.id ? { ...x, leido: true } : x)) }));
    }
  }

  async function guardar() {
    const e = {};
    if (!form.titulo.trim()) e.titulo = 'Escribí un título';
    if (!form.texto.trim()) e.texto = 'Escribí el aviso';
    if (form.vence_el && !/^\d{4}-\d{2}-\d{2}$/.test(form.vence_el)) e.vence_el = 'Formato AAAA-MM-DD';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos');
    const cuerpo = {
      titulo: form.titulo.trim(), texto: form.texto.trim(), fijado: form.fijado, importante: form.importante,
      vence_el: form.vence_el || null,
      ...(esAdmin ? { area_id: form.area === 'empresa' ? null : form.area } : {}),
    };
    try {
      await api(form.id ? `/tablon/${form.id}` : '/tablon', { metodo: form.id ? 'PUT' : 'POST', cuerpo });
      toast.exito(form.id ? 'Aviso actualizado.' : form.importante ? 'Aviso publicado. Le llegó una notificación a cada uno.' : 'Aviso publicado en el tablón.');
      setForm(null);
      cargar();
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  const lista = datos?.data ?? [];
  const nuevos = lista.filter((a) => !a.leido).length;
  return (
    <Tarjeta titulo="Tablón de avisos" icono="megaphone-outline"
      derecha={datos?.meta?.puede_publicar ? <Boton titulo="Publicar" icono="add" chico onPress={() => { setErrores({}); setForm({ ...VACIO }); }} estilo={{ marginBottom: 0 }} />
        : nuevos ? <Insignia texto={`${nuevos} nuevos`} tono="rojo" /> : null}>
      {datos === null ? <View style={{ gap: 8 }}><Esqueleto ancho="70%" /><Esqueleto /></View> : null}
      {datos && !lista.length ? <Text style={{ color: t.textoSuave }}>No hay avisos por ahora.</Text> : null}
      {lista.map((a) => (
        <Aviso key={a.id} a={a} abierto={abierto === a.id} alAbrir={() => abrir(a)}
          alEditar={() => { setErrores({}); setForm({ id: a.id, titulo: a.titulo, texto: a.texto, fijado: a.fijado, importante: a.importante, vence_el: a.vence_el ? String(a.vence_el).slice(0, 10) : '', area: a.area_id ?? 'empresa' }); }}
          alBorrar={() => setBorrando(a)} />
      ))}

      <ConfirmDialog visible={Boolean(form)} titulo={form?.id ? 'Editar aviso' : 'Publicar en el tablón'} variante="primario"
        textoConfirmar={form?.id ? 'Guardar' : 'Publicar'} alConfirmar={guardar} alCerrar={() => setForm(null)}>
        {form ? (
          <View style={{ marginTop: espacio.s }}>
            {esAdmin ? (
              <>
                <Text style={{ color: t.texto, marginBottom: 6 }}>Para quién</Text>
                <Opciones opciones={[{ valor: 'empresa', titulo: 'Toda la empresa' }, ...areas.map((x) => ({ valor: x.id, titulo: x.nombre }))]}
                  valor={form.area} alCambiar={(v) => setForm((f) => ({ ...f, area: v }))} />
              </>
            ) : <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>Lo ve la gente de {usuario.area?.nombre ?? 'tu área'}.</Text>}
            <Campo etiqueta="Título" value={form.titulo} onChangeText={(v) => setForm((f) => ({ ...f, titulo: v }))} error={errores.titulo} maxLength={120} />
            <Campo etiqueta="Aviso" value={form.texto} onChangeText={(v) => setForm((f) => ({ ...f, texto: v }))} error={errores.texto} maxLength={2000} multiline numberOfLines={4} />
            <Campo etiqueta="Visible hasta (opcional)" value={form.vence_el} onChangeText={(v) => setForm((f) => ({ ...f, vence_el: v }))} error={errores.vence_el} placeholder="AAAA-MM-DD" maxLength={10} />
            <Casilla marcada={form.fijado} alCambiar={(v) => setForm((f) => ({ ...f, fijado: v }))} etiqueta="Fijarlo arriba" />
            <Casilla marcada={form.importante} alCambiar={(v) => setForm((f) => ({ ...f, importante: v }))} etiqueta="Importante: avisar a cada uno con una notificación" />
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(borrando)} titulo="Borrar aviso" mensaje={borrando ? `¿Borrar "${borrando.titulo}" del tablón?` : ''} textoConfirmar="Borrar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          try { await api(`/tablon/${borrando.id}`, { metodo: 'DELETE' }); toast.exito('Aviso borrado.'); cargar(); } catch (err) { toast.error(err.message); throw err; }
        }} />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  aviso: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
