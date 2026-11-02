// Campo de fecha con calendario (en vez de tipear "AAAA-MM-DD").
// Se ve en formato argentino (DD/MM/AAAA), el calendario está en castellano y la semana empieza el
// lunes. Por dentro el valor sigue siendo 'AAAA-MM-DD', que es lo que espera la API.
//
//   <CampoFecha etiqueta="Entrega" valor={f.fecha} alCambiar={(v) => ...} error={...} opcional minimo="2026-11-01" />
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMostrarError } from './ui';
import { espacio, radio, sombra, useTema } from '../tema';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const dos = (n) => String(n).padStart(2, '0');
const aIso = (a, m, d) => `${a}-${dos(m + 1)}-${dos(d)}`;
/** Fecha de hoy en Argentina (no en UTC): a la noche UTC ya es "mañana". */
export function hoyIso() {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return aIso(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
}
/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export const fechaArgentina = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const partes = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return { a, m: m - 1, d };
};

/** Días del mes en una grilla de semanas que empiezan el lunes (null = casillero vacío). */
function grilla(a, m) {
  const primero = new Date(Date.UTC(a, m, 1)).getUTCDay(); // 0 = domingo
  const vacios = (primero + 6) % 7; // lunes primero
  const dias = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const celdas = [...Array(vacios).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}

export default function CampoFecha({
  etiqueta, valor, alCambiar, error, ayuda, opcional = false, minimo, maximo, estilo, placeholder = 'Elegir fecha',
}) {
  const t = useTema();
  const contenedor = useMostrarError(error);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState(() => partes(valor || hoyIso())); // mes que se muestra
  const [eligiendoAnio, setEligiendoAnio] = useState(false);
  const hoy = hoyIso();
  const celdas = useMemo(() => grilla(vista.a, vista.m), [vista.a, vista.m]);
  const fueraDeRango = (iso) => (minimo && iso < minimo) || (maximo && iso > maximo);

  function abrir() {
    setVista(partes(valor || hoy));
    setEligiendoAnio(false);
    setAbierto(true);
  }
  function mover(delta) {
    setVista((v) => {
      const m = v.m + delta;
      return { a: v.a + Math.floor(m / 12), m: ((m % 12) + 12) % 12, d: 1 };
    });
  }
  function elegir(iso) {
    alCambiar(iso);
    setAbierto(false);
  }

  const anios = useMemo(() => {
    const desde = minimo ? partes(minimo).a : partes(hoy).a - 90;
    const hasta = maximo ? partes(maximo).a : partes(hoy).a + 10;
    return Array.from({ length: hasta - desde + 1 }, (_, i) => hasta - i);
  }, [minimo, maximo, hoy]);

  return (
    <View ref={contenedor} style={[{ marginBottom: espacio.l }, estilo]}>
      {etiqueta ? <Text style={[estilos.etiqueta, { color: t.texto }]}>{etiqueta}</Text> : null}
      <Pressable onPress={abrir} accessibilityRole="button" accessibilityLabel={`${etiqueta ?? 'Fecha'}: ${valor ? fechaArgentina(valor) : 'sin elegir'}. Abrir calendario`}
        style={[estilos.caja, { backgroundColor: t.superficie, borderColor: error ? t.error : t.borde }]}>
        <Ionicons name="calendar-outline" size={18} color={t.textoSuave} />
        <Text style={{ flex: 1, fontSize: 16, color: valor ? t.texto : t.textoTenue }}>{valor ? fechaArgentina(valor) : placeholder}</Text>
        {opcional && valor ? (
          <Pressable onPress={() => alCambiar('')} accessibilityRole="button" accessibilityLabel="Quitar la fecha" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={t.textoTenue} />
          </Pressable>
        ) : null}
      </Pressable>
      {error
        ? <View style={estilos.filaError}><Ionicons name="alert-circle" size={14} color={t.error} /><Text style={{ color: t.error, fontSize: 13 }}>{error}</Text></View>
        : ayuda ? <Text style={{ color: t.textoSuave, fontSize: 13, marginTop: espacio.xs }}>{ayuda}</Text> : null}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={estilos.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar el calendario">
          <Pressable style={[estilos.calendario, sombra, { backgroundColor: t.superficie, borderColor: t.borde }]} onPress={() => {}}>
            {/* Mes y año: las flechas cambian de mes; tocando el título se elige el año. */}
            <View style={estilos.cabecera}>
              <Pressable onPress={() => mover(-1)} accessibilityRole="button" accessibilityLabel="Mes anterior" hitSlop={8} style={estilos.flecha}>
                <Ionicons name="chevron-back" size={22} color={t.texto} />
              </Pressable>
              <Pressable onPress={() => setEligiendoAnio((x) => !x)} accessibilityRole="button" accessibilityLabel="Elegir el año" style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: t.texto, fontSize: 16, fontWeight: '700' }}>
                  {MESES[vista.m]} {vista.a} <Ionicons name={eligiendoAnio ? 'chevron-up' : 'chevron-down'} size={14} color={t.textoSuave} />
                </Text>
              </Pressable>
              <Pressable onPress={() => mover(1)} accessibilityRole="button" accessibilityLabel="Mes siguiente" hitSlop={8} style={estilos.flecha}>
                <Ionicons name="chevron-forward" size={22} color={t.texto} />
              </Pressable>
            </View>

            {eligiendoAnio ? (
              <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={estilos.anios}>
                {anios.map((a) => (
                  <Pressable key={a} onPress={() => { setVista((v) => ({ ...v, a })); setEligiendoAnio(false); }} accessibilityRole="button"
                    style={[estilos.anio, a === vista.a && { backgroundColor: t.primario }]}>
                    <Text style={{ color: a === vista.a ? '#ffffff' : t.texto }}>{a}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                <View style={estilos.semana}>
                  {DIAS.map((d, i) => <Text key={i} style={[estilos.diaSemana, { color: t.textoSuave }]}>{d}</Text>)}
                </View>
                <View style={estilos.dias}>
                  {celdas.map((d, i) => {
                    if (!d) return <View key={i} style={estilos.dia} />;
                    const iso = aIso(vista.a, vista.m, d);
                    const elegido = iso === valor;
                    const esHoy = iso === hoy;
                    const bloqueado = fueraDeRango(iso);
                    return (
                      <Pressable key={i} disabled={bloqueado} onPress={() => elegir(iso)} accessibilityRole="button"
                        accessibilityLabel={fechaArgentina(iso)} accessibilityState={{ selected: elegido, disabled: bloqueado }}
                        style={[estilos.dia, elegido && { backgroundColor: t.primario }, !elegido && esHoy && { borderWidth: 1, borderColor: t.primario }]}>
                        <Text style={{ color: elegido ? '#ffffff' : bloqueado ? t.textoTenue : t.texto, fontWeight: esHoy || elegido ? '700' : '400' }}>{d}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={[estilos.pie, { borderTopColor: t.borde }]}>
              {!fueraDeRango(hoy) ? (
                <Pressable onPress={() => elegir(hoy)} accessibilityRole="button" hitSlop={6}>
                  <Text style={{ color: t.primario, fontWeight: '600' }}>Hoy</Text>
                </Pressable>
              ) : <View />}
              <View style={{ flexDirection: 'row', gap: espacio.l }}>
                {opcional && valor ? (
                  <Pressable onPress={() => elegir('')} accessibilityRole="button" hitSlop={6}>
                    <Text style={{ color: t.textoSuave }}>Quitar</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" hitSlop={6}>
                  <Text style={{ color: t.textoSuave }}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  caja: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.m, minHeight: 44, paddingHorizontal: espacio.m },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: espacio.xs },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: espacio.l },
  calendario: { width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: radio.xl, padding: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.s },
  flecha: { padding: 6 },
  semana: { flexDirection: 'row' },
  diaSemana: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 4 },
  dias: { flexDirection: 'row', flexWrap: 'wrap' },
  dia: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} }) },
  anios: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  anio: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radio.m },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: espacio.s, paddingTop: espacio.m },
});
