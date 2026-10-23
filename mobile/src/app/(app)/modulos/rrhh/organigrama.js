// Organigrama: Dirección arriba y debajo cada área con su jefe y cantidad de personas.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Aviso, Cargando, Tarjeta, Texto } from '../../../../componentes/ui';
import { api } from '../../../../lib/api';
import { espacio, useTema, usePantalla } from '../../../../tema';

function Area({ a, destacada }) {
  const t = useTema();
  return (
    <Tarjeta estilo={[{ marginBottom: 0, height: '100%' }, destacada && { borderColor: t.acento, borderWidth: 2 }]}>
      <Texto estilo={{ fontWeight: '700', fontSize: 16 }}>{a.nombre}</Texto>
      <Texto suave estilo={{ fontSize: 13 }}>{a.descripcion}</Texto>
      <View style={estilos.fila}>
        <Ionicons name="person-circle-outline" size={18} color={t.acento} />
        <Texto estilo={{ marginLeft: espacio.xs, flex: 1 }}>{a.jefe_nombre ?? 'Sin jefe asignado'}</Texto>
      </View>
      <View style={estilos.fila}>
        <Ionicons name="people-outline" size={18} color={t.textoSuave} />
        <Texto suave estilo={{ marginLeft: espacio.xs }}>{a.empleados} {a.empleados === 1 ? 'persona' : 'personas'}</Texto>
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

  return (
    <ScrollView style={{ backgroundColor: t.fondo }} contentContainerStyle={estilos.contenido}>
      <View style={estilos.centrado}>
        <Aviso onReintentar={cargar}>{error}</Aviso>
        {!areas && !error ? <Cargando /> : null}
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
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: espacio.s },
  linea: { width: 2, height: espacio.l, alignSelf: 'center' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs },
});
