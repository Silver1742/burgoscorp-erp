// Inspeccionar una OT: mediciones con tolerancia (se marca en rojo lo que queda afuera), piezas
// rechazadas y el resultado. Si no es conforme, se elige qué operación hay que rehacer.
// Después de guardar se abre la inspección para sacarle las fotos.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Opciones, Separador, Esqueleto, Vacio } from '../../../../../componentes/ui';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { espacio, useTema } from '../../../../../tema';

const RESULTADOS = [
  { valor: 'aprobada', titulo: 'Aprobada', icono: 'checkmark' },
  { valor: 'aprobada_con_obs', titulo: 'Con observaciones' },
  { valor: 'rechazada', titulo: 'No conforme', icono: 'close' },
];
const NUM = /^-?\d+([.,]\d{1,4})?$/;
const aNumero = (v) => Number(String(v).replace(',', '.'));
let clave = 0;
const medicionVacia = () => ({ clave: ++clave, caracteristica: '', nominal: '', tolMas: '', tolMenos: '', medido: '', unidad: 'mm' });

/** null mientras falten datos; true/false según quede dentro de la tolerancia (la API lo vuelve a calcular). */
function dentro(m) {
  if (![m.nominal, m.medido].every((v) => NUM.test(v))) return null;
  const tol = (v) => (v && NUM.test(v) ? Math.abs(aNumero(v)) : 0);
  const medido = aNumero(m.medido);
  return medido >= aNumero(m.nominal) - tol(m.tolMenos) - 1e-9 && medido <= aNumero(m.nominal) + tol(m.tolMas) + 1e-9;
}

