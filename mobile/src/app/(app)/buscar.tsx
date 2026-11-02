// Buscar: una sola caja para encontrar lo que sea.
//  - "Ir a…": las pantallas y acciones del menú que coinciden (ej. "licencia", "sueldos", "falla").
//  - Datos: personas, pedidos, órdenes de trabajo, tareas, máquinas, materiales, clientes,
//    proveedores y cuentas, según lo que el rol puede ver (GET /buscar).
// Sin texto muestra el menú completo como una lista simple, agrupada por tema.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Cargando, Vacio } from '../../componentes/ui';
import { usePuede, useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { MODULOS } from '../../modulos';
import { espacio, radio, useTema } from '../../tema';
import { ScrollConArriba } from '../../componentes/Desplazable';

type FilaProps = {
  icono?: any;
  titulo?: any;
  sub?: any;
  onPress?: (...args: any[]) => any;
  color?: any;
};


const ICONO_TIPO = {
  persona: 'person-outline', cliente: 'business-outline', pedido: 'briefcase-outline', ot: 'clipboard-outline',
  tarea: 'checkbox-outline', maquina: 'hardware-chip-outline', producto: 'cube-outline', proveedor: 'cart-outline',
  usuario: 'shield-outline',
};

// Palabras que la gente usa y no están en el título de la pantalla.
const SINONIMOS = {
  'Liquidación de sueldos': 'sueldo sueldos salario pago horas extra tardanzas',
  'Mis licencias y vacaciones': 'vacaciones permiso enfermedad licencia',
  'Reportar una falla': 'rota roto averia avería problema maquina',
  'Personal: cuántos somos y dónde': 'empleados gente equipo areas',
  'Solicitudes de acceso': 'habilitar alta registro pendientes',
  'Nueva solicitud (con foto)': 'pedido cliente cotizacion presupuesto',
};

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A qué pantalla lleva cada resultado. */
function rutaDe(tipo, item, rol) {
  switch (tipo) {
    case 'persona': return `/modulos/rrhh/legajo/${item.id}`;
    case 'pedido': return `/modulos/ventas/solicitud/${item.id}`;
    case 'ot': return `/modulos/produccion/${item.id}`;
    case 'tarea': return rol === 'EMPLEADO' ? `/tareas/${item.id}` : `/modulos/tareas/${item.id}`;
    case 'maquina': return `/modulos/mantenimiento/maquina/${item.id}`;
    case 'producto': return `/modulos/inventario/${item.id}`;
    case 'usuario': return `/modulos/usuarios/${item.id}`;
    case 'cliente': return `/modulos/VEN/clientes?q=${encodeURIComponent(item.titulo)}`;
    case 'proveedor': return `/modulos/COM/proveedores?q=${encodeURIComponent(item.titulo)}`;
    default: return null;
  }
}

function Fila({ icono, titulo, sub, onPress, color }: FilaProps) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={titulo}
      style={({ pressed }) => [estilos.fila, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: t.borde }]}>
      <Ionicons name={icono} size={20} color={color ?? t.textoSuave} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.texto, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>{titulo}</Text>
        {sub ? <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.textoTenue} />
    </Pressable>
  );
}

