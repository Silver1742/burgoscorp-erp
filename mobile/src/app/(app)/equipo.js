// Pestaña "Mi equipo" (jefe) o "Áreas" (gerencia y administración).
//  - El jefe ve directamente a la gente de su área.
//  - Gerencia y el administrador ven todas las áreas con su jefe y cuántos son; tocando una, sus
//    integrantes con el detalle de cada uno.
import { useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import IntegrantesArea from '../../componentes/IntegrantesArea';
import { ErrorCarga, EsqueletoLista, Tarjeta, Vacio } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { espacio, radio, sombra, useTema, usePantalla } from '../../tema';
import { useCargar } from '../../lib/cambios';

function ListaAreas() {
  const t = useTema();
  const router = useRouter();
  const { usuario } = useSesion();
  const color = perfilRol(usuario.rol).color;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const [abierta, setAbierta] = useState(null); // área cuya ventana está abierta
  const { esAncho } = usePantalla();

  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await api('/personal/resumen')); } catch (err) { setError(err.message); }
  }, []);
  useCargar(cargar);

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        <Text style={{ color: t.texto, fontSize: 22, fontWeight: '700' }}>Áreas de la empresa</Text>
        <Text style={{ color: t.textoSuave, marginBottom: espacio.l }}>
          {datos ? `${datos.totales.personal} personas · ${datos.totales.vinieron_hoy} vinieron hoy · ${datos.totales.en_licencia} de licencia` : 'Tocá un área para ver a su gente.'}
        </Text>
        {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
        {!datos && !error ? <EsqueletoLista filas={6} /> : null}
        {datos?.areas.map((a) => (
          <Pressable key={a.id} onPress={() => setAbierta(a)} accessibilityRole="button"
            accessibilityLabel={`${a.nombre}, ${a.total} personas`}
            style={({ pressed }) => [estilos.area, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: t.borde, borderLeftColor: color }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontSize: 16, fontWeight: '700' }}>{a.nombre}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>{a.jefe_nombre ? `Jefe: ${a.jefe_nombre}` : 'Sin jefe'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.texto, fontSize: 18, fontWeight: '700' }}>{a.total}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 12 }}>{a.vinieron_hoy} hoy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
          </Pressable>
        ))}
        {datos?.cuentas_sin_area?.length ? (
          <Tarjeta titulo={`${datos.cuentas_sin_area.length} ${datos.cuentas_sin_area.length === 1 ? 'cuenta sin área' : 'cuentas sin área'}`} icono="alert-circle-outline">
            {datos.cuentas_sin_area.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/modulos/usuarios/${c.id}`, { withAnchor: true })} accessibilityRole="button" style={{ paddingVertical: 6 }}>
                <Text style={{ color: t.primario }}>{c.apellido}, {c.nombre} · asignarle área →</Text>
              </Pressable>
            ))}
          </Tarjeta>
        ) : null}
      </View>

      {/* Ventana del área (como el AreaDetailModal de R3): integrantes y su ficha, sin salir de la lista. */}
      <Modal visible={Boolean(abierta)} transparent animationType={esAncho ? 'fade' : 'slide'} onRequestClose={() => setAbierta(null)}>
        <View style={[estilos.fondo, esAncho && { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[estilos.ventana, sombra, { backgroundColor: t.fondo, borderColor: t.borde }, esAncho ? estilos.ventanaAncha : estilos.ventanaCelular]}>
            <View style={[estilos.barra, { borderBottomColor: t.borde }]}>
              <Text style={{ color: t.textoSuave, fontSize: 13, flex: 1 }}>Integrantes del área · tocá a alguien para ver su ficha</Text>
              <Pressable onPress={() => { setAbierta(null); cargar(); }} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
                <Ionicons name="close" size={24} color={t.textoSuave} />
              </Pressable>
            </View>
            {abierta ? <IntegrantesArea areaId={abierta.id} /> : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function Equipo() {
  const { usuario } = useSesion();
  if (usuario.rol === 'JEFE') {
    return usuario.area ? <IntegrantesArea areaId={usuario.area.id} />
      : <Vacio icono="people-outline" titulo="Tu cuenta no tiene área" texto="Pedile a un administrador que te asigne el área a cargo." />;
  }
  return <ListaAreas />;
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  ventana: { borderWidth: 1, overflow: 'hidden' },
  ventanaCelular: { height: '92%', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  ventanaAncha: { width: '92%', maxWidth: 860, height: '88%', borderRadius: 14 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.l, paddingVertical: espacio.m, borderBottomWidth: 1 },
  area: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderLeftWidth: 4, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
});
