// Tablón de avisos de Inicio. Lo leen todos (los avisos generales y los de su área); publican el jefe
// (para su área) y el administrador (para toda la empresa o un área). Los fijados van primero, los
// importantes en rojo, y lo que no leíste tiene "Nuevo" hasta que lo abrís. Un aviso puede llevar
// hasta 4 imágenes (foto o galería); se ven en el aviso y, tocándolas, en grande.
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Boton, Campo, Casilla, Esqueleto, Insignia, Opciones, Tarjeta } from './ui';
import ConfirmDialog from './ConfirmDialog';
import { aDataUrl, elegirFoto, subirFoto } from './Fotos';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { fechaCorta } from '../modulos';
import { espacio, radio, useTema } from '../tema';
import { useCargar } from '../lib/cambios';
import CampoFecha, { hoyIso } from './CampoFecha';

type ImagenAvisoProps = {
  id?: any;
  estilo?: any;
  alTocar?: (...args: any[]) => any;
};

type VisorProps = {
  src?: any;
  alCerrar?: (...args: any[]) => any;
};

type AvisoProps = {
  a?: any;
  alAbrir?: (...args: any[]) => any;
  abierto?: any;
  alEditar?: (...args: any[]) => any;
  alBorrar?: (...args: any[]) => any;
  alVer?: (...args: any[]) => any;
};

type QuitarImagenProps = {
  alQuitar?: (...args: any[]) => any;
};


const VACIO = { titulo: '', texto: '', fijado: false, importante: false, vence_el: '', area: 'empresa', imagenes: [], nuevas: [], quitar: [] };
const MAX_IMAGENES = 4;

/** Una imagen de un aviso: se pide con la sesión (el servidor controla quién la ve). */
function ImagenAviso({ id, estilo, alTocar }: ImagenAvisoProps) {
  const t = useTema();
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let vivo = true;
    api(`/adjuntos/${id}`, { comoBlob: true }).then(aDataUrl).then((u) => vivo && setSrc(u)).catch(() => {});
    return () => { vivo = false; };
  }, [id]);
  return (
    <Pressable onPress={() => src && alTocar?.(src)} accessibilityRole="imagebutton" accessibilityLabel="Ver la imagen en grande"
      style={[estilo, { backgroundColor: t.superficieSec, borderColor: t.borde }]}>
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
    </Pressable>
  );
}

/** Visor a pantalla completa. */
function Visor({ src, alCerrar }: VisorProps) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={Boolean(src)} transparent animationType="fade" onRequestClose={alCerrar}>
      <Pressable style={estilos.visor} onPress={alCerrar} accessibilityLabel="Cerrar la imagen">
        <Ionicons name="close" size={28} color="#fff" style={{ position: 'absolute', top: 24, right: 20, zIndex: 1 }} />
        {src ? <Image source={{ uri: src }} style={{ width, height: height - 80 }} resizeMode="contain" /> : null}
      </Pressable>
    </Modal>
  );
}

