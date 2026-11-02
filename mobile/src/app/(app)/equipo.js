// Pestaña "Mi equipo" (jefe) o "Áreas" (gerencia y administración).
//  - El jefe ve directamente a la gente de su área.
//  - Gerencia y el administrador ven todas las áreas con su jefe y cuántos son; tocando una, sus
//    integrantes con el detalle de cada uno.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import IntegrantesArea from '../../componentes/IntegrantesArea';
import { ErrorCarga, EsqueletoLista, Tarjeta, Vacio } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { espacio, radio, useTema } from '../../tema';

function ListaAreas() {
  const t = useTema();
  const router = useRouter();
  const { usuario } = useSesion();
  const color = perfilRol(usuario.rol).color;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await api('/personal/resumen')); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

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
          <Pressable key={a.id} onPress={() => router.push(`/modulos/rrhh/area/${a.id}`, { withAnchor: true })} accessibilityRole="button"
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
  area: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderLeftWidth: 4, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
});
