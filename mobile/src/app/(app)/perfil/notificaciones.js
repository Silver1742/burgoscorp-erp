// Avisos del usuario (licencias aprobadas, pedidos para aprobar...). Al abrir se marcan como leídos.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Cargando, Tarjeta, Texto, Vacio } from '../../../componentes/ui';
import { api } from '../../../lib/api';
import { espacio, useTema } from '../../../tema';

const ICONO = { licencia_aprobada: 'checkmark-circle-outline', licencia_rechazada: 'close-circle-outline', licencia_pendiente: 'hourglass-outline' };
const DESTINO = { licencia_pendiente: '/modulos/rrhh/aprobaciones', licencia_aprobada: '/modulos/rrhh/licencias', licencia_rechazada: '/modulos/rrhh/licencias' };

export default function Notificaciones() {
  const t = useTema();
  const router = useRouter();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await api('/notificaciones');
      setLista(r.data);
      if (r.meta.sinLeer) await api('/notificaciones/leidas', { metodo: 'POST' });
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <FlatList
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={{ padding: espacio.l, maxWidth: 640, width: '100%', alignSelf: 'center', flexGrow: 1 }}
      data={lista ?? []}
      keyExtractor={(n) => String(n.id)}
      ListHeaderComponent={<Aviso onReintentar={cargar}>{error}</Aviso>}
      ListEmptyComponent={lista === null && !error ? <Cargando /> : !error ? <Vacio icono="notifications-off-outline" titulo="No tenés avisos" /> : null}
      renderItem={({ item: n }) => (
        <Tarjeta onPress={DESTINO[n.tipo] ? () => router.push(DESTINO[n.tipo], { withAnchor: true }) : undefined}>
          <View style={{ flexDirection: 'row' }}>
            <Ionicons name={ICONO[n.tipo] ?? 'notifications-outline'} size={22} color={n.leida_at ? t.textoSuave : t.acento} />
            <View style={{ flex: 1, marginLeft: espacio.m }}>
              <Texto estilo={{ fontWeight: n.leida_at ? '400' : '700' }}>{n.titulo}</Texto>
              {n.mensaje ? <Texto suave estilo={{ fontSize: 13, marginTop: 2 }}>{n.mensaje}</Texto> : null}
              <Texto suave estilo={{ fontSize: 12, marginTop: espacio.xs }}>{new Date(n.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })}</Texto>
            </View>
          </View>
        </Tarjeta>
      )}
    />
  );
}
