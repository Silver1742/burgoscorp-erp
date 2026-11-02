// Inicio: distinto para cada rol, con su color y solo lo que ese rol usa todos los días.
//   Empleado      → "Mi día": fichaje, sus tareas abiertas y 4 accesos (tareas, licencia, QR, falla).
//   Jefe de área  → "Mi área": lo que espera su decisión (tareas para asignar y revisar, licencias)
//                   y quién vino hoy; accesos para asignar, ver el equipo y aprobar.
//   Gerencia      → "La empresa": personal, órdenes de trabajo y pedidos abiertos; tablero y áreas.
//   Administrador → "Administración": solicitudes de acceso, cuentas sin área y personal.
// Arriba de todo, la barra de búsqueda lleva a Buscar (encontrar cualquier cosa sin recorrer menús).
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, FilaLista, Insignia, Esqueleto, ErrorCarga, Vacio, Boton } from '../../componentes/ui';
import Fichaje from '../../componentes/Fichaje';
import { usePuede, useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { ESTADO_TAREA } from '../../modulos';
import { espacio, radio, useTema, usePantalla } from '../../tema';

/** "Buen día" hasta las 13, "Buenas tardes" hasta las 20 y después "Buenas noches". */
function saludo() {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return 'Buen día';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const hace = (fecha) => {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

const total = (r) => r?.meta?.total ?? r?.data?.length ?? 0;
const sinError = (p) => p.catch(() => null); // un dato que no carga no tapa el resto de Inicio

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
      { texto: 'Asignar tarea', icono: 'add-circle', ruta: '/modulos/tareas/nueva', si: puede('TAR', 'crear') },
      { texto: 'Tareas del área', icono: 'list', ruta: '/modulos/tareas', si: puede('TAR', 'aprobar') },
      { texto: 'Mi equipo', icono: 'people', ruta: '/equipo', si: true },
      { texto: 'Aprobar licencias', icono: 'checkmark-done', ruta: '/modulos/rrhh/aprobaciones', si: puede('RRHH', 'aprobar') },
    ],
    GERENCIA: [
      { texto: 'Tablero', icono: 'stats-chart', ruta: '/modulos/tablero', si: puede('TAB', 'ver') },
      { texto: 'Áreas y personal', icono: 'business', ruta: '/equipo', si: true },
      { texto: 'Ventas', icono: 'briefcase', ruta: '/modulos/ventas', si: puede('VEN', 'ver') },
      { texto: 'Producción', icono: 'construct', ruta: '/modulos/produccion', si: puede('PROD', 'ver') },
      { texto: 'Sueldos', icono: 'wallet', ruta: '/modulos/finanzas/liquidacion', si: puede('FIN', 'ver') },
    ],
    ADMIN: [
      { texto: 'Solicitudes de acceso', icono: 'hourglass', ruta: '/modulos/usuarios/solicitudes', si: puede('SEG', 'aprobar') },
      { texto: 'Usuarios', icono: 'shield', ruta: '/modulos/usuarios', si: puede('SEG', 'ver') },
      { texto: 'Nuevo usuario', icono: 'person-add', ruta: '/modulos/usuarios/nuevo', si: puede('SEG', 'crear') },
      { texto: 'Áreas y personal', icono: 'business', ruta: '/equipo', si: true },
      { texto: 'Asignar tarea', icono: 'add-circle', ruta: '/modulos/tareas/nueva', si: puede('TAR', 'crear') },
      { texto: 'Sueldos', icono: 'wallet', ruta: '/modulos/finanzas/liquidacion', si: puede('FIN', 'ver') },
    ],
  }[usuario.rol] ?? [];
  return a.filter((x) => x.si);
}

