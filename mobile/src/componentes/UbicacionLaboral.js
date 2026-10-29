// Dónde va a trabajar una persona: área, puesto y habilidades. Con esto se arma su legajo al
// habilitarla o al crearle la cuenta (lo usan Solicitudes de acceso, Nuevo usuario y la ficha).
// valor: { area_id, area_codigo, area_nombre, puesto_id, puesto_nombre, habilidades: [{ habilidad_id, nombre, nivel }] }
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Opciones, Esqueleto } from './ui';
import { api } from '../lib/api';
import { espacio, radio, useTema } from '../tema';

/** Habilidades que se usan en cada área (las máquinas de esa área las piden): se muestran primero. */
const SUGERIDAS = {
  ING: ['DISENO_CAD', 'ING_INVERSA', 'PROG_CAM'],
  MEC: ['TORNERIA', 'TORNO_CNC', 'FRESADO_CNC', 'CORTE_PLASMA', 'PLEGADO'],
  SOL: ['SOLDADURA_MIG', 'SOLDADURA_TIG', 'HERRERIA', 'PINTURA', 'TRABAJO_ALTURA'],
  I3D: ['IMP3D_FDM', 'IMP3D_RESINA', 'MAQUETISMO', 'DISENO_CAD'],
  CAL: ['METROLOGIA'],
  MAN: ['MANT_MECANICO', 'MANT_ELECTRICO', 'TRABAJO_ALTURA'],
  ABA: ['AUTOELEVADOR'],
  RRHH: ['TRABAJO_ALTURA'],
};
const NIVELES = [{ valor: 'basico', titulo: 'Básico' }, { valor: 'intermedio', titulo: 'Intermedio' }, { valor: 'avanzado', titulo: 'Avanzado' }];

function Chip({ texto, activo, onPress, icono }) {
  const t = useTema();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: activo }}
      style={[estilos.chip, { borderColor: activo ? t.primario : t.borde, backgroundColor: activo ? t.rojoSuave : 'transparent' }]}>
      {icono ? <Ionicons name={activo ? 'checkmark-circle' : icono} size={15} color={activo ? t.primario : t.textoSuave} /> : null}
      <Text style={{ color: activo ? t.primario : t.texto, fontSize: 14, fontWeight: activo ? '600' : '400' }}>{texto}</Text>
    </Pressable>
  );
}

