// Integrantes de un área con sus datos: quién es el jefe, puesto, rol en el sistema, si vino hoy,
// cuántas tareas tiene abiertas y sus habilidades. Tocando a alguien se ven sus datos de contacto
// y se puede abrir su legajo. Lo usan "Mi equipo" (jefe) y "Áreas" (gerencia y administración).
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Boton, ErrorCarga, EsqueletoLista, Insignia, InsigniaRol, Tarjeta, Vacio } from './ui';
import Contacto from './Contacto';
import { api } from '../lib/api';
import { fechaCorta, horaCorta } from '../modulos';
import { espacio, radio, useTema } from '../tema';

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cómo está hoy: trabajando, ya se fue, de licencia o no vino. */
function presencia(i) {
  if (i.estado === 'licencia') return { texto: 'De licencia', tono: 'gris' };
  if (i.trabajando) return { texto: `Trabajando desde ${horaCorta(i.entrada_hoy)}`, tono: 'exito' };
  if (i.entrada_hoy) return { texto: `Vino hoy ${horaCorta(i.entrada_hoy)}`, tono: 'gris' };
  return { texto: 'No fichó hoy', tono: 'aviso' };
}

function Integrante({ i }) {
  const t = useTema();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const p = presencia(i);
  return (
    <View style={[estilos.integrante, { borderColor: i.es_jefe ? t.primario : t.borde, backgroundColor: t.superficie }]}>
      <Pressable onPress={() => setAbierto((x) => !x)} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${i.nombre} ${i.apellido}`} style={estilos.cabecera}>
        <Avatar nombre={`${i.nombre} ${i.apellido}`} tamano={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={estilos.linea}>
            <Text style={{ color: t.texto, fontWeight: '700', fontSize: 15 }}>{i.apellido}, {i.nombre}</Text>
            {i.es_jefe ? <Insignia texto="Jefe del área" tono="rojo" icono="star" /> : null}
          </View>
          <Text style={{ color: t.textoSuave, fontSize: 13 }}>{[i.legajo, i.puesto ?? 'Sin puesto'].join(' · ')}</Text>
          <View style={estilos.linea}>
            <Insignia texto={p.texto} tono={p.tono} />
            <Insignia texto={`${i.tareas_abiertas} ${i.tareas_abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`} />
          </View>
        </View>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={t.textoTenue} />
      </Pressable>
      {abierto ? (
        <View style={[estilos.detalle, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave, fontSize: 13 }}>CUENTA</Text>
          <View style={[estilos.linea, { marginBottom: espacio.s }]}>
            {i.rol ? <InsigniaRol rol={i.rol} /> : <Insignia texto="Sin cuenta en la app" tono="aviso" />}
            {i.email ? <Text style={{ color: t.texto }}>{i.email}</Text> : null}
          </View>
          <Text style={{ color: t.textoSuave, fontSize: 13 }}>HABILIDADES</Text>
          <Text style={{ color: t.texto, marginBottom: espacio.s }}>{i.habilidades || 'Sin habilidades cargadas'}</Text>
          <Text style={{ color: t.textoSuave, fontSize: 13 }}>INGRESO</Text>
          <Text style={{ color: t.texto, marginBottom: espacio.s }}>{fechaCorta(i.fecha_ingreso)}</Text>
          {i.telefono ? <Contacto telefono={i.telefono} /> : null}
          <Boton titulo="Ver legajo completo" variante="secundario" chico icono="id-card-outline" estilo={{ alignSelf: 'flex-start', marginTop: espacio.s }}
            onPress={() => router.push(`/modulos/rrhh/legajo/${i.id}`, { withAnchor: true })} />
        </View>
      ) : null}
    </View>
  );
}

export default function IntegrantesArea({ areaId }) {
  const t = useTema();
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
  useEffect(() => { cargar(); }, [cargar]);

  const f = sinAcentos(filtro.trim());
  const lista = (datos?.integrantes ?? []).filter((i) => !f
    || sinAcentos(`${i.nombre} ${i.apellido} ${i.legajo} ${i.puesto ?? ''} ${i.habilidades ?? ''}`).includes(f));
  const presentes = (datos?.integrantes ?? []).filter((i) => i.entrada_hoy).length;

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled"
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
            {lista.length ? lista.map((i) => <Integrante key={i.id} i={i} />)
              : <Vacio icono="people-outline" titulo={filtro ? 'Nadie coincide con el filtro' : 'El área no tiene personas'} />}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  filtro: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.l, paddingHorizontal: espacio.m, marginBottom: espacio.m },
  integrante: { borderWidth: 1, borderRadius: radio.l, marginBottom: espacio.s, overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: espacio.m },
  linea: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  detalle: { borderTopWidth: 1, padding: espacio.m, gap: 2 },
});