export default function Buscar() {
  const t = useTema();
  const router = useRouter();
  const { usuario, permisos } = useSesion();
  const puede = usePuede();
  const color = perfilRol(usuario.rol).color;
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const pedido = useRef(0);

  // Todo lo que el rol puede abrir del menú, con su sección.
  const menu = useMemo(() => MODULOS.filter((m) => permisos[m.codigo]?.ver).map((m) => ({
    modulo: m,
    items: [
      ...(m.acciones ?? []).filter((a) => !a.visible || a.visible({ usuario, puede, permisos }))
        .map((a) => ({ titulo: a.titulo, icono: a.icono, ruta: a.ruta(usuario), claves: `${a.rapido ?? ''} ${SINONIMOS[a.titulo] ?? ''}` })),
      ...m.recursos.map((r) => ({ titulo: r.titulo, icono: m.icono, ruta: `/modulos/${m.codigo}/${r.ruta}`, claves: '' })),
    ],
  })).filter((s) => s.items.length), [permisos, usuario, puede]);

  const texto = sinAcentos(q.trim());
  const atajos = texto.length >= 2 ? menu.flatMap((s) => s.items
    .filter((i) => sinAcentos(`${i.titulo} ${s.modulo.titulo} ${i.claves}`).includes(texto))
    .map((i) => ({ ...i, seccion: s.modulo.titulo }))).slice(0, 6) : [];

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) { setDatos(null); setError(null); return undefined; }
    const id = ++pedido.current;
    setBuscando(true);
    const espera = setTimeout(() => {
      api('/buscar', { consulta: { q: termino } })
        .then((r) => { if (id === pedido.current) { setDatos(r.grupos); setError(null); } })
        .catch((err) => { if (id === pedido.current) setError(err.message); })
        .finally(() => { if (id === pedido.current) setBuscando(false); });
    }, 300);
    return () => clearTimeout(espera);
  }, [q]);

  const abrir = (ruta) => ruta && router.push(ruta, { withAnchor: true });
  const sinResultados = texto.length >= 2 && !buscando && !error && datos && !datos.length && !atajos.length;

  return (
    <ScrollConArriba style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <View style={estilos.centrado}>
        <View style={[estilos.caja, { backgroundColor: t.superficie, borderColor: color }]}>
          <Ionicons name="search" size={20} color={color} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar una persona, pedido, máquina, tarea…" placeholderTextColor={t.textoTenue}
            autoFocus autoCorrect={false} returnKeyType="search" maxLength={60} accessibilityLabel="Buscar"
            style={[estilos.input, { color: t.texto }]} />
          {q ? (
            <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda" hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={t.textoTenue} />
            </Pressable>
          ) : null}
        </View>

        {texto.length < 2 ? (
          <>
            <Text style={[estilos.ayuda, { color: t.textoSuave }]}>
              Escribí lo que buscás: un nombre, un número de pedido u OT, una máquina, o lo que querés hacer ("licencia", "sueldos", "falla").
            </Text>
            {menu.map((s) => (
              <View key={s.modulo.codigo} style={{ marginBottom: espacio.l }}>
                <Text style={[estilos.seccion, { color: t.textoSuave }]}>{s.modulo.titulo.toUpperCase()}</Text>
                {s.items.map((i) => <Fila key={i.ruta + i.titulo} icono={i.icono} titulo={i.titulo} onPress={() => abrir(i.ruta)} />)}
              </View>
            ))}
          </>
        ) : (
          <>
            {atajos.length ? (
              <View style={{ marginBottom: espacio.l }}>
                <Text style={[estilos.seccion, { color: t.textoSuave }]}>IR A…</Text>
                {atajos.map((i) => <Fila key={i.ruta + i.titulo} icono={i.icono} titulo={i.titulo} sub={i.seccion} color={color} onPress={() => abrir(i.ruta)} />)}
              </View>
            ) : null}
            {buscando && !datos ? <Cargando texto="Buscando…" /> : null}
            {error ? <Text style={{ color: t.error, marginBottom: espacio.m }}>{error}</Text> : null}
            {(datos ?? []).map((g) => (
              <View key={g.tipo} style={{ marginBottom: espacio.l }}>
                <Text style={[estilos.seccion, { color: t.textoSuave }]}>{g.titulo.toUpperCase()}</Text>
                {g.items.map((i) => (
                  <Fila key={`${g.tipo}${i.id}`} icono={ICONO_TIPO[g.tipo]} titulo={i.titulo} sub={i.sub}
                    onPress={() => abrir(rutaDe(g.tipo, i, usuario.rol))} />
                ))}
              </View>
            ))}
            {sinResultados ? <Vacio icono="search-outline" titulo="No encontramos nada" texto="Probá con otra palabra, un apellido o un número." /> : null}
          </>
        )}
      </View>
    </ScrollConArriba>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  caja: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 2, borderRadius: radio.xl, paddingHorizontal: espacio.m, minHeight: 50, marginBottom: espacio.m },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  ayuda: { fontSize: 14, marginBottom: espacio.l },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: espacio.xs, marginLeft: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: radio.l, paddingHorizontal: espacio.m, paddingVertical: 10, marginBottom: 6 },
});
