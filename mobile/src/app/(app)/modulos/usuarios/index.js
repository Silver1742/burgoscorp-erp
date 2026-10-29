// Usuarios (como el UsersPage de R3): buscar, filtrar por estado y rol, y entrar a cada cuenta para
// verla, editarla, darla de baja, mandarle el código de contraseña o eliminarla.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EncabezadoPagina, Campo, Opciones, Tarjeta, Insignia, InsigniaRol, Avatar, Boton, EsqueletoLista, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import { usePuede, useSesion } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { ROLES } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';
import { estadoUsuario, haceCuanto } from '../../../../lib/usuarios';

const ESTADOS = [
  { valor: '', titulo: 'Todos' },
  { valor: 'activos', titulo: 'Activos' },
  { valor: 'pendientes', titulo: 'Pendientes' },
  { valor: 'inactivos', titulo: 'De baja' },
  { valor: 'rechazados', titulo: 'Rechazados' },
];
const ROL_OPCIONES = [{ valor: '', titulo: 'Todos los roles' }, ...Object.entries(ROLES).map(([valor, titulo]) => ({ valor, titulo }))];
const POR_PAGINA = 30;

export default function Usuarios() {
  const router = useRouter();
  const puede = usePuede();
  const { usuario: yo } = useSesion();
  const t = useTema();
  const { ancho } = usePantalla();
  const columnas = ancho >= 900 ? 2 : 1;
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [rol, setRol] = useState('');
  const [lista, setLista] = useState(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const pedido = useRef(0);

  const consulta = useMemo(() => ({
    limite: POR_PAGINA, q: busqueda.trim() || undefined, estado: estado || undefined, rol: rol || undefined,
  }), [busqueda, estado, rol]);

  const cargar = useCallback(async (pag = 1) => {
    const id = ++pedido.current;
    setError(null);
    try {
      const r = await api('/usuarios', { consulta: { ...consulta, pagina: pag } });
      if (id !== pedido.current) return;
      setLista((ant) => (pag === 1 ? r.data : [...(ant ?? []), ...r.data]));
      setTotal(r.meta.total);
      setPagina(pag);
    } catch (err) {
      if (id === pedido.current) setError(err.message);
    }
  }, [consulta]);

  useEffect(() => {
    const espera = setTimeout(() => cargar(1), busqueda ? 400 : 0);
    return () => clearTimeout(espera);
  }, [cargar, busqueda]);

  const hayMas = lista && lista.length < total;

  return (
    <FlatList
      key={columnas}
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={estilos.lista}
      data={lista ?? []}
      numColumns={columnas}
      keyExtractor={(u) => String(u.id)}
      refreshing={recargando}
      onRefresh={async () => { setRecargando(true); await cargar(1); setRecargando(false); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View>
          <EncabezadoPagina titulo="Usuarios" icono="people" sub="Todas las cuentas: tocá una para verla, editarla o darla de baja."
            acciones={puede('SEG', 'crear') ? <Boton titulo="Nuevo" icono="person-add" chico onPress={() => router.push('/modulos/usuarios/nuevo')} /> : null} />
          <Campo placeholder="Buscar por nombre, email o legajo…" value={busqueda} onChangeText={setBusqueda}
            maxLength={100} autoCapitalize="none" accessibilityLabel="Buscar usuarios"
            derecha={<Ionicons name="search" size={18} color={t.textoTenue} style={{ marginRight: espacio.m }} />} />
          <Opciones opciones={ESTADOS} valor={estado} alCambiar={setEstado} />
          <Opciones opciones={ROL_OPCIONES} valor={rol} alCambiar={setRol} />
          {lista ? <Text style={[estilos.contador, { color: t.textoSuave }]}>{total} {total === 1 ? 'usuario' : 'usuarios'}</Text> : null}
        </View>
      )}
      ListEmptyComponent={error ? <ErrorCarga error={error} onReintentar={() => cargar(1)} />
        : !lista ? <EsqueletoLista /> : <Vacio icono="person-outline" titulo="No hay usuarios que coincidan" texto="Probá con otra búsqueda o filtro." />}
      ListFooterComponent={hayMas ? (
        <Boton titulo={`Ver más (${total - lista.length})`} variante="secundario" icono="chevron-down" onPress={() => cargar(pagina + 1)} />
      ) : null}
      renderItem={({ item: u }) => {
        const e = estadoUsuario(u);
        return (
          <View style={{ flex: 1 / columnas, paddingHorizontal: columnas > 1 ? espacio.xs : 0 }}>
            <Tarjeta onPress={() => router.push(`/modulos/usuarios/${u.id}`)}>
              <View style={estilos.fila}>
                <Avatar nombre={`${u.nombre} ${u.apellido}`} tamano={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[estilos.nombre, { color: t.texto }]} numberOfLines={1}>
                    {u.apellido}, {u.nombre}{u.id === yo.id ? '  ·  Vos' : ''}
                  </Text>
                  <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{u.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
              </View>
              <View style={[estilos.fila, { marginTop: espacio.s }]}>
                <InsigniaRol rol={u.rol} />
                <Insignia texto={e.texto} tono={e.tono} icono={e.icono} />
                {u.area_nombre ? <Insignia texto={u.area_nombre} icono="business-outline" /> : null}
                {u.dos_pasos ? <Insignia texto="2FA" tono="exito" icono="shield-checkmark" /> : null}
              </View>
              <Text style={{ color: t.textoTenue, fontSize: 12, marginTop: espacio.s }}>
                {u.ultimo_login_at ? `Último ingreso ${haceCuanto(u.ultimo_login_at)}` : 'Nunca ingresó'}
              </Text>
            </Tarjeta>
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  lista: { padding: espacio.l, maxWidth: 1140, width: '100%', alignSelf: 'center', flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  nombre: { fontSize: 16, fontWeight: '600' },
  contador: { marginBottom: espacio.s, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
});
