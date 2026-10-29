// Avisos del usuario (licencias aprobadas, pedidos para aprobar...). Al abrir se marcan como leídos.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, FilaLista, EsqueletoLista, ErrorCarga, Vacio, Insignia } from '../../../componentes/ui';
import { api } from '../../../lib/api';
import { espacio, useTema } from '../../../tema';

const ICONO = {
  licencia_aprobada: ['checkmark-circle', 'exito'],
  licencia_rechazada: ['close-circle', 'error'],
  licencia_pendiente: ['hourglass', 'aviso'],
  tarea_asignada: ['construct', 'gris'],
  tarea_en_revision: ['eye', 'aviso'],
  tarea_aprobada: ['checkmark-circle', 'exito'],
  tarea_rechazada: ['refresh-circle', 'error'],
  tarea_cancelada: ['close-circle', 'gris'],
  material_faltante: ['cube', 'error'],
  material_recibido: ['cube', 'exito'],
  oc_para_aprobar: ['cart', 'aviso'],
  oc_aprobada: ['cart', 'exito'],
  oc_rechazada: ['cart', 'error'],
  falla_maquina: ['warning', 'error'],
  om_asignada: ['build', 'aviso'],
  om_cerrada: ['build', 'exito'],
  solicitud_asignada: ['briefcase', 'aviso'],
  ot_nueva: ['clipboard', 'gris'],
  no_conformidad: ['alert-circle', 'error'],
  ot_terminada: ['ribbon', 'exito'],
  cuenta_pendiente: ['person-add', 'aviso'],
};
// A dónde lleva cada aviso al tocarlo.
const DESTINO = {
  licencia_pendiente: () => '/modulos/rrhh/aprobaciones',
  licencia_aprobada: () => '/modulos/rrhh/licencias',
  licencia_rechazada: () => '/modulos/rrhh/licencias',
  tarea_asignada: (n) => `/tareas/${n.entidad_id}`,
  tarea_aprobada: (n) => `/tareas/${n.entidad_id}`,
  tarea_rechazada: (n) => `/tareas/${n.entidad_id}`,
  tarea_cancelada: (n) => `/tareas/${n.entidad_id}`,
  tarea_en_revision: (n) => `/modulos/tareas/${n.entidad_id}`,
  material_faltante: (n) => (n.entidad === 'orden_trabajo' ? `/modulos/produccion/${n.entidad_id}` : `/modulos/inventario/${n.entidad_id}`),
  material_recibido: (n) => (n.entidad === 'orden_trabajo' ? `/modulos/produccion/${n.entidad_id}` : `/modulos/compras/${n.entidad_id}`),
  oc_para_aprobar: (n) => `/modulos/compras/${n.entidad_id}`,
  oc_aprobada: (n) => `/modulos/compras/${n.entidad_id}`,
  oc_rechazada: (n) => `/modulos/compras/${n.entidad_id}`,
  falla_maquina: (n) => `/modulos/mantenimiento/${n.entidad_id}`,
  om_asignada: (n) => `/modulos/mantenimiento/${n.entidad_id}`,
  om_cerrada: (n) => `/modulos/mantenimiento/${n.entidad_id}`,
  solicitud_asignada: (n) => `/modulos/ventas/solicitud/${n.entidad_id}`,
  ot_nueva: (n) => `/modulos/produccion/${n.entidad_id}`,
  no_conformidad: (n) => `/tareas/${n.entidad_id}`,
  ot_terminada: (n) => `/modulos/produccion/${n.entidad_id}`,
  cuenta_pendiente: () => '/modulos/usuarios/solicitudes',
};

export default function Notificaciones() {
  const t = useTema();
  const router = useRouter();
  const [lista, setLista] = useState(null);
  const [sinLeer, setSinLeer] = useState(0);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await api('/notificaciones');
      setLista(r.data);
      setSinLeer(r.meta.sinLeer);
      if (r.meta.sinLeer) await api('/notificaciones/leidas', { metodo: 'POST' });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const colores = { exito: t.exito, error: t.error, aviso: t.avisoTexto };

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Avisos" icono="notifications" sub="Novedades sobre tus solicitudes y lo que tenés que aprobar."
        acciones={sinLeer ? <Insignia texto={`${sinLeer} nuevos`} tono="rojo" /> : null} />
      <Tarjeta sinRelleno>
        {error ? <ErrorCarga error={error} onReintentar={cargar} /> : null}
        {lista === null && !error ? <View style={{ padding: espacio.m }}><EsqueletoLista filas={3} /></View> : null}
        {lista?.length === 0 ? <Vacio icono="notifications-off-outline" titulo="No tenés avisos" /> : null}
        {lista?.map((n, i) => {
          const [icono, tono] = ICONO[n.tipo] ?? ['notifications', 'gris'];
          return (
            <FilaLista key={n.id} ultima={i === lista.length - 1}
              onPress={DESTINO[n.tipo] ? () => router.push(DESTINO[n.tipo](n), { withAnchor: true }) : undefined}>
              <Ionicons name={icono} size={22} color={colores[tono] ?? t.textoSuave} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: n.leida_at ? '400' : '600' }}>{n.titulo}</Text>
                {n.mensaje ? <Text style={{ color: t.textoSuave, fontSize: 13, marginTop: 2 }}>{n.mensaje}</Text> : null}
                <Text style={{ color: t.textoTenue, fontSize: 12, marginTop: espacio.xs }}>
                  {new Date(n.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })}
                </Text>
              </View>
              {!n.leida_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primario }} /> : null}
            </FilaLista>
          );
        })}
      </Tarjeta>
    </Pantalla>
  );
}
