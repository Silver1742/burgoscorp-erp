// Personas (como el UsersPage de R3): una sola lista de toda la gente, con buscador y filtro por área.
// Junta lo que antes estaba repartido en Usuarios, Legajos y Personal. Tocando a alguien se abre su
// ficha en una ventana encima de la lista: ahí se edita (administrador) o se consulta (gerencia).
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import FichaPersona from '../../componentes/FichaPersona';
import { Avatar, Boton, ErrorCarga, EsqueletoLista, Insignia, Vacio } from '../../componentes/ui';
import { usePuede, useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { perfilRol } from '../../lib/roles';
import { espacio, radio, useTema } from '../../tema';

const POR_PAGINA = 40;

export default function Personas() {
  const t = useTema();
  const router = useRouter();
  const puede = usePuede();
  const { usuario } = useSesion();
  const color = perfilRol(usuario.rol).color;
  const [areas, setAreas] = useState([]);
  const [area, setArea] = useState(null);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [ficha, setFicha] = useState(null);
  const pedido = useRef(0);

  useEffect(() => {
    api('/areas', { consulta: { activo: 'true', limite: 50 } }).then((r) => setAreas(r.data)).catch(() => {});
  }, []);

  const cargar = useCallback(async (pagina = 1) => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api('/empleados', { consulta: { q: q.trim() || undefined, area_id: area ?? undefined, estado: 'activo', limite: POR_PAGINA, pagina } });
      if (id !== pedido.current) return;
      setLista((x) => (pagina === 1 ? r.data : [...(x ?? []), ...r.data]));
      setTotal(r.meta.total);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [q, area]);
  useEffect(() => { const e = setTimeout(() => cargar(1), q ? 300 : 0); return () => clearTimeout(e); }, [cargar, q]);

  const cabecera = (
    <View>
      <View style={estilos.titulo}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.texto, fontSize: 22, fontWeight: '700' }}>Personas</Text>
          <Text style={{ color: t.textoSuave }}>{lista ? `${total} personas activas` : 'Toda la gente de la empresa'}</Text>
        </View>
        {puede('SEG', 'crear') ? <Boton titulo="Nueva" icono="person-add" chico onPress={() => router.push('/modulos/usuarios/nuevo', { withAnchor: true })} estilo={{ marginBottom: 0 }} /> : null}
        {puede('SEG', 'aprobar') ? <Boton titulo="Solicitudes" variante="secundario" icono="hourglass-outline" chico onPress={() => router.push('/modulos/usuarios/solicitudes', { withAnchor: true })} estilo={{ marginBottom: 0 }} /> : null}
      </View>
      <View style={[estilos.buscar, { backgroundColor: t.superficie, borderColor: color }]}>
        <Ionicons name="search" size={18} color={color} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar por nombre, apellido o legajo" placeholderTextColor={t.textoTenue}
          style={{ flex: 1, color: t.texto, fontSize: 15, paddingVertical: 10 }} accessibilityLabel="Buscar personas" maxLength={60} />
      </View>
      <View style={estilos.chips}>
        {[{ id: null, nombre: 'Todas las áreas' }, ...areas].map((a) => {
          const activa = area === a.id;
          return (
            <Pressable key={a.id ?? 'todas'} onPress={() => setArea(a.id)} accessibilityRole="radio" accessibilityState={{ selected: activa }}
              style={[estilos.chip, { borderColor: activa ? color : t.borde, backgroundColor: activa ? color : t.superficie }]}>
              <Text style={{ color: activa ? '#ffffff' : t.texto, fontSize: 13 }}>{a.nombre}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <ErrorCarga error={error} onReintentar={() => cargar(1)} /> : null}
      {!lista && !error ? <EsqueletoLista filas={6} /> : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: t.fondo }}
        contentContainerStyle={estilos.contenido}
        data={lista ?? []}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={cabecera}
        ListEmptyComponent={lista ? <Vacio icono="people-outline" titulo="Nadie coincide con la búsqueda" /> : null}
        onEndReached={() => { if (lista && lista.length < total) cargar(Math.floor(lista.length / POR_PAGINA) + 1); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: e }) => (
          <Pressable onPress={() => setFicha(e.id)} accessibilityRole="button" accessibilityLabel={`Ver la ficha de ${e.nombre} ${e.apellido}`}
            style={({ pressed }) => [estilos.fila, { backgroundColor: pressed ? t.superficieSec : t.superficie, borderColor: t.borde }]}>
            <Avatar nombre={`${e.nombre} ${e.apellido}`} tamano={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600', fontSize: 15 }}>{e.apellido}, {e.nombre}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{[e.legajo, e.puesto_nombre, e.area_nombre].filter(Boolean).join(' · ')}</Text>
            </View>
            {!e.usuario_id ? <Insignia texto="Sin cuenta" tono="aviso" /> : null}
            <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
          </Pressable>
        )}
      />
      <FichaPersona empleadoId={ficha} alCerrar={() => setFicha(null)} alCambiar={() => cargar(1)} />
    </>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l, width: '100%', maxWidth: 900, alignSelf: 'center' },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap', marginBottom: espacio.m },
  buscar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 2, borderRadius: radio.xl, paddingHorizontal: espacio.m, marginBottom: espacio.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: espacio.m },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: radio.l, padding: espacio.m, marginBottom: 6 },
});