export default function Inspeccionar() {
  const { otId } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [ot, setOt] = useState(undefined);
  const [mediciones, setMediciones] = useState([medicionVacia()]);
  const [f, setF] = useState({ resultado: null, inspeccionadas: '1', rechazadas: '0', observaciones: '', retrabajo: null });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const cambiarMedicion = (k, c) => (v) => setMediciones((l) => l.map((m) => (m.clave === k ? { ...m, [c]: v } : m)));

  useEffect(() => {
    api('/calidad/pendientes').then((l) => setOt(l.find((o) => String(o.id) === String(otId)) ?? null)).catch((err) => {
      toast.error(err.message);
      setOt(null);
    });
  }, [otId, toast]);

  const cargadas = mediciones.filter((m) => m.caracteristica.trim() || m.medido);
  const fuera = cargadas.filter((m) => dentro(m) === false).length;

  async function guardar() {
    const e = {};
    if (!f.resultado) e.resultado = 'Elegí el resultado';
    cargadas.forEach((m, i) => {
      if (!m.caracteristica.trim()) e[`mediciones.${i}.caracteristica`] = 'Qué se midió';
      if (!NUM.test(m.nominal)) e[`mediciones.${i}.valor_nominal`] = 'Número';
      if (!NUM.test(m.medido)) e[`mediciones.${i}.valor_medido`] = 'Número';
    });
    if (f.resultado !== 'rechazada' && (fuera || Number(f.rechazadas) > 0)) e.resultado = 'Hay mediciones fuera de tolerancia o piezas rechazadas: no se puede aprobar';
    if (f.resultado === 'rechazada' && !f.retrabajo) e.retrabajo = 'Elegí qué operación hay que rehacer';
    if (f.resultado === 'rechazada' && !f.observaciones.trim()) e.observaciones = 'Contá qué no está conforme';
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error(e.resultado ?? 'Revisá los campos marcados.');
      return;
    }
    setEnviando(true);
    try {
      const r = await api(`/ordenes-trabajo/${otId}/inspecciones`, {
        metodo: 'POST',
        cuerpo: {
          resultado: f.resultado,
          cantidad_inspeccionada: Number(f.inspeccionadas) || 1,
          cantidad_rechazada: Number(f.rechazadas) || 0,
          observaciones: f.observaciones.trim() || undefined,
          retrabajo_tarea_id: f.resultado === 'rechazada' ? f.retrabajo : undefined,
          mediciones: cargadas.map((m) => ({
            caracteristica: m.caracteristica.trim(), valor_nominal: aNumero(m.nominal), valor_medido: aNumero(m.medido), unidad: m.unidad || 'mm',
            tolerancia_mas: m.tolMas ? Math.abs(aNumero(m.tolMas)) : 0, tolerancia_menos: m.tolMenos ? Math.abs(aNumero(m.tolMenos)) : 0,
          })),
        },
      });
      toast.exito(f.resultado === 'rechazada'
        ? 'No conformidad registrada: la operación vuelve a hacerse. Sacale una foto a la falla.'
        : `${ot.numero} aprobada: se avisó a Comercial y Finanzas.`);
      router.replace(`/modulos/calidad/${r.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (ot === undefined) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;
  if (ot === null) return <Pantalla><Tarjeta><Vacio icono="ribbon-outline" titulo="Esta orden no está esperando inspección" /></Tarjeta></Pantalla>;

  return (
    <Pantalla>
      <Stack.Screen options={{ title: `Inspección ${ot.numero}` }} />
      <EncabezadoPagina titulo={ot.titulo} icono="ribbon" sub={`${ot.numero} · ${ot.cliente_nombre ?? 'Trabajo interno'} · ${ot.cantidad} pieza${ot.cantidad > 1 ? 's' : ''}`} />

      <Tarjeta titulo="Mediciones" icono="resize-outline"
        derecha={fuera ? <Text style={{ color: t.error, fontWeight: '700', fontSize: 13 }}>{fuera} fuera</Text> : null}>
        {mediciones.map((m, i) => {
          const ok = dentro(m);
          return (
            <View key={m.clave}>
              {i > 0 ? <Separador /> : null}
              <View style={estilos.cabecera}>
                <Text style={{ color: ok === false ? t.error : ok ? t.exito : t.textoSuave, fontWeight: '600' }}>
                  {ok === false ? '✗ Fuera de tolerancia' : ok ? '✓ Conforme' : `Medición ${i + 1}`}
                </Text>
                {mediciones.length > 1 ? (
                  <Pressable onPress={() => setMediciones((l) => l.filter((x) => x.clave !== m.clave))} accessibilityRole="button" accessibilityLabel={`Quitar medición ${i + 1}`} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={t.error} />
                  </Pressable>
                ) : null}
              </View>
              <Campo etiqueta="Qué se mide" value={m.caracteristica} onChangeText={cambiarMedicion(m.clave, 'caracteristica')}
                error={errores[`mediciones.${i}.caracteristica`]} maxLength={100} placeholder="Ej.: Diámetro de salida" />
              <View style={estilos.fila}>
                <Campo etiqueta="Nominal" value={m.nominal} onChangeText={cambiarMedicion(m.clave, 'nominal')} error={errores[`mediciones.${i}.valor_nominal`]}
                  keyboardType="decimal-pad" maxLength={14} estilo={{ flex: 1 }} />
                <Campo etiqueta="+ tol." value={m.tolMas} onChangeText={cambiarMedicion(m.clave, 'tolMas')} keyboardType="decimal-pad" maxLength={10} estilo={{ flex: 1 }} />
                <Campo etiqueta="− tol." value={m.tolMenos} onChangeText={cambiarMedicion(m.clave, 'tolMenos')} keyboardType="decimal-pad" maxLength={10} estilo={{ flex: 1 }} />
              </View>
              <View style={estilos.fila}>
                <Campo etiqueta="Medido" value={m.medido} onChangeText={cambiarMedicion(m.clave, 'medido')} error={errores[`mediciones.${i}.valor_medido`]}
                  keyboardType="decimal-pad" maxLength={14} estilo={{ flex: 2 }} />
                <Campo etiqueta="Unidad" value={m.unidad} onChangeText={cambiarMedicion(m.clave, 'unidad')} maxLength={10} autoCapitalize="none" estilo={{ flex: 1 }} />
              </View>
            </View>
          );
        })}
        <Boton titulo="Agregar medición" icono="add" chico variante="secundario" onPress={() => setMediciones((l) => [...l, medicionVacia()])}
          deshabilitado={mediciones.length >= 40} estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <Tarjeta titulo="Resultado" icono="clipboard-outline">
        <View style={estilos.fila}>
          <Campo etiqueta="Piezas inspeccionadas" value={f.inspeccionadas} onChangeText={cambiar('inspeccionadas')} keyboardType="number-pad" maxLength={6} estilo={{ flex: 1 }} />
          <Campo etiqueta="Rechazadas" value={f.rechazadas} onChangeText={cambiar('rechazadas')} error={errores.cantidad_rechazada} keyboardType="number-pad" maxLength={6} estilo={{ flex: 1 }} />
        </View>
        <Opciones opciones={RESULTADOS} valor={f.resultado} alCambiar={cambiar('resultado')} />
        {errores.resultado ? <Text style={{ color: t.error, marginBottom: espacio.s }}>{errores.resultado}</Text> : null}
        {f.resultado === 'rechazada' ? (
          <>
            <Text style={[estilos.etiqueta, { color: t.texto }]}>Operación a rehacer</Text>
            <Opciones opciones={ot.operaciones.map((o) => ({ valor: o.id, titulo: `${o.secuencia} · ${o.titulo}` }))} valor={f.retrabajo} alCambiar={cambiar('retrabajo')} />
            {errores.retrabajo ? <Text style={{ color: t.error, marginBottom: espacio.s }}>{errores.retrabajo}</Text> : null}
          </>
        ) : null}
        <Campo etiqueta={f.resultado === 'rechazada' ? 'Qué no está conforme' : 'Observaciones (opcional)'} value={f.observaciones}
          onChangeText={cambiar('observaciones')} error={errores.observaciones} multiline maxLength={1000} estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <Boton titulo="Guardar inspección" icono="checkmark" variante={f.resultado === 'rechazada' ? 'peligro' : 'primario'}
        onPress={guardar} cargando={enviando} textoCargando="Guardando…" />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.s },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.s },
  etiqueta: { fontSize: 15, marginBottom: 6 },
});
