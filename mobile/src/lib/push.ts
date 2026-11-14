// Notificaciones en el teléfono (push): una tarea asignada, una tarea para asignar o un aviso nuevo
// del tablón llegan aunque la app esté cerrada.
//
//   registrarTelefono()   al iniciar sesión: pide permiso, obtiene el token de Expo y se lo da a la API
//   olvidarTelefono()     al cerrar sesión: ese teléfono deja de recibir avisos de esa cuenta
//   destinoDeAviso(datos) a qué pantalla lleva tocar la notificación
//
// En la web no hace nada (las notificaciones son del APK). El token no es secreto pero se guarda
// solo en memoria; la API valida su formato y que haya sesión.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

let tokenActual: string | null = null;
const esTelefono = Platform.OS === 'android' || Platform.OS === 'ios';

// Con la app abierta, la notificación igual se muestra arriba (y suena).
if (esTelefono) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

/** Pide permiso y registra este teléfono para la cuenta que acaba de entrar. Nunca rompe el ingreso. */
export async function registrarTelefono(): Promise<void> {
  if (!esTelefono || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('avisos', {
        name: 'Tareas y avisos',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C8102E',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return; // la persona no quiso: la app sigue igual, con la campanita
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    tokenActual = data;
    await api('/dispositivos', { metodo: 'POST', cuerpo: { token: data, plataforma: Platform.OS } });
  } catch (err) {
    console.warn('No se pudo activar las notificaciones:', (err as Error).message);
  }
}

/** Al cerrar sesión (con el token de acceso todavía válido). */
export async function olvidarTelefono(): Promise<void> {
  if (!tokenActual) return;
  const token = tokenActual;
  tokenActual = null;
  try {
    await api('/dispositivos', { metodo: 'DELETE', cuerpo: { token } });
  } catch {
    // Sin conexión: la API lo borra sola la próxima vez que Expo diga que el teléfono no existe.
  }
}

/** A qué pantalla lleva tocar la notificación. */
export function destinoDeAviso(datos: { tipo?: string; entidad?: string; entidadId?: number } | undefined): string | null {
  if (!datos?.entidadId && datos?.entidad !== 'aviso') return null;
  if (datos.tipo === 'tarea_asignada') return `/tareas/${datos.entidadId}`;
  if (datos.tipo === 'tarea_para_asignar') return `/modulos/tareas/${datos.entidadId}`;
  if (datos.tipo === 'aviso_tablon') return '/'; // el tablón está en Inicio
  return null;
}

/**
 * Se monta una vez con la sesión iniciada: registra el teléfono y, al tocar una notificación
 * (con la app abierta, en segundo plano o cerrada), abre la pantalla que corresponde.
 */
export function useNotificacionesTelefono(abrir: (ruta: string) => void): void {
  useEffect(() => {
    if (!esTelefono) return undefined;
    registrarTelefono();
    const ir = (r: Notifications.NotificationResponse | null) => {
      const ruta = destinoDeAviso(r?.notification.request.content.data as Parameters<typeof destinoDeAviso>[0]);
      if (ruta) abrir(ruta);
    };
    // La app estaba cerrada y se abrió tocando la notificación.
    const ultima = Notifications.getLastNotificationResponse();
    if (ultima) {
      ir(ultima);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(ir);
    return () => sub.remove();
  }, [abrir]);
}
