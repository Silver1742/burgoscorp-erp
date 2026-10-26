// Detalle de una orden de mantenimiento: la falla con sus fotos, el técnico a cargo, el avance,
// los repuestos usados y el cierre con lo que se hizo.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Campo, Esqueleto, ErrorCarga, Vacio } from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Fotos from '../../../../componentes/Fotos';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_OM, PRIORIDAD, cantidad, fechaHoraCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const VERBO = { en_curso: 'Empezar reparación', esperando_repuesto: 'Esperando repuesto', cerrada: 'Cerrar: reparada', cancelada: 'Cancelar orden' };
const ICONO = { en_curso: 'play', esperando_repuesto: 'hourglass-outline', cerrada: 'checkmark-done', cancelada: 'close-circle-outline' };
const VARIANTE = { cerrada: 'exito', cancelada: 'contornoPeligro', esperando_repuesto: 'secundario' };
const esNumero = (v, dec) => new RegExp(`^\\d+([.,]\\d{1,${dec}})?$`).test(v);
const aNumero = (v) => Number(String(v).replace(',', '.'));

export default function DetalleOm() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [om, setOm] = useState(null);
  const [error, setError] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [cierre, setCierre] = useState({ solucion: '', costo: '' });
  const [errores, setErrores] = useState({});
  const [repuesto, setRepuesto] = useState(null); // { producto_id, texto, unidad, cantidad }

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setOm(await api(`/ordenes-mantenimiento/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarEstado() {
    const e = {};
    if (nuevo === 'cerrada' && cierre.solucion.trim().length < 3) e.solucion = 'Contá qué se hizo';
    if (cierre.costo && !esNumero(cierre.costo, 2)) e.costo = 'Importe en pesos (ej. 15000)';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const r = await api(`/ordenes-mantenimiento/${id}/estado`, {
        metodo: 'POST',
        cuerpo: { estado: nuevo, solucion: cierre.solucion.trim() || undefined, costo: cierre.costo ? aNumero(cierre.costo) : undefined },
      });
      setOm(r);
      setCierre({ solucion: '', costo: '' });
      toast.exito(nuevo === 'cerrada' ? `${r.centro_codigo} reparada. Se le avisó a quien reportó la falla.` : `${r.numero}: ${ESTADO_OM[r.estado].texto.toLowerCase()}.`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  async function asignar(empleadoId) {
    if (!empleadoId) return;
    try {
      setOm(await api(`/ordenes-mantenimiento/${id}`, { metodo: 'PUT', cuerpo: { responsable_id: empleadoId } }));
      toast.exito('Técnico asignado. Le llegó el aviso.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function usarRepuesto() {
    const e = {};
    if (!repuesto.producto_id) e.producto_id = 'Elegí el repuesto';
    if (!esNumero(repuesto.cantidad, 3) || aNumero(repuesto.cantidad) <= 0) e.cantidad = 'Cantidad mayor a cero';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      setOm(await api(`/ordenes-mantenimiento/${id}/repuestos`, { metodo: 'POST', cuerpo: { producto_id: repuesto.producto_id, cantidad: aNumero(repuesto.cantidad) } }));
      toast.exito('Repuesto descontado del stock.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!om) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const abierta = !['cerrada', 'cancelada'].includes(om.estado);

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: om.numero }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{om.numero}</Text>
          <Insignia texto={ESTADO_OM[om.estado].texto} tono={ESTADO_OM[om.estado].tono} />
          <Insignia texto={om.tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'} />
          <Insignia texto={`Prioridad ${PRIORIDAD[om.prioridad].texto.toLowerCase()}`} tono={PRIORIDAD[om.prioridad].tono} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{om.centro_codigo} · {om.centro_nombre}</Text>
        <Text style={{ color: t.texto, marginBottom: espacio.m }}>{om.descripcion}</Text>
        {om.detiene_maquina && abierta ? (
          <View style={[estilos.fila, { marginBottom: espacio.m, flexWrap: 'nowrap' }]}>
            <Ionicons name="stop-circle" size={16} color={t.error} />
            <Text style={{ color: t.error, fontWeight: '600', flex: 1 }}>Máquina parada: Producción no puede usarla.</Text>
          </View>
        ) : null}
        <View style={estilos.datos}>
          <Dato etiqueta="Área de la máquina">{om.area_nombre}</Dato>
          <Dato etiqueta="Reportó">{om.reportado_por_nombre}</Dato>
          <Dato etiqueta="Abierta">{fechaHoraCorta(om.fecha_apertura)}</Dato>
          <Dato etiqueta="Técnico">{om.responsable_nombre ?? 'Sin asignar'}</Dato>
          <Dato etiqueta="Costo">{pesosAr(om.costo)}</Dato>
          {om.plan_nombre ? <Dato etiqueta="Plan">{om.plan_nombre}</Dato> : null}
          {om.fecha_cierre ? <Dato etiqueta="Cerrada">{fechaHoraCorta(om.fecha_cierre)}</Dato> : null}
        </View>
        {om.solucion ? <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>Solución: {om.solucion}</Text> : null}
        {om.puede_asignar ? (
          <Selector etiqueta="Asignar a" ruta="/ordenes-mantenimiento/tecnicos" valor={null} textoValor={om.responsable_nombre}
            placeholder="Elegir técnico" alCambiar={asignar}
            mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.legajo} · ${e.abiertas} ${Number(e.abiertas) === 1 ? 'orden abierta' : 'órdenes abiertas'}` })} />
        ) : null}
        <View style={estilos.fila}>
          {om.transiciones.map((e) => (
            <Boton key={e} titulo={e === 'en_curso' && om.estado === 'abierta' && !om.responsable_id ? 'Tomar y empezar' : VERBO[e]} icono={ICONO[e]} chico
              variante={VARIANTE[e] ?? 'primario'} onPress={() => setNuevo(e)} estilo={{ marginBottom: 0 }} />
          ))}
          <Boton titulo="Ficha de la máquina" icono="hardware-chip-outline" chico variante="texto"
            onPress={() => router.push(`/modulos/mantenimiento/maquina/${om.centro_trabajo_id}`)} estilo={{ marginBottom: 0 }} />
        </View>
      </Tarjeta>

      <Fotos key={om.estado} entidad="orden_mantenimiento" entidadId={om.id} titulo="Fotos de la falla y la reparación"
        vacio="Sacale una foto a la falla: ayuda al técnico a llevar el repuesto correcto." />

      <Tarjeta titulo="Repuestos usados" icono="cog-outline" sinRelleno
        derecha={om.puede_repuestos ? <Boton titulo="Agregar" icono="add" chico onPress={() => setRepuesto({ producto_id: null, texto: null, unidad: '', cantidad: '1' })} /> : null}>
        {om.repuestos.length === 0 ? <Vacio icono="cog-outline" titulo="Sin repuestos" /> : null}
        {om.repuestos.map((r, i) => (
          <FilaLista key={`${r.created_at}-${i}`} ultima={i === om.repuestos.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{r.producto_nombre}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>{[r.producto_codigo, fechaHoraCorta(r.created_at), r.usuario_nombre].join(' · ')}</Text>
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{cantidad(r.cantidad, r.unidad)}</Text>
            <Text style={{ color: t.textoSuave }}>{pesosAr(Number(r.cantidad) * Number(r.costo_unitario))}</Text>
          </FilaLista>
        ))}
      </Tarjeta>

      <ConfirmDialog visible={Boolean(nuevo)} titulo={nuevo ? VERBO[nuevo] : ''}
        mensaje={nuevo === 'cerrada' ? 'Al cerrarla, la máquina vuelve a estar operativa (si no hay otra falla que la detenga).'
          : nuevo === 'cancelada' ? '¿Cancelar la orden? Si la máquina estaba parada por esta falla, vuelve a operar.'
            : nuevo ? `¿Pasar ${om.numero} a "${ESTADO_OM[nuevo].texto}"?` : ''}
        textoConfirmar={nuevo ? VERBO[nuevo] : ''} variante={nuevo === 'cancelada' ? 'peligro' : 'primario'}
        alConfirmar={cambiarEstado} alCerrar={() => { setNuevo(null); setErrores({}); }}>
        {nuevo === 'cerrada' ? (
          <>
            <Campo etiqueta="Qué se hizo" value={cierre.solucion} onChangeText={(v) => setCierre((c) => ({ ...c, solucion: v }))}
              error={errores.solucion} multiline maxLength={1000} placeholder="Ej.: cambio de retenes y reposición de aceite" />
            <Campo etiqueta="Otros costos (mano de obra, terceros) — opcional" value={cierre.costo} onChangeText={(v) => setCierre((c) => ({ ...c, costo: v }))}
              error={errores.costo} keyboardType="decimal-pad" maxLength={15} estilo={{ marginBottom: 0 }} />
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(repuesto)} titulo="Repuesto usado" textoConfirmar="Descontar del stock" variante="primario"
        alConfirmar={usarRepuesto} alCerrar={() => { setRepuesto(null); setErrores({}); }}>
        {repuesto ? (
          <>
            <Selector etiqueta="Repuesto o insumo" ruta="/productos" consulta={{ activo: 'true' }} valor={repuesto.producto_id} textoValor={repuesto.texto}
              error={errores.producto_id}
              alCambiar={(pid, p) => setRepuesto((r) => ({ ...r, producto_id: pid, texto: p ? `${p.codigo} · ${p.nombre}` : null, unidad: p?.unidad ?? '' }))}
              mapear={(p) => ({ titulo: `${p.codigo} · ${p.nombre}`, sub: `Stock ${cantidad(p.stock_total, p.unidad)}` })} />
            <Campo etiqueta={`Cantidad${repuesto.unidad ? ` (${repuesto.unidad})` : ''}`} value={repuesto.cantidad}
              onChangeText={(v) => setRepuesto((r) => ({ ...r, cantidad: v }))} error={errores.cantidad} keyboardType="decimal-pad" maxLength={12} estilo={{ marginBottom: 0 }} />
          </>
        ) : null}
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
});
