// /oauth · a donde vuelven Google, GitHub y Discord después de que la persona acepta.
//  - Si el ingreso lo empezó el APK (state "a.…"), esta página se abrió en el navegador del
//    teléfono: le pasa la respuesta a la app por burgoscorp://oauth y no hace nada más.
//  - Si lo empezó la versión web, termina el ingreso acá con la API.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, Cargando, Boton } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { VUELTA_APP, leerRespuesta, tomarPedido, datosParaApi } from '../lib/social';

export default function VueltaOauth() {
  const router = useRouter();
  const toast = useToast();
  const { loginSocial } = useSesion();
  const [paraLaApp, setParaLaApp] = useState(null);

  useEffect(() => {
    // En el celular la respuesta la recibe openAuthSessionAsync: esta pantalla solo se cierra.
    if (Platform.OS !== 'web') { router.replace('/'); return; }
    const { href, search, hash } = globalThis.location;
    const r = leerRespuesta(href);
    // Limpia la barra de direcciones: el token no tiene que quedar en el historial.
    globalThis.history.replaceState(null, '', '/oauth');

    if (r.state?.startsWith('a.')) {
      const destino = `${VUELTA_APP}${search}${hash}`;
      setParaLaApp(destino);
      globalThis.location.replace(destino);
      return;
    }
    (async () => {
      try {
        const pedido = tomarPedido();
        await loginSocial(pedido?.proveedor, datosParaApi(pedido, r));
        router.replace('/');
      } catch (err) {
        // Primera vez con una red social: la cuenta queda pendiente hasta que la habilita un admin.
        if (['CUENTA_PENDIENTE', 'CUENTA_RECHAZADA'].includes(err.codigo) || err.status === 423) toast.aviso(err.message, { duracion: 8000 });
        else toast.error(err.message);
        router.replace('/login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (paraLaApp) {
    return (
      <Pantalla>
        <Cargando texto="Volviendo a la app de BurgosCorp…" />
        <Boton titulo="Abrir la app" icono="open-outline" onPress={() => globalThis.location.replace(paraLaApp)} />
      </Pantalla>
    );
  }
  return <Pantalla><Cargando texto="Terminando de ingresar…" /></Pantalla>;
}