export default function UbicacionLaboral({ valor, alCambiar, error }) {
  const t = useTema();
  const [areas, setAreas] = useState(null);
  const [puestos, setPuestos] = useState([]);
  const [habilidades, setHabilidades] = useState(null);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    api('/areas', { consulta: { activo: 'true', limite: 50 } }).then((r) => setAreas(r.data)).catch(() => setAreas([]));
    api('/habilidades', { consulta: { limite: 100 } }).then((r) => setHabilidades(r.data)).catch(() => setHabilidades([]));
  }, []);

  useEffect(() => {
    if (!valor.area_id) { setPuestos([]); return; }
    api('/puestos', { consulta: { area_id: valor.area_id, activo: 'true', limite: 50 } }).then((r) => setPuestos(r.data)).catch(() => setPuestos([]));
  }, [valor.area_id]);

  const cambiar = (cambios) => alCambiar({ ...valor, ...cambios });
  const elegida = (id) => valor.habilidades.find((h) => h.habilidad_id === id);
  function alternarHabilidad(h) {
    cambiar({
      habilidades: elegida(h.id)
        ? valor.habilidades.filter((x) => x.habilidad_id !== h.id)
        : [...valor.habilidades, { habilidad_id: h.id, nombre: h.nombre, nivel: 'intermedio', requiere_certificacion: h.requiere_certificacion }],
    });
  }

  if (!areas || !habilidades) return <View style={{ gap: 8, marginBottom: espacio.m }}><Esqueleto ancho="40%" /><Esqueleto /><Esqueleto ancho="70%" /></View>;

  const sugeridas = SUGERIDAS[valor.area_codigo] ?? [];
  const delArea = habilidades.filter((h) => sugeridas.includes(h.codigo));
  const otras = habilidades.filter((h) => !sugeridas.includes(h.codigo));
  const mostradas = verTodas || !delArea.length ? [...delArea, ...otras] : delArea;

  return (
    <View>
      <Text style={[estilos.etiqueta, { color: t.texto }]}>Área</Text>
      <View style={estilos.chips}>
        {areas.map((a) => (
          <Chip key={a.id} texto={a.nombre} activo={valor.area_id === a.id}
            onPress={() => cambiar({ area_id: a.id, area_codigo: a.codigo, area_nombre: a.nombre, puesto_id: null, puesto_nombre: null })} />
        ))}
      </View>
      {error ? <Text style={{ color: t.error, fontSize: 13, marginTop: -espacio.s, marginBottom: espacio.m }}>{error}</Text> : null}

      {valor.area_id && puestos.length ? (
        <>
          <Text style={[estilos.etiqueta, { color: t.texto }]}>Puesto</Text>
          <View style={estilos.chips}>
            {puestos.map((p) => (
              <Chip key={p.id} texto={p.nombre} activo={valor.puesto_id === p.id}
                onPress={() => cambiar(valor.puesto_id === p.id ? { puesto_id: null, puesto_nombre: null } : { puesto_id: p.id, puesto_nombre: p.nombre })} />
            ))}
          </View>
        </>
      ) : null}

      {valor.area_id ? (
        <>
          <Text style={[estilos.etiqueta, { color: t.texto }]}>Habilidades</Text>
          <Text style={{ color: t.textoSuave, fontSize: 13, marginBottom: espacio.s }}>
            Deciden qué máquinas puede usar y qué tareas se le pueden asignar.{delArea.length && !verTodas ? ' Primero, las de su área.' : ''}
          </Text>
          <View style={estilos.chips}>
            {mostradas.map((h) => (
              <Chip key={h.id} texto={h.nombre} icono="add-circle-outline" activo={Boolean(elegida(h.id))} onPress={() => alternarHabilidad(h)} />
            ))}
          </View>
          {delArea.length && !verTodas ? (
            <Pressable onPress={() => setVerTodas(true)} style={{ marginBottom: espacio.m }}>
              <Text style={{ color: t.primario, fontWeight: '600' }}>Ver todas las habilidades ({otras.length} más)</Text>
            </Pressable>
          ) : null}

          {valor.habilidades.map((h) => (
            <View key={h.habilidad_id} style={[estilos.nivel, { borderColor: t.borde }]}>
              <Text style={{ color: t.texto, fontWeight: '600', marginBottom: 6 }}>{h.nombre}</Text>
              <Opciones opciones={NIVELES} valor={h.nivel}
                alCambiar={(nivel) => cambiar({ habilidades: valor.habilidades.map((x) => (x.habilidad_id === h.habilidad_id ? { ...x, nivel } : x)) })} />
              {h.requiere_certificacion ? (
                <Text style={{ color: t.textoSuave, fontSize: 12 }}>Pide certificación: RRHH carga el vencimiento en el legajo para poder asignarle trabajo.</Text>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.m },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minHeight: 36 },
  nivel: { borderWidth: 1, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
});

/** Valor vacío para empezar. */
export const UBICACION_VACIA = { area_id: null, area_codigo: null, area_nombre: null, puesto_id: null, puesto_nombre: null, habilidades: [] };

/** Lo que se manda a la API. */
export function cuerpoUbicacion(v) {
  return {
    area_id: v.area_id ?? undefined,
    puesto_id: v.puesto_id ?? null,
    habilidades: v.habilidades.map((h) => ({ habilidad_id: h.habilidad_id, nivel: h.nivel })),
  };
}
