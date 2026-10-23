// Inicio (como el DashboardPage de R3): saludo, rol, tarjetas con contador, fichaje y avisos.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EncabezadoPagina, Tarjeta, FilaLista, Texto, InsigniaRol, Insignia, IconoEstadistica,
  Esqueleto, ErrorCarga, Vacio, Boton,
} from '../../componentes/ui';
import Fichaje from '../../componentes/Fichaje';
import { useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import useContador from '../../lib/useContador';
import { MODULOS } from '../../modulos';
import { espacio, useTema, usePantalla } from '../../tema';

const DESCRIPCION_ROL = {
  ADMIN: 'Tenés acceso completo, incluida la administración de usuarios.',
  GERENCIA: 'Podés consultar todos los módulos de la empresa.',
  JEFE: 'Gestionás los módulos de tu área y las tareas de tu equipo.',
  EMPLEADO: 'Tus tareas, tu fichaje y tus solicitudes.',
};
const TONOS = ['rojo', 'gris', 'exito', 'aviso'];

function TarjetaEstadistica({ icono, etiqueta, valor, tono, onPress }) {
  const t = useTema();
  const mostrado = useContador(valor);
  return (
    <Tarjeta onPress={onPress} estilo={{ marginBottom: 0, flex: 1 }}>
      <IconoEstadistica icono={icono} tono={tono} />
      <Text style={[estilos.numero, { color: t.texto }]} accessibilityLiveRegion="polite">{mostrado ?? '—'}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }}>{etiqueta}</Text>
    </Tarjeta>
  );
}

const hace = (fecha) => {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

export default function Inicio() {
  const { usuario, permisos } = useSesion();
  const router = useRouter();
  const t = useTema();
  const { columnas } = usePantalla();
  const [resumen, setResumen] = useState(null);
  const [avisos, setAvisos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  // Hasta 4 recursos visibles para el rol, con su total de registros.
  const accesos = MODULOS.filter((m) => permisos[m.codigo]?.ver)
    .flatMap((m) => m.recursos.slice(0, 1).map((r) => ({ modulo: m, recurso: r })))
    .slice(0, 4);
  const claveAccesos = accesos.map((a) => a.recurso.ruta).join(',');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [datos, notif] = await Promise.all([
        Promise.all(accesos.map(async (a) => ({ ...a, total: (await api(`/${a.recurso.ruta}`, { consulta: { limite: 1 } })).meta.total }))),
        api('/notificaciones'),
      ]);
      setResumen(datos);
      setAvisos(notif);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveAccesos]);

  useEffect(() => { cargar(); }, [cargar]);

  const porFila = Math.min(columnas, 4) >= 4 ? 4 : 2;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        <EncabezadoPagina titulo={`Hola, ${usuario.nombre}`} sub={DESCRIPCION_ROL[usuario.rol]} />
        <View style={[estilos.fila, { marginTop: -espacio.m, marginBottom: espacio.xl }]}>
          <InsigniaRol rol={usuario.rol} />
          {usuario.area ? <Insignia texto={usuario.area.nombre} icono="business-outline" /> : <Insignia texto="Sin área asignada" tono="aviso" />}
        </View>

        {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}

        {/* Tarjetas con contador */}
        <View style={estilos.grilla}>
          {(resumen ?? accesos).map((a, i) => (
            <View key={a.recurso.ruta} style={{ width: `${100 / porFila}%`, padding: espacio.xs }}>
              {resumen ? (
                <TarjetaEstadistica icono={a.modulo.icono.replace('-outline', '')} etiqueta={a.recurso.titulo} valor={a.total} tono={TONOS[i % TONOS.length]}
                  onPress={() => router.push(`/modulos/${a.modulo.codigo}/${a.recurso.ruta}`, { withAnchor: true })} />
              ) : (
                <Tarjeta estilo={{ marginBottom: 0 }}>
                  <Esqueleto ancho={40} alto={40} />
                  <Esqueleto ancho="50%" alto={24} estilo={{ marginTop: 10 }} />
                  <Esqueleto ancho="80%" alto={12} estilo={{ marginTop: 8 }} />
                </Tarjeta>
              )}
            </View>
          ))}
        </View>

        <View style={[estilos.dosColumnas, columnas >= 3 && { flexDirection: 'row' }]}>
          <View style={{ flex: 1 }}>
            {usuario.empleadoId ? <Fichaje /> : null}
            {!usuario.dosPasosActivo ? (
              <Tarjeta titulo="Protegé tu cuenta" icono="shield-checkmark-outline">
                <Texto suave estilo={{ marginBottom: espacio.m }}>Activá la verificación en dos pasos con Google Authenticator o un código por email.</Texto>
                <Boton titulo="Activar ahora" variante="oscuro" chico icono="shield-checkmark" estilo={{ alignSelf: 'flex-start' }}
                  onPress={() => router.push('/perfil/dos-pasos', { withAnchor: true })} />
              </Tarjeta>
            ) : null}
          </View>

          <View style={{ flex: 1 }}>
            <Tarjeta titulo="Avisos recientes" icono="notifications-outline" sinRelleno
              derecha={avisos?.meta.sinLeer ? <Insignia texto={`${avisos.meta.sinLeer} nuevos`} tono="rojo" /> : null}>
              {avisos === null ? (
                <View style={{ padding: espacio.l, gap: 10 }}><Esqueleto ancho="70%" /><Esqueleto ancho="50%" /></View>
              ) : avisos.data.length === 0 ? (
                <Vacio icono="notifications-off-outline" titulo="No tenés avisos" />
              ) : (
                <>
                  {avisos.data.slice(0, 4).map((n, i, arr) => (
                    <FilaLista key={n.id} ultima={i === arr.length - 1} onPress={() => router.push('/perfil/notificaciones', { withAnchor: true })}>
                      <Ionicons name="ellipse" size={8} color={n.leida_at ? 'transparent' : t.primario} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.texto, fontWeight: n.leida_at ? '400' : '600' }} numberOfLines={1}>{n.titulo}</Text>
                        <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{n.mensaje ? `${n.mensaje} · ` : ''}{hace(n.created_at)}</Text>
                      </View>
                    </FilaLista>
                  ))}
                </>
              )}
            </Tarjeta>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 1140, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs, marginBottom: espacio.l },
  numero: { fontSize: 28, fontWeight: '600', marginTop: espacio.s },
  dosColumnas: { gap: espacio.m },
});