function Aviso({ a, alAbrir, abierto, alEditar, alBorrar, alVer }: AvisoProps) {
  const t = useTema();
  return (
    <View style={[estilos.aviso, { backgroundColor: t.superficie, borderColor: a.importante ? t.primario : t.borde, borderLeftColor: a.importante ? t.primario : a.fijado ? t.texto : t.borde }]}>
      {/* El título y el texto abren y cierran; imágenes y botones quedan afuera (un botón no va dentro de otro). */}
      <Pressable onPress={alAbrir} accessibilityRole="button" accessibilityState={{ expanded: abierto }}>
        <View style={estilos.linea}>
          {a.fijado ? <Ionicons name="pin" size={14} color={t.texto} /> : null}
          <Text style={{ color: t.texto, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={abierto ? undefined : 1}>{a.titulo}</Text>
          {!a.leido ? <Insignia texto="Nuevo" tono="rojo" /> : null}
        </View>
        <Text style={{ color: t.texto, fontSize: 14, marginTop: 4 }} numberOfLines={abierto ? undefined : 2}>{a.texto}</Text>
      </Pressable>
      {a.imagenes?.length ? (
        // Cerrado, solo la primera; abierto, todas.
        <View style={estilos.imagenes}>
          {(abierto ? a.imagenes : a.imagenes.slice(0, 1)).map((img) => (
            <ImagenAviso key={img.id} id={img.id} alTocar={alVer}
              estilo={[estilos.imagen, abierto || a.imagenes.length === 1 ? estilos.imagenGrande : null]} />
          ))}
          {!abierto && a.imagenes.length > 1 ? <Text style={{ color: t.textoSuave, fontSize: 12, alignSelf: 'center' }}>+{a.imagenes.length - 1} más</Text> : null}
        </View>
      ) : null}
      <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 6 }}>
        {a.autor} · {a.area_nombre ?? 'Toda la empresa'} · {fechaCorta(a.created_at)}{a.vence_el ? ` · hasta el ${fechaCorta(a.vence_el)}` : ''}
      </Text>
      {abierto && a.puede_editar ? (
        <View style={[estilos.linea, { marginTop: espacio.s }]}>
          <Boton titulo="Editar" variante="secundario" chico icono="create-outline" onPress={alEditar} estilo={{ marginBottom: 0 }} />
          <Boton titulo="Borrar" variante="contornoPeligro" chico icono="trash-outline" onPress={alBorrar} estilo={{ marginBottom: 0 }} />
        </View>
      ) : null}
    </View>
  );
}

