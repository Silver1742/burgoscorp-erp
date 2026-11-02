// /qr?c=BC:MAQ:CNC-02 · a donde lleva una etiqueta QR escaneada con la cámara común del teléfono.
// Con sesión abre directo lo escaneado; sin sesión pide entrar y después lo abre.
import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pantalla, Cargando } from '../componentes/ui';
import { destinoEscaneo } from '../componentes/Escaner';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { codigoDeQR, guardarQrPendiente } from '../lib/qr';

export default function AbrirQr() {
  const { c } = useLocalSearchParams();
  const { usuario } = useSesion();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const codigo = codigoDeQR(typeof c === 'string' ? c : '');
    if (!codigo) {
      toast.error('Ese código no es de BurgosCorp.');
      router.replace('/');
      return;
    }
    if (!usuario?.emailVerificado) {
      guardarQrPendiente(codigo);
      toast.info('Iniciá sesión y abrimos lo que escaneaste.');
      router.replace('/');
      return;
    }
    api('/escaneo', { consulta: { codigo } })
      .then((r) => router.replace(destinoEscaneo(r) ?? '/'))
      .catch((err) => { toast.error(err.message); router.replace('/'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Pantalla><Cargando texto="Abriendo lo que escaneaste…" /></Pantalla>;
}