/** Qué contar en Inicio para cada rol: [etiqueta, ícono, consulta, a dónde lleva]. */
async function indicadoresDe(usuario, puede) {
  const rol = usuario.rol;
  const pedidos = [];
  const agregar = (etiqueta, icono, promesa, ruta, alerta) => pedidos.push(sinError(promesa).then((v) => (v === null ? null : { etiqueta, icono, valor: v, ruta, alerta })));
  const personal = ['JEFE', 'GERENCIA', 'ADMIN'].includes(rol) ? sinError(api('/personal/resumen')) : Promise.resolve(null);

  if (rol === 'JEFE') {
    agregar('Tareas para asignar', 'person-add', api('/tareas', { consulta: { sin_asignar: 1, limite: 1 } }).then(total), '/modulos/tareas', true);
    agregar('Tareas para revisar', 'eye', api('/tareas', { consulta: { estado: 'en_revision', limite: 1 } }).then(total), '/modulos/tareas', true);
    if (puede('RRHH', 'aprobar')) agregar('Licencias por aprobar', 'airplane', api('/licencias', { consulta: { para_aprobar: 1, limite: 50 } }).then(total), '/modulos/rrhh/aprobaciones', true);
  }
  if (rol === 'GERENCIA') {
    if (puede('PROD', 'ver')) agregar('Órdenes de trabajo abiertas', 'clipboard', api('/ordenes-trabajo', { consulta: { abiertas: 1, limite: 1 } }).then(total), '/modulos/produccion');
    if (puede('VEN', 'ver')) agregar('Pedidos de clientes abiertos', 'briefcase', api('/solicitudes', { consulta: { abiertas: 1, limite: 1 } }).then(total), '/modulos/ventas');
  }
  if (rol === 'ADMIN') {
    if (puede('SEG', 'aprobar')) agregar('Esperan acceso', 'hourglass', api('/usuarios', { consulta: { estado: 'pendientes', limite: 1 } }).then(total), '/modulos/usuarios/solicitudes', true);
    agregar('Tareas sin asignar', 'person-add', api('/tareas', { consulta: { sin_asignar: 1, limite: 1 } }).then(total), '/modulos/tareas', true);
  }
  const [p, ...resto] = await Promise.all([personal, ...pedidos]);
  const lista = resto.filter(Boolean);
  if (p) {
    const t = p.totales;
    lista.push({ etiqueta: rol === 'JEFE' ? 'Vinieron hoy de tu equipo' : 'Vinieron hoy', icono: 'people', valor: `${t.vinieron_hoy}/${t.personal}`, ruta: '/equipo' });
    if (rol === 'ADMIN' && p.cuentas_sin_area?.length) {
      lista.push({ etiqueta: 'Cuentas sin área', icono: 'alert-circle', valor: p.cuentas_sin_area.length, ruta: '/equipo', alerta: true });
    }
  }
  return lista;
}