export default function Tablon() {
  const t = useTema();
  const toast = useToast();
  const { usuario } = useSesion();
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [form, setForm] = useState(null); // { id?, ...campos }
  const [errores, setErrores] = useState<Record<string, any>>({});
  const [borrando, setBorrando] = useState(null);
  const [areas, setAreas] = useState([]);
  const [viendo, setViendo] = useState(null);
  const esAdmin = usuario.rol === 'ADMIN';

  const cargar = useCallback(async () => {
    try { setDatos(await api('/tablon')); } catch { setDatos({ data: [], meta: {} }); }
  }, []);
  useCargar(cargar);
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
    const e: Record<string, any> = {};
    if (!form.titulo.trim()) e.titulo = 'Escribí un título';
    if (!form.texto.trim()) e.texto = 'Escribí el aviso';
    if (form.vence_el && !/^\d{4}-\d{2}-\d{2}$/.test(form.vence_el)) e.vence_el = 'Elegí una fecha válida';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos');
    const cuerpo = {
      titulo: form.titulo.trim(), texto: form.texto.trim(), fijado: form.fijado, importante: form.importante,
      vence_el: form.vence_el || null,
      ...(esAdmin ? { area_id: form.area === 'empresa' ? null : form.area } : {}),
    };
    try {
      const r = await api(form.id ? `/tablon/${form.id}` : '/tablon', { metodo: form.id ? 'PUT' : 'POST', cuerpo });
      // Las imágenes van después: necesitan que el aviso exista. Si alguna falla, el aviso igual queda.
      const avisoId = form.id ?? r.id;
      let fallaron = 0;
      for (const id of form.quitar) await api(`/adjuntos/${id}`, { metodo: 'DELETE' }).catch(() => { fallaron += 1; });
      for (const foto of form.nuevas) await subirFoto('aviso', avisoId, foto).catch(() => { fallaron += 1; });
      if (fallaron) toast.aviso(`El aviso se guardó, pero ${fallaron === 1 ? 'una imagen no se pudo guardar' : `${fallaron} imágenes no se pudieron guardar`}.`);
      else toast.exito(form.id ? 'Aviso actualizado.' : form.importante ? 'Aviso publicado. Le llegó una notificación a cada uno.' : 'Aviso publicado en el tablón.');
      setForm(null);
      cargar();
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  async function agregarImagen(origen) {
    try {
      const foto = await elegirFoto(origen);
      if (foto) setForm((f) => ({ ...f, nuevas: [...f.nuevas, foto] }));
    } catch (err) {
      toast.error(err.message ?? 'No se pudo agregar la imagen.');
    }
  }

  const lista = datos?.data ?? [];
  const cantImagenes = form ? form.imagenes.length - form.quitar.length + form.nuevas.length : 0;
  const nuevos = lista.filter((a) => !a.leido).length;
  return (
    <Tarjeta titulo="Tablón de avisos" icono="megaphone-outline"
      derecha={datos?.meta?.puede_publicar ? <Boton titulo="Publicar" icono="add" chico onPress={() => { setErrores({}); setForm({ ...VACIO }); }} estilo={{ marginBottom: 0 }} />
        : nuevos ? <Insignia texto={`${nuevos} nuevos`} tono="rojo" /> : null}>
      {datos === null ? <View style={{ gap: 8 }}><Esqueleto ancho="70%" /><Esqueleto /></View> : null}
      {datos && !lista.length ? <Text style={{ color: t.textoSuave }}>No hay avisos por ahora.</Text> : null}
      {lista.map((a) => (
        <Aviso key={a.id} a={a} abierto={abierto === a.id} alAbrir={() => abrir(a)}
          alEditar={() => { setErrores({}); setForm({ ...VACIO, id: a.id, titulo: a.titulo, texto: a.texto, fijado: a.fijado, importante: a.importante, vence_el: a.vence_el ? String(a.vence_el).slice(0, 10) : '', area: a.area_id ?? 'empresa', imagenes: a.imagenes ?? [] }); }}
          alBorrar={() => setBorrando(a)} alVer={setViendo} />
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
            <CampoFecha etiqueta="Visible hasta (opcional)" valor={form.vence_el} alCambiar={(v) => setForm((f) => ({ ...f, vence_el: v }))} error={errores.vence_el} opcional minimo={hoyIso()} />
            <Casilla marcada={form.fijado} alCambiar={(v) => setForm((f) => ({ ...f, fijado: v }))} etiqueta="Fijarlo arriba" />
            <Casilla marcada={form.importante} alCambiar={(v) => setForm((f) => ({ ...f, importante: v }))} etiqueta="Importante: avisar a cada uno con una notificación" />
            <Text style={{ color: t.texto, marginTop: espacio.s, marginBottom: 6 }}>Imágenes ({cantImagenes} de {MAX_IMAGENES})</Text>
            <View style={estilos.imagenes}>
              {form.imagenes.filter((img) => !form.quitar.includes(img.id)).map((img) => (
                <View key={img.id}>
                  <ImagenAviso id={img.id} estilo={estilos.imagen} />
                  <QuitarImagen alQuitar={() => setForm((f) => ({ ...f, quitar: [...f.quitar, img.id] }))} />
                </View>
              ))}
              {form.nuevas.map((foto, i) => (
                <View key={`n${i}`}>
                  <Image source={{ uri: foto.uri }} style={[estilos.imagen, { borderColor: t.borde }]} />
                  <QuitarImagen alQuitar={() => setForm((f) => ({ ...f, nuevas: f.nuevas.filter((_, j) => j !== i) }))} />
                </View>
              ))}
            </View>
            {cantImagenes < MAX_IMAGENES ? (
              <View style={[estilos.linea, { marginTop: espacio.s }]}>
                <Boton titulo="Sacar foto" icono="camera" variante="secundario" chico onPress={() => agregarImagen('camara')} estilo={{ marginBottom: 0 }} />
                <Boton titulo="Galería" icono="images-outline" variante="secundario" chico onPress={() => agregarImagen('galeria')} estilo={{ marginBottom: 0 }} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(borrando)} titulo="Borrar aviso" mensaje={borrando ? `¿Borrar "${borrando.titulo}" del tablón?` : ''} textoConfirmar="Borrar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          try { await api(`/tablon/${borrando.id}`, { metodo: 'DELETE' }); toast.exito('Aviso borrado.'); cargar(); } catch (err) { toast.error(err.message); throw err; }
        }} />
      <Visor src={viendo} alCerrar={() => setViendo(null)} />
    </Tarjeta>
  );
}

function QuitarImagen({ alQuitar }: QuitarImagenProps) {
  return (
    <Pressable onPress={alQuitar} accessibilityRole="button" accessibilityLabel="Quitar la imagen" hitSlop={8} style={estilos.quitar}>
      <Ionicons name="close" size={14} color="#fff" />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  aviso: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
  linea: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  imagenes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espacio.s },
  imagen: { width: 84, height: 84, borderRadius: radio.l, borderWidth: 1, overflow: 'hidden' },
  imagenGrande: { width: '100%', maxWidth: 420, height: 200 },
  quitar: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
});
