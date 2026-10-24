// Organigrama: Dirección arriba y debajo cada área con su jefe y cantidad de personas
// (tarjetas de área con borde rojo arriba, como .bc-area-card de R3).
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Avatar, Insignia, Esqueleto, ErrorCarga } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { espacio, useTema, usePantalla } from '../../../../tema';

function Area({ a, destacada }) {
  const t = useTema();
  return (
    <Tarjeta acentoArriba estilo={[{ marginBottom: 0, flex: 1 }, destacada && { borderColor: t.primario }]}>
      <Text style={{ color: t.textoSuave, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{a.codigo}</Text>
      <Text style={{ color: t.texto, fontWeight: '600', fontSize: 16, marginTop: 2 }}>{a.nombre}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{a.descripcion}</Text>
      <View style={estilos.jefe}>
        {a.jefe_nombre ? <Avatar nombre={a.jefe_nombre} tamano={30} /> : <Ionicons name="person-outline" size={22} color={t.textoTenue} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.texto, fontSize: 14 }}>{a.jefe_nombre ?? 'Sin jefe asignado'}</Text>
          {a.jefe_puesto ? <Text style={{ color: t.textoSuave, fontSize: 12 }}>{a.jefe_puesto}</Text> : null}
        </View>
        <Insignia texto={`${a.empleados}`} icono="people-outline" />
      </View>
    </Tarjeta>
  );
}

export default function Organigrama() {
  const t = useTema();
  const { columnas } = usePantalla();
  const [areas, setAreas] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setAreas(await api('/organigrama'));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const direccion = areas?.find((a) => a.codigo === 'DIR');
  const resto = areas?.filter((a) => a.codigo !== 'DIR') ?? [];
  const personas = areas?.reduce((s, a) => s + a.empleados, 0);

  return (
    <Pantalla anchoMax={1140}>
      <EncabezadoPagina titulo="Organigrama" icono="git-network" sub={areas ? `${areas.length} áreas · ${personas} personas` : 'Estructura de BurgosCorp'} />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
      {!areas && !error ? (
        <View style={estilos.grilla}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={{ width: `${100 / columnas}%`, padding: espacio.xs }}>
              <Tarjeta estilo={{ marginBottom: 0 }}><Esqueleto ancho="30%" /><Esqueleto ancho="70%" alto={16} estilo={{ marginTop: 8 }} /><Esqueleto estilo={{ marginTop: 14 }} /></Tarjeta>
            </View>
          ))}
        </View>
      ) : null}
      {direccion ? (
        <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center' }}>
          <Area a={direccion} destacada />
          <View style={[estilos.linea, { backgroundColor: t.borde }]} />
        </View>
      ) : null}
      <View style={estilos.grilla}>
        {resto.map((a) => (
          <View key={a.id} style={{ width: `${100 / columnas}%`, padding: espacio.xs }}>
            <Area a={a} />
          </View>
        ))}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  jefe: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.m },
  linea: { width: 2, height: espacio.l, alignSelf: 'center' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs },
});