function Indicador({ i, color, onPress }) {
  const t = useTema();
  const atencion = i.alerta && Number(i.valor) > 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${i.etiqueta}: ${i.valor}`}
      style={({ pressed }) => [estilos.indicador, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: atencion ? color : t.borde }]}>
      <Ionicons name={i.icono} size={18} color={atencion ? color : t.textoSuave} />
      <Text style={{ color: t.texto, fontSize: 26, fontWeight: '700' }}>{i.valor}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={2}>{i.etiqueta}</Text>
    </Pressable>
  );
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

export default function Inicio() {
  const { usuario } = useSesion();
  const puede = usePuede();
  const router = useRouter();
  const t = useTema();
  const { columnas } = usePantalla();
  const r = perfilRol(usuario.rol);
  const [indicadores, setIndicadores] = useState(null);
  const [tareas, setTareas] = useState(null);
  const [avisos, setAvisos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const conTareas = Boolean(usuario.empleadoId) && ['EMPLEADO', 'JEFE'].includes(usuario.rol);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [ind, notif, mias] = await Promise.all([
        indicadoresDe(usuario, puede),
        api('/notificaciones'),
        conTareas ? sinError(api('/tareas', { consulta: { mias: 1, abiertas: 1, limite: 3 } })) : null,
      ]);
      setIndicadores(ind);
      setAvisos(notif);
      setTareas(mias);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id, usuario.rol]);
  useEffect(() => { cargar(); }, [cargar]);

  const ir = (ruta) => router.push(ruta, { withAnchor: true });
  const accesos = accesosDe(usuario, puede);
  const anchoAcceso = `${100 / (columnas >= 3 ? 3 : 2)}%`;

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        {/* Encabezado con el color del rol */}
        <View style={[estilos.banda, { backgroundColor: r.suave, borderLeftColor: r.color }]}>
          <View style={[estilos.bandaIcono, { backgroundColor: r.color }]}>
            <Ionicons name={r.icono} size={22} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.texto, fontSize: 20, fontWeight: '700' }}>{saludo()}, {usuario.nombre}</Text>
            <Text style={{ color: t.textoSuave }}>
              {r.panel} · {r.titulo}{usuario.rol !== 'ADMIN' && usuario.area ? ` · ${usuario.area.nombre}` : ''}
            </Text>
          </View>
        </View>

        {/* Buscar */}
        <Pressable onPress={() => router.navigate('/buscar')} accessibilityRole="search" accessibilityLabel="Buscar"
          style={[estilos.buscar, { backgroundColor: t.superficie, borderColor: t.borde }]}>
          <Ionicons name="search" size={20} color={r.color} />
          <Text style={{ color: t.textoTenue, fontSize: 15 }}>Buscar una persona, pedido, máquina o lo que quieras hacer…</Text>
        </Pressable>

        {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}

        {usuario.rol !== 'ADMIN' && !usuario.area ? (
          <Tarjeta titulo="Tu cuenta todavía no tiene área" icono="information-circle-outline">
            <Text style={{ color: t.textoSuave }}>Pedile a un administrador que te asigne tu área y tus habilidades.</Text>
          </Tarjeta>
        ) : null}

        {/* Lo que espera una decisión, con números */}
        {indicadores === null && usuario.rol !== 'EMPLEADO' ? (
          <View style={estilos.grilla}>{[0, 1, 2].map((k) => <View key={k} style={{ width: '33%', padding: 4 }}><Esqueleto alto={84} /></View>)}</View>
        ) : indicadores?.length ? (
          <View style={estilos.grilla}>
            {indicadores.map((i) => (
              <View key={i.etiqueta} style={{ width: `${100 / Math.min(indicadores.length, columnas >= 3 ? 4 : 2)}%`, padding: 4 }}>
                <Indicador i={i} color={r.color} onPress={() => ir(i.ruta)} />
              </View>
            ))}
          </View>
        ) : null}

        {usuario.empleadoId ? <Fichaje /> : null}

        {/* Accesos del rol */}
        {accesos.length ? (
          <>
            <Text style={[estilos.seccion, { color: t.textoSuave }]}>¿QUÉ QUERÉS HACER?</Text>
            <View style={estilos.grilla}>
              {accesos.map((a) => (
                <View key={a.ruta + a.texto} style={{ width: anchoAcceso, padding: 4 }}>
                  <Acceso a={a} color={r.color} suave={r.suave} onPress={() => ir(a.ruta)} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Mis tareas abiertas (empleado y jefe) */}
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

        {/* Avisos */}
        <Tarjeta titulo="Avisos" icono="notifications-outline" sinRelleno
          derecha={avisos?.meta.sinLeer ? <Insignia texto={`${avisos.meta.sinLeer} nuevos`} tono="rojo" /> : null}>
          {avisos === null ? (
            <View style={{ padding: espacio.l, gap: 10 }}><Esqueleto ancho="70%" /><Esqueleto ancho="50%" /></View>
          ) : avisos.data.length === 0 ? (
            <Vacio icono="notifications-off-outline" titulo="No tenés avisos" />
          ) : avisos.data.slice(0, 4).map((n, k, arr) => (
            <FilaLista key={n.id} ultima={k === arr.length - 1} onPress={() => ir('/perfil/notificaciones')}>
              <Ionicons name="ellipse" size={8} color={n.leida_at ? 'transparent' : r.color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: n.leida_at ? '400' : '600' }} numberOfLines={1}>{n.titulo}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{n.mensaje ? `${n.mensaje} · ` : ''}{hace(n.created_at)}</Text>
              </View>
            </FilaLista>
          ))}
        </Tarjeta>

        {!usuario.dosPasosActivo ? (
          <Pressable onPress={() => ir('/perfil/dos-pasos')} accessibilityRole="button" style={estilos.pie}>
            <Ionicons name="shield-checkmark-outline" size={16} color={t.textoSuave} />
            <Text style={{ color: t.textoSuave, fontSize: 13, flex: 1 }}>Protegé tu cuenta con la verificación en dos pasos (un código por email al entrar).</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => ir('/perfil/ayuda')} accessibilityRole="button" style={estilos.pie}>
          <Ionicons name="help-circle-outline" size={16} color={t.textoSuave} />
          <Text style={{ color: t.textoSuave, fontSize: 13, flex: 1 }}>¿Cómo se usa? Guía rápida para tu rol.</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  banda: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderLeftWidth: 5, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.m },
  bandaIcono: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.xl, paddingHorizontal: espacio.m, minHeight: 48, marginBottom: espacio.l },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: espacio.m },
  indicador: { borderWidth: 1, borderRadius: radio.l, padding: espacio.m, minHeight: 104, gap: 2 },
  acceso: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: radio.l, padding: espacio.m, minHeight: 64 },
  accesoIcono: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: espacio.xs, marginLeft: espacio.xs },
  pie: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: espacio.s },
});
