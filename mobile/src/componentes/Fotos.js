// Fotos adjuntas a una tarea, una licencia, etc. Saca la foto con la cámara del teléfono o la
// elige de la galería, la achica (lado mayor de 1600 px, JPEG) antes de subirla y así también
// le saca los datos de ubicación. El servidor igual vuelve a verificar el tipo y limpia el EXIF.
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, Boton, Esqueleto, ErrorCarga } from './ui';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { fechaHoraCorta } from '../modulos';
import { espacio, radio, useTema } from '../tema';

const LADO_MAX = 1600;
const MINIATURA = 96;

/** Convierte un Blob en data URL para mostrarlo con <Image> (funciona en el celular y en la web). */
function aDataUrl(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = rechazar;
    lector.readAsDataURL(blob);
  });
}

/** Achica la foto y la vuelve a codificar como JPEG (sin EXIF). */
async function prepararFoto(asset) {
  const { width = 0, height = 0 } = asset;
  let contexto = ImageManipulator.manipulate(asset.uri);
  if (Math.max(width, height) > LADO_MAX) {
    contexto = contexto.resize(width >= height ? { width: LADO_MAX } : { height: LADO_MAX });
  }
  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const blob = await (await fetch(resultado.uri)).blob();
  return blob.type === 'image/jpeg' ? blob : new Blob([blob], { type: 'image/jpeg' });
}

function Miniatura({ adjunto, onPress }) {
  const t = useTema();
  const [src, setSrc] = useState(null);
  const esImagen = adjunto.mime.startsWith('image/');

  useEffect(() => {
    let vivo = true;
    if (esImagen) {
      api(`/adjuntos/${adjunto.id}`, { comoBlob: true }).then(aDataUrl).then((u) => vivo && setSrc(u)).catch(() => {});
    }
    return () => { vivo = false; };
  }, [adjunto.id, esImagen]);

  return (
    <Pressable onPress={() => onPress(src)} accessibilityRole="button" accessibilityLabel={`Ver ${adjunto.nombre_original}`}
      style={({ pressed }) => [estilos.miniatura, { borderColor: t.borde, backgroundColor: t.superficieSec }, pressed && { opacity: 0.7 }]}>
      {esImagen && src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      {esImagen && !src ? <Esqueleto ancho={MINIATURA} alto={MINIATURA} /> : null}
      {!esImagen ? (
        <View style={{ alignItems: 'center', padding: espacio.xs }}>
          <Ionicons name="document-text-outline" size={30} color={t.primario} />
          <Text style={{ color: t.textoSuave, fontSize: 11 }} numberOfLines={2}>{adjunto.nombre_original}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Fotos({ entidad, entidadId, titulo = 'Fotos', vacio = 'Todavía no hay fotos.', alCambiar }) {
  const t = useTema();
  const toast = useToast();
  const { width, height } = useWindowDimensions();
  const [lista, setLista] = useState(null);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [viendo, setViendo] = useState(null); // { adjunto, src }
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await api('/adjuntos', { consulta: { entidad, entidad_id: entidadId } });
      setLista(r.data);
      setMeta(r.meta);
    } catch (err) {
      setError(err.message);
    }
  }, [entidad, entidadId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregar(origen) {
    try {
      const permiso = origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        toast.error(origen === 'camara'
          ? 'Sin permiso para usar la cámara. Habilitalo en los ajustes del teléfono.'
          : 'Sin permiso para ver tus fotos. Habilitalo en los ajustes del teléfono.');
        return;
      }
      const opciones = { mediaTypes: ['images'], quality: 0.8, exif: false };
      const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      if (r.canceled || !r.assets?.length) return;

      setSubiendo(true);
      const foto = await prepararFoto(r.assets[0]);
      await api('/adjuntos', {
        metodo: 'POST',
        consulta: { entidad, entidad_id: entidadId, nombre: r.assets[0].fileName ?? `foto-${Date.now()}.jpg` },
        binario: foto,
        timeout: 60000,
      });
      toast.exito('Foto agregada.');
      await cargar();
      alCambiar?.();
    } catch (err) {
      toast.error(err.message ?? 'No se pudo agregar la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar() {
    try {
      await api(`/adjuntos/${viendo.adjunto.id}`, { metodo: 'DELETE' });
      toast.exito('Foto borrada.');
      setViendo(null);
      await cargar();
      alCambiar?.();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function abrir(adjunto, src) {
    if (adjunto.mime.startsWith('image/')) return setViendo({ adjunto, src });
    // PDF: en la web se abre en otra pestaña; en el celular se muestra el aviso (se ve desde la web).
    try {
      const blob = await api(`/adjuntos/${adjunto.id}`, { comoBlob: true });
      if (typeof window !== 'undefined' && window.URL?.createObjectURL) window.open(window.URL.createObjectURL(blob), '_blank', 'noopener');
      else toast.info('El PDF se puede ver desde la versión web.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const contador = lista ? `${lista.length}${meta.maximo ? ` / ${meta.maximo}` : ''}` : null;

  return (
    <Tarjeta titulo={titulo} icono="camera-outline"
      derecha={contador ? <Text style={{ color: t.textoSuave, fontSize: 13 }}>{contador}</Text> : null}>
      {error ? <ErrorCarga error={error} onReintentar={cargar} /> : null}
      {lista === null && !error ? <Esqueleto alto={MINIATURA} ancho={MINIATURA} /> : null}
      {lista?.length === 0 ? <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>{vacio}</Text> : null}
      {lista?.length ? (
        <View style={estilos.grilla}>
          {lista.map((a) => <Miniatura key={a.id} adjunto={a} onPress={(src) => abrir(a, src)} />)}
        </View>
      ) : null}
      {meta.puede_agregar ? (
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          <Boton titulo="Sacar foto" icono="camera" chico cargando={subiendo} textoCargando="Subiendo…" onPress={() => agregar('camara')} estilo={{ marginBottom: 0 }} />
          <Boton titulo="Galería" icono="images-outline" variante="secundario" chico deshabilitado={subiendo} onPress={() => agregar('galeria')} estilo={{ marginBottom: 0 }} />
        </View>
      ) : null}

      <Modal visible={Boolean(viendo)} transparent animationType="fade" onRequestClose={() => setViendo(null)}>
        <View style={estilos.visor}>
          <View style={estilos.visorCabecera}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>{viendo?.adjunto.subido_por_nombre}</Text>
              <Text style={{ color: '#ccc', fontSize: 12 }}>{viendo ? fechaHoraCorta(viendo.adjunto.created_at) : ''}</Text>
            </View>
            {viendo?.adjunto.puede_borrar ? (
              <Pressable onPress={() => setBorrando(true)} accessibilityRole="button" accessibilityLabel="Borrar foto" hitSlop={10} style={{ padding: espacio.s }}>
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable onPress={() => setViendo(null)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10} style={{ padding: espacio.s }}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {viendo?.src ? <Image source={{ uri: viendo.src }} style={{ width, height: height - 120 }} resizeMode="contain" /> : null}
          </ScrollView>
        </View>
        <ConfirmDialog visible={borrando} titulo="Borrar foto" mensaje="¿Borrar esta foto? No se puede deshacer."
          textoConfirmar="Borrar" alConfirmar={borrar} alCerrar={() => setBorrando(false)} />
      </Modal>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  miniatura: { width: MINIATURA, height: MINIATURA, borderRadius: radio.l, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  visorCabecera: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.l, paddingTop: espacio.xl, paddingBottom: espacio.s, gap: espacio.s },
});
