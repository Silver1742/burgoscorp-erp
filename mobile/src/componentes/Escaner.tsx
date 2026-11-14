// Lector de códigos con la cámara del teléfono (QR de piezas, máquinas, estantes y órdenes de
// compra). También deja escribir el código a mano, por si la etiqueta está sucia o no hay cámara.
//
// Lo que se lee es un dato externo: se valida el formato acá y en la API, se busca por código
// exacto y nunca se abre como enlace (un QR con "https://..." no lleva a ningún lado).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Boton, Campo, Tarjeta } from './ui';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { codigoDeQR } from '../lib/qr';
import { espacio, radio, useTema } from '../tema';
import type { BarcodeType } from 'expo-camera';

type EscanerProps = {
  alEncontrar?: (...args: any[]) => any;
  tipos?: any;
  ayuda?: string;
};


const FORMATO = /^[A-Za-z0-9:._\-/]{1,100}$/;
const TIPOS: BarcodeType[] = ['qr', 'code128', 'code39', 'ean13'];
// En la web, expo-camera usa el lector del navegador (BarcodeDetector) y, si no lo tiene (Safari en
// iPhone, Firefox), uno propio que trae incluido: no hace falta bloquear ningún navegador.
// Sin cámara (o sin HTTPS) queda el campo para escribir el código.
const SIN_CAMARA_WEB = Platform.OS === 'web' && (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia);
// En el teléfono se usa el lector del sistema (en Android, el de Google Play Services): abre su propia
// cámara, enfoca y lee solo, y no necesita el permiso de cámara de la app. El visor propio queda
// para los teléfonos que no lo tienen.
const LECTOR_DEL_SISTEMA = Platform.OS !== 'web' && CameraView.isModernBarcodeScannerAvailable;

/** A qué pantalla lleva lo que devolvió /escaneo. */
export function destinoEscaneo(r) {
  if (r.tipo === 'orden_trabajo') return r.tarea_id ? `/tareas/${r.tarea_id}` : `/modulos/produccion/${r.id}`;
  if (r.tipo === 'maquina') return `/modulos/mantenimiento/maquina/${r.id}`;
  if (r.tipo === 'producto') return `/modulos/inventario/${r.id}`;
  if (r.tipo === 'orden_compra') return `/modulos/compras/${r.id}`;
  if (r.tipo === 'inspeccion') return `/modulos/calidad/inspeccionar/${r.id}`;
  return null;
}

/**
 * alEncontrar(resultado) recibe { tipo, id, titulo, tarea_id? } ya validado por la API.
 * `tipos` limita qué se acepta (ej. solo 'maquina' al reportar una falla).
 */
