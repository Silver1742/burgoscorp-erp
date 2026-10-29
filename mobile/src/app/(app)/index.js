// Inicio (como el DashboardPage de R3): saludo, rol, tarjetas con contador, fichaje y avisos.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EncabezadoPagina, Tarjeta, FilaLista, Texto, InsigniaRol, Insignia, IconoEstadistica,
  Esqueleto, ErrorCarga, Vacio, Boton,
} from '../../componentes/ui';
import Fichaje from '../../componentes/Fichaje';
import { usePuede, useSesion } from '../../contexto/sesion';
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

/** "Buen día" hasta las 13, "Buenas tardes" hasta las 20 y después "Buenas noches". */
function saludo() {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return 'Buen día';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Botón grande de "¿Qué querés hacer?". */
function Atajo({ icono, texto, onPress }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={texto}
      style={({ pressed }) => [estilos.atajo, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: t.borde }]}>
      <View style={[estilos.atajoIcono, { backgroundColor: t.rojoSuave }]}>
        <Ionicons name={icono.replace('-outline', '')} size={24} color={t.primario} />
      </View>
      <Text style={[estilos.atajoTexto, { color: t.texto }]} numberOfLines={2}>{texto}</Text>
    </Pressable>
  );
}

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
  const [pendientes, setPendientes] = useState(0);
  const puede = usePuede();

  // "¿Qué querés hacer?": las acciones marcadas como rápidas en los módulos que el rol puede ver.
  // Para el administrador, lo primero es Usuarios.
  const atajos = [];
  const ordenados = usuario.rol === 'ADMIN' ? [...MODULOS].sort((a, b) => (b.codigo === 'SEG') - (a.codigo === 'SEG')) : MODULOS;
  for (const m of ordenados) {
    if (!permisos[m.codigo]?.ver) continue;
    for (const a of m.acciones ?? []) {
      if (!a.rapido || (a.visible && !a.visible({ usuario, puede }))) continue;
      if (!atajos.some((x) => x.ruta === a.ruta(usuario))) atajos.push({ texto: a.rapido, icono: a.icono, ruta: a.ruta(usuario) });
    }
  }

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
      if (puede('SEG', 'aprobar')) {
        setPendientes((await api('/usuarios', { consulta: { estado: 'pendientes', limite: 1 } })).meta.total);
      }
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveAccesos]);

  useEffect(() => { cargar(); }, [cargar]);

  const columna = columnas >= 3 ? { flex: 1 } : null; // ver comentario en el legajo
  const porFila = Math.min(columnas, 4) >= 4 ? 4 : 2;
  const nombre = `${usuario.nombre} ${usuario.apellido}`;

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        <EncabezadoPagina titulo={`${saludo()}, ${usuario.nombre}`} sub={DESCRIPCION_ROL[usuario.rol]} />
        <View style={[estilos.fila, { marginTop: -espacio.m, marginBottom: espacio.xl }]}>
          <InsigniaRol rol={usuario.rol} />
          {usuario.area ? <Insignia texto={usuario.area.nombre} icono="business-outline" /> : <Insignia texto="Sin área asignada" tono="aviso" />}
        </View>

        {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}

        {pendientes > 0 ? (
          <Tarjeta onPress={() => router.push('/modulos/usuarios/solicitudes', { withAnchor: true })} acentoArriba>
            <View style={estilos.fila}>
              <IconoEstadistica icono="person-add" tono="aviso" />
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={{ color: t.texto, fontWeight: '700', fontSize: 16 }}>
                  {pendientes === 1 ? 'Hay 1 persona esperando acceso' : `Hay ${pendientes} personas esperando acceso`}
                </Text>
                <Text style={{ color: t.textoSuave }}>Tocá para revisar y habilitar las solicitudes.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.textoTenue} />
            </View>
          </Tarjeta>
        ) : null}

        {atajos.length ? (
          <>
            <Text style={[estilos.seccion, { color: t.textoSuave }]}>¿QUÉ QUERÉS HACER?</Text>
            <View style={[estilos.grilla, { marginBottom: espacio.l }]}>
              {atajos.slice(0, 8).map((a) => (
                <View key={a.ruta} style={{ width: `${100 / (columnas >= 3 ? 4 : 2)}%`, padding: espacio.xs }}>
                  <Atajo icono={a.icono} texto={a.texto} onPress={() => router.push(a.ruta, { withAnchor: true })} />
                </View>
              ))}
            </View>
          </>
        ) : !usuario.empleadoId && usuario.rol !== 'ADMIN' ? (
          <Tarjeta titulo="Tu cuenta todavía no tiene legajo" icono="information-circle-outline">
            <Texto suave>Pedile a un administrador que vincule tu cuenta con tu legajo para ver los módulos de tu área.</Texto>
          </Tarjeta>
        ) : null}

        <Text style={[estilos.seccion, { color: t.textoSuave }]}>RESUMEN</Text>

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
          <View style={columna}>
            {usuario.empleadoId ? <Fichaje /> : null}
            {!usuario.dosPasosActivo ? (
              <Tarjeta titulo="Protegé tu cuenta" icono="shield-checkmark-outline">
                <Texto suave estilo={{ marginBottom: espacio.m }}>Activá la verificación en dos pasos con Google Authenticator o un código por email.</Texto>
                <Boton titulo="Activar ahora" variante="oscuro" chico icono="shield-checkmark" estilo={{ alignSelf: 'flex-start' }}
                  onPress={() => router.push('/perfil/dos-pasos', { withAnchor: true })} />
              </Tarjeta>
            ) : null}
            <Tarjeta onPress={() => router.push('/perfil/ayuda', { withAnchor: true })}>
              <View style={estilos.fila}>
                <IconoEstadistica icono="help-circle" tono="gris" />
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={{ color: t.texto, fontWeight: '600' }}>¿Cómo se usa?</Text>
                  <Text style={{ color: t.textoSuave, fontSize: 13 }}>Guía rápida paso a paso para tu rol.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
              </View>
            </Tarjeta>
          </View>

          <View style={columna}>
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
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: espacio.s, marginLeft: espacio.xs },
  atajo: { borderWidth: 1, borderRadius: 10, padding: espacio.m, minHeight: 104, justifyContent: 'space-between', gap: espacio.s },
  atajoIcono: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  atajoTexto: { fontSize: 15, fontWeight: '600' },
});
