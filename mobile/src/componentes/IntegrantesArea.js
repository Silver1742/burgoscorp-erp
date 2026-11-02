// Integrantes de un área con sus datos: quién es el jefe, puesto, rol en el sistema, si vino hoy,
// cuántas tareas tiene abiertas y sus habilidades. Tocando a alguien se abre su ficha en una ventana
// encima de la lista (ahí se edita, se le asigna una tarea, etc., según el rol de quien mira).
// Lo usan "Mi equipo" (jefe) y la ventana de cada área (gerencia y administración).
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, ErrorCarga, EsqueletoLista, Insignia, InsigniaRol, Tarjeta, Vacio } from './ui';
import FichaPersona from './FichaPersona';
import { api } from '../lib/api';
import { horaCorta } from '../modulos';
import { espacio, radio, useTema } from '../tema';
import { useCargar } from '../lib/cambios';
import { ScrollConArriba } from './Desplazable';

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cómo está hoy: trabajando, ya se fue, de licencia o no vino. */
function presencia(i) {
  if (i.estado === 'licencia') return { texto: 'De licencia', tono: 'gris' };
  if (i.trabajando) return { texto: `Trabajando desde ${horaCorta(i.entrada_hoy)}`, tono: 'exito' };
  if (i.entrada_hoy) return { texto: `Vino hoy ${horaCorta(i.entrada_hoy)}`, tono: 'gris' };
  return { texto: 'No fichó hoy', tono: 'aviso' };
}

function Integrante({ i, alAbrir }) {
  const t = useTema();
  const p = presencia(i);
  return (
    <Pressable onPress={alAbrir} accessibilityRole="button" accessibilityLabel={`Abrir la ficha de ${i.nombre} ${i.apellido}`}
      style={({ pressed }) => [estilos.integrante, estilos.cabecera, { borderColor: i.es_jefe ? t.primario : t.borde, backgroundColor: pressed ? t.superficieSec : t.superficie }]}>
      <Avatar nombre={`${i.nombre} ${i.apellido}`} tamano={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={estilos.linea}>
          <Text style={{ color: t.texto, fontWeight: '700', fontSize: 15 }}>{i.apellido}, {i.nombre}</Text>
          {i.es_jefe ? <Insignia texto="Jefe del área" tono="rojo" icono="star" /> : null}
          {i.rol ? <InsigniaRol rol={i.rol} /> : null}
        </View>
        <Text style={{ color: t.textoSuave, fontSize: 13 }}>{[i.legajo, i.puesto ?? 'Sin puesto'].join(' · ')}</Text>
        <View style={estilos.linea}>
          <Insignia texto={p.texto} tono={p.tono} />
          <Insignia texto={`${i.tareas_abiertas} ${i.tareas_abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`} />
        </View>
        {i.habilidades ? <Text style={{ color: t.textoSuave, fontSize: 12 }} numberOfLines={1}>{i.habilidades}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
    </Pressable>
  );
}

export default function IntegrantesArea({ areaId }) {
  const t = useTema();
  const [ficha, setFicha] = useState(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await api(`/personal/area/${areaId}`));
    } catch (err) {
      setError(err.message);
    }
  }, [areaId]);
  useCargar(cargar);

  const f = sinAcentos(filtro.trim());
  const lista = (datos?.integrantes ?? []).filter((i) => !f
    || sinAcentos(`${i.nombre} ${i.apellido} ${i.legajo} ${i.puesto ?? ''} ${i.habilidades ?? ''}`).includes(f));
  const presentes = (datos?.integrantes ?? []).filter((i) => i.entrada_hoy).length;

  return (
    <ScrollConArriba style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <View style={estilos.centrado}>
        {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
        {!datos && !error ? <EsqueletoLista filas={5} /> : null}
        {datos ? (
          <>
            <Text style={{ color: t.texto, fontSize: 22, fontWeight: '700' }}>{datos.area.nombre}</Text>
            <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>
              {datos.area.jefe_nombre ? `Jefe: ${datos.area.jefe_nombre}` : 'Sin jefe asignado'} · {datos.integrantes.length} personas · {presentes} vinieron hoy
            </Text>
            <View style={[estilos.filtro, { backgroundColor: t.superficie, borderColor: t.borde }]}>
              <Ionicons name="search" size={18} color={t.textoSuave} />
              <TextInput value={filtro} onChangeText={setFiltro} placeholder="Filtrar por nombre, puesto o habilidad" placeholderTextColor={t.textoTenue}
                style={{ flex: 1, color: t.texto, fontSize: 15, paddingVertical: 8 }} accessibilityLabel="Filtrar integrantes" maxLength={60} />
            </View>
            {lista.length ? lista.map((i) => <Integrante key={i.id} i={i} alAbrir={() => setFicha(i.id)} />)
              : <Vacio icono="people-outline" titulo={filtro ? 'Nadie coincide con el filtro' : 'El área no tiene personas'} />}
          </>
        ) : null}
      </View>
      <FichaPersona empleadoId={ficha} alCerrar={() => setFicha(null)} alCambiar={cargar} />
    </ScrollConArriba>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  filtro: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.l, paddingHorizontal: espacio.m, marginBottom: espacio.m },
  integrante: { borderWidth: 1, borderRadius: radio.l, marginBottom: espacio.s, overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: espacio.m },
  linea: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
});