export default function Escaner({ alEncontrar, tipos, ayuda = 'Apuntá al código QR de la pieza, la máquina o el estante.' }: EscanerProps) {
  const t = useTema();
  const toast = useToast();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [leido, setLeido] = useState(null);
  const ocupado = useRef(false);
  // La cámara se monta solo mientras esta pantalla está a la vista: al salir se libera y al volver
  // arranca de nuevo (si quedaba montada, en algunos teléfonos el visor volvía en negro).
  const [aLaVista, setALaVista] = useState(true);
  useFocusEffect(useCallback(() => {
    setALaVista(true);
    return () => setALaVista(false);
  }, []));

  const abrirLector = useCallback(async () => {
    try {
      await CameraView.launchScanner({ barcodeTypes: TIPOS });
    } catch (err) {
      if (/cancel/i.test(String((err as Error)?.message))) return; // la cerró sin escanear
      toast.error('No se pudo abrir el lector. Escribí el código abajo.');
    }
  }, [toast]);

  const resolver = useCallback(async (codigo) => {
    // Acepta el enlace impreso en las etiquetas (solo de nuestro dominio) o el código suelto.
    const texto = codigoDeQR(codigo) ?? '';
    if (ocupado.current) return;
    if (!FORMATO.test(texto)) {
      toast.error('Ese código no es de BurgosCorp.');
      return;
    }
    ocupado.current = true;
    setBuscando(true);
    setLeido(texto);
    try {
      const r = await api('/escaneo', { consulta: { codigo: texto } });
      if (tipos && !tipos.includes(r.tipo)) throw new Error('Ese código no corresponde a lo que se pide acá.');
      alEncontrar(r);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBuscando(false);
      // Pausa para no leer el mismo código diez veces seguidas.
      setTimeout(() => { ocupado.current = false; }, 1500);
    }
  }, [alEncontrar, tipos, toast]);

  // Lo que lee el lector del sistema llega por este evento (solo a la pantalla que está a la vista).
  const resolverRef = useRef(resolver);
  resolverRef.current = resolver;
  useEffect(() => {
    if (!LECTOR_DEL_SISTEMA || !aLaVista) return undefined;
    const sub = CameraView.onModernBarcodeScanned(({ data }) => {
      if (Platform.OS === 'ios') CameraView.dismissScanner().catch(() => {});
      resolverRef.current(data);
    });
    return () => sub.remove();
  }, [aLaVista]);

  return (
    <View>
      <View style={[estilos.visor, { backgroundColor: '#000', borderColor: t.borde }]}>
        {LECTOR_DEL_SISTEMA ? (
          <View style={estilos.sinPermiso}>
            <Ionicons name="qr-code-outline" size={54} color="#ffffff" />
            <Text style={estilos.textoClaro}>Tocá el botón y apuntá al código: se lee solo.</Text>
            <Boton titulo="Escanear con la cámara" icono="camera" onPress={abrirLector} cargando={buscando} estilo={{ marginTop: espacio.m, marginBottom: 0 }} />
          </View>
        ) : SIN_CAMARA_WEB ? (
          <View style={estilos.sinPermiso}>
            <Ionicons name="qr-code-outline" size={54} color="#ffffff" />
            <Text style={estilos.textoClaro}>Este navegador no tiene acceso a la cámara. Usá la app en el teléfono o escribí el código abajo.</Text>
          </View>
        ) : permiso?.granted ? (
          <>
            {aLaVista ? <CameraView style={StyleSheet.absoluteFill} facing="back"
              barcodeScannerSettings={{ barcodeTypes: TIPOS }}
              onBarcodeScanned={buscando ? undefined : ({ data }) => resolver(data)} /> : null}
            <View pointerEvents="none" style={estilos.mira} />
          </>
        ) : (
          <View style={estilos.sinPermiso}>
            <Ionicons name="qr-code-outline" size={54} color="#ffffff" />
            <Text style={estilos.textoClaro}>
              {permiso && !permiso.canAskAgain
                ? 'La cámara está bloqueada para BurgosCorp. Habilitala en los ajustes del teléfono o escribí el código abajo.'
                : 'Para escanear hace falta usar la cámara.'}
            </Text>
            {!permiso || permiso.canAskAgain ? <Boton titulo="Usar la cámara" icono="camera" onPress={pedirPermiso} estilo={{ marginTop: espacio.m, marginBottom: 0 }} /> : null}
          </View>
        )}
      </View>
      <Text style={{ color: t.textoSuave, textAlign: 'center', marginVertical: espacio.s }}>
        {buscando ? `Buscando ${leido}…` : ayuda}
      </Text>

      <Tarjeta titulo="O escribí el código" icono="keypad-outline">
        <Campo value={manual} onChangeText={setManual} placeholder="Ej.: OT-2026-0001, CNC-02, MP-1045-25" autoCapitalize="characters"
          autoCorrect={false} maxLength={100} accessibilityLabel="Código" onSubmitEditing={() => resolver(manual)} returnKeyType="search" />
        <Boton titulo="Buscar" icono="search" onPress={() => resolver(manual)} cargando={buscando} deshabilitado={!manual.trim()} estilo={{ marginBottom: 0 }} />
      </Tarjeta>
    </View>
  );
}

const estilos = StyleSheet.create({
  visor: { height: 320, borderRadius: radio.xl, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mira: { width: 210, height: 210, borderWidth: 3, borderColor: '#C8102E', borderRadius: 18 },
  sinPermiso: { alignItems: 'center', padding: espacio.xl },
  textoClaro: { color: '#ffffff', textAlign: 'center', marginTop: espacio.m },
});
