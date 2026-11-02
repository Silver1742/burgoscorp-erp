// Inicio: distinto para cada rol, con la identidad de BurgosCorp arriba (degradado, chispas y sombra
// roja) y solo lo que ese rol usa todos los días.
//   Empleado      → tablón de avisos, fichaje, sus tareas abiertas y sus accesos.
//   Jefe de área  → pendientes (asignar, revisar, licencias), tablón, fichaje y accesos.
//   Gerencia      → cómo viene la empresa (OT, pedidos, personal), tablón y accesos.
//   Administrador → pendientes (accesos, tareas sin jefe…), tablón y accesos.
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, FilaLista, Insignia, Boton } from '../../componentes/ui';
import Fichaje from '../../componentes/Fichaje';
import Tablon from '../../componentes/Tablon';
import Pendientes from '../../componentes/Pendientes';
import { BloqueImponente } from '../../componentes/Imponente';
import { usePuede, useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { ESTADO_TAREA } from '../../modulos';
import { espacio, radio, useTema, usePantalla } from '../../tema';
import { useCargar } from '../../lib/cambios';
import { ScrollConArriba } from '../../componentes/Desplazable';

/** "Buen día" hasta las 13, "Buenas tardes" hasta las 20 y después "Buenas noches". */
function saludo() {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return 'Buen día';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const total = (r) => r?.meta?.total ?? r?.data?.length ?? 0;
const sinError = (p) => p.catch(() => null);

/** Accesos de cada rol (solo los que su permiso habilita). */
function accesosDe(usuario, puede) {
  const a = {
    EMPLEADO: [
      { texto: 'Mis tareas', icono: 'checkbox', ruta: '/tareas', si: Boolean(usuario.empleadoId) },
      { texto: 'Pedir licencia', icono: 'airplane', ruta: '/modulos/rrhh/licencias', si: Boolean(usuario.empleadoId) },
      { texto: 'Escanear QR', icono: 'qr-code', ruta: '/modulos/escanear', si: true },
      { texto: 'Reportar falla', icono: 'warning', ruta: '/modulos/mantenimiento/nueva', si: puede('MANT', 'crear') },
    ],
    JEFE: [
      { texto: 'Nueva tarea', icono: 'add-circle', ruta: '/modulos/tareas/nueva', si: puede('TAR', 'crear') },
      { texto: 'Mis tareas', icono: 'checkbox', ruta: '/tareas', si: Boolean(usuario.empleadoId) },
      { texto: 'Pedir licencia', icono: 'airplane', ruta: '/modulos/rrhh/licencias', si: Boolean(usuario.empleadoId) },
      { texto: 'Escanear QR', icono: 'qr-code', ruta: '/modulos/escanear', si: true },
    ],
    GERENCIA: [
      { texto: 'Ventas', icono: 'briefcase', ruta: '/modulos/ventas', si: puede('VEN', 'ver') },
      { texto: 'Producción', icono: 'construct', ruta: '/modulos/produccion', si: puede('PROD', 'ver') },
      { texto: 'Sueldos', icono: 'wallet', ruta: '/modulos/finanzas/liquidacion', si: puede('FIN', 'ver') },
      { texto: 'Compras', icono: 'cart', ruta: '/modulos/compras', si: puede('COM', 'ver') },
    ],
    ADMIN: [
      { texto: 'Nuevo usuario', icono: 'person-add', ruta: '/modulos/usuarios/nuevo', si: puede('SEG', 'crear') },
      { texto: 'Nueva tarea', icono: 'add-circle', ruta: '/modulos/tareas/nueva', si: puede('TAR', 'crear') },
      { texto: 'Sueldos', icono: 'wallet', ruta: '/modulos/finanzas/liquidacion', si: puede('FIN', 'ver') },
      { texto: 'Tablero', icono: 'stats-chart', ruta: '/tablero', si: puede('TAB', 'ver') },
    ],
  }[usuario.rol] ?? [];
  return a.filter((x) => x.si);
}

function Acceso({ a, color, suave, onPress }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a.texto}
      style={({ pressed }) => [estilos.acceso, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: t.borde }]}>
      <View style={[estilos.accesoIcono, { backgroundColor: suave }]}>
        <Ionicons name={a.icono} size={22} color={color} />
      </View>
      <Text style={{ color: t.texto, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={2}>{a.texto}</Text>
    </Pressable>
  );
}

/** Números que se ven en el encabezado (sobre el fondo oscuro). */
function Dato({ valor, etiqueta, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor}`} style={estilos.dato}>
      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800' }}>{valor}</Text>
      <Text style={{ color: '#d4d4d8', fontSize: 12 }} numberOfLines={2}>{etiqueta}</Text>
    </Pressable>
  );
}

export default function Inicio() {
  const { usuario } = useSesion();
  const puede = usePuede();
  const router = useRouter();
  const t = useTema();
  const { columnas } = usePantalla();
  const r = perfilRol(usuario.rol);
  const [datos, setDatos] = useState([]);
  const [tareas, setTareas] = useState(null);
  const [sinLeer, setSinLeer] = useState(0);
  const [recargando, setRecargando] = useState(false);
  const [vuelta, setVuelta] = useState(0); // para que tablón y pendientes recarguen al deslizar
  const conTareas = Boolean(usuario.empleadoId) && ['EMPLEADO', 'JEFE'].includes(usuario.rol);
  const conPendientes = ['JEFE', 'ADMIN'].includes(usuario.rol);

  const cargar = useCallback(async () => {
    const [p, ot, ped, mias, notif] = await Promise.all([
      usuario.rol !== 'EMPLEADO' ? sinError(api('/personal/resumen')) : null,
      usuario.rol === 'GERENCIA' && puede('PROD', 'ver') ? sinError(api('/ordenes-trabajo', { consulta: { abiertas: 1, limite: 1 } })) : null,
      usuario.rol === 'GERENCIA' && puede('VEN', 'ver') ? sinError(api('/solicitudes', { consulta: { abiertas: 1, limite: 1 } })) : null,
      conTareas ? sinError(api('/tareas', { consulta: { mias: 1, abiertas: 1, limite: 3 } })) : null,
      sinError(api('/notificaciones')),
    ]);
    const d = [];
    if (p) d.push({ valor: `${p.totales.vinieron_hoy}/${p.totales.personal}`, etiqueta: usuario.rol === 'JEFE' ? 'De tu equipo vinieron hoy' : 'Vinieron hoy', ruta: '/equipo' });
    if (ot) d.push({ valor: total(ot), etiqueta: 'Órdenes de trabajo abiertas', ruta: '/modulos/produccion' });
    if (ped) d.push({ valor: total(ped), etiqueta: 'Pedidos de clientes abiertos', ruta: '/modulos/ventas' });
    setDatos(d);
    setTareas(mias);
    setSinLeer(notif?.meta?.sinLeer ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, usuario.rol]);
  useCargar(cargar);

  const ir = (ruta) => router.push(ruta, { withAnchor: true });
  const accesos = accesosDe(usuario, puede);
  const dosColumnas = columnas >= 3;

  return (
    <ScrollConArriba style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setVuelta((v) => v + 1); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        {/* Encabezado imponente: degradado, chispas y sombra roja */}
        <BloqueImponente estilo={estilos.hero} alto={240}>
          <View style={{ padding: espacio.l, gap: espacio.m }}>
            <View style={estilos.linea}>
              <View style={[estilos.rolIcono, { backgroundColor: r.color }]}>
                <Ionicons name={r.icono} size={20} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estilos.saludo}>{saludo()}, {usuario.nombre}</Text>
                <Text style={{ color: '#e4e4e7' }}>
                  {r.panel} · {r.titulo}{usuario.rol !== 'ADMIN' && usuario.area ? ` · ${usuario.area.nombre}` : ''}
                </Text>
              </View>
              {sinLeer ? (
                <Pressable onPress={() => ir('/perfil/notificaciones')} accessibilityRole="button" accessibilityLabel={`${sinLeer} notificaciones nuevas`} style={estilos.campana}>
                  <Ionicons name="notifications" size={20} color="#ffffff" />
                  <Text style={estilos.campanaNumero}>{sinLeer > 99 ? '99+' : sinLeer}</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => router.navigate('/buscar')} accessibilityRole="search" accessibilityLabel="Buscar" style={estilos.buscar}>
              <Ionicons name="search" size={18} color="#fca5a5" />
              <Text style={{ color: '#d4d4d8', fontSize: 15 }}>Buscar una persona, pedido, máquina o lo que quieras hacer…</Text>
            </Pressable>
            {datos.length ? (
              <View style={estilos.linea}>{datos.map((d) => <Dato key={d.etiqueta} {...d} onPress={() => ir(d.ruta)} />)}</View>
            ) : null}
          </View>
        </BloqueImponente>

        {usuario.rol !== 'ADMIN' && !usuario.area ? (
          <Tarjeta titulo="Tu cuenta todavía no tiene área" icono="information-circle-outline">
            <Text style={{ color: t.textoSuave }}>Pedile a un administrador que te asigne tu área y tus habilidades.</Text>
          </Tarjeta>
        ) : null}

        <View style={[{ gap: espacio.m }, dosColumnas && { flexDirection: 'row', alignItems: 'flex-start' }]}>
          <View style={dosColumnas ? { flex: 1 } : null}>
            {conPendientes ? <Pendientes key={`p${vuelta}`} color={r.color} /> : null}
            <Tablon key={`t${vuelta}`} />
          </View>
          <View style={dosColumnas ? { flex: 1 } : null}>
            {usuario.empleadoId ? <Fichaje /> : null}
            {accesos.length ? (
              <View style={estilos.grilla}>
                {accesos.map((a) => (
                  <View key={a.ruta + a.texto} style={{ width: '50%', padding: 4 }}>
                    <Acceso a={a} color={r.color} suave={r.suave} onPress={() => ir(a.ruta)} />
                  </View>
                ))}
              </View>
            ) : null}
            {conTareas && tareas?.data?.length ? (
              <Tarjeta titulo="Tus tareas abiertas" icono="checkbox-outline" sinRelleno
                derecha={<Boton titulo="Ver todas" variante="texto" chico onPress={() => router.navigate('/tareas')} estilo={{ marginBottom: 0 }} />}>
                {tareas.data.map((x, k) => (
                  <FilaLista key={x.id} ultima={k === tareas.data.length - 1} onPress={() => ir(`/tareas/${x.id}`)}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.texto, fontWeight: '600' }} numberOfLines={1}>{x.titulo}</Text>
                      <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{[x.ot_numero, x.centro_codigo].filter(Boolean).join(' · ') || x.area_nombre}</Text>
                    </View>
                    <Insignia texto={ESTADO_TAREA[x.estado]?.texto ?? x.estado} tono={ESTADO_TAREA[x.estado]?.tono} />
                  </FilaLista>
                ))}
              </Tarjeta>
            ) : null}
            {!usuario.dosPasosActivo ? (
              <Pressable onPress={() => ir('/perfil/dos-pasos')} accessibilityRole="button" style={estilos.pie}>
                <Ionicons name="shield-checkmark-outline" size={16} color={t.textoSuave} />
                <Text style={{ color: t.textoSuave, fontSize: 13, flex: 1 }}>Protegé tu cuenta con la verificación en dos pasos (un código por email al entrar).</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollConArriba>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
  hero: { marginBottom: espacio.l, minHeight: 180 },
  linea: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, flexWrap: 'wrap' },
  rolIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  saludo: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  campana: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(200,16,46,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  campanaNumero: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(239,35,60,0.6)', borderRadius: radio.xl, paddingHorizontal: espacio.m, minHeight: 46 },
  dato: { minWidth: 110, flexGrow: 1, flexBasis: 110, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: radio.l, padding: espacio.m },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: espacio.m },
  acceso: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: radio.l, padding: espacio.m, minHeight: 64 },
  accesoIcono: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: espacio.s },
});
