// Detalle de una orden de trabajo: datos, avance, cambio de estado y sus operaciones.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, Tarjeta, FilaLista, Insignia, Dato, BarraProgreso, Boton, Campo, Esqueleto, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Selector from '../../../../componentes/Selector';
import { usePuede } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_OT, ESTADO_TAREA, PRIORIDAD, TIPO_TRABAJO, TRANSICIONES_OT, fechaCorta, horas } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const VERBO = { en_proceso: 'Reanudar', pausada: 'Pausar', control_calidad: 'Enviar a calidad', terminada: 'Marcar terminada', entregada: 'Marcar entregada', cancelada: 'Cancelar orden' };
const ICONO = { en_proceso: 'play', pausada: 'pause', control_calidad: 'ribbon-outline', terminada: 'checkmark-done', entregada: 'cube-outline', cancelada: 'close-circle-outline' };
const VARIANTE = { cancelada: 'contornoPeligro', entregada: 'exito', terminada: 'exito' };

function FormOperacion({ visible, otId, alCerrar, alCrear }) {
  const toast = useToast();
  const [f, setF] = useState({ titulo: '', centro_trabajo_id: null, horas_estimadas: '', checklist: '' });
  const [errores, setErrores] = useState({});
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));

  async function crear() {
    const e = {};
    if (!f.titulo.trim()) e.titulo = 'Escribí qué hay que hacer';
    if (f.horas_estimadas && !/^\d+([.,]\d{1,2})?$/.test(f.horas_estimadas)) e.horas_estimadas = 'Número de horas (ej. 2,5)';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const op = await api(`/ordenes-trabajo/${otId}/operaciones`, {
        metodo: 'POST',
        cuerpo: {
          titulo: f.titulo.trim(),
          centro_trabajo_id: f.centro_trabajo_id ?? undefined,
          horas_estimadas: f.horas_estimadas ? Math.round(Number(f.horas_estimadas.replace(',', '.')) * 4) / 4 : undefined,
          checklist: f.checklist.split('\n').map((x) => x.trim()).filter(Boolean),
        },
      });
      toast.exito(`Operación ${op.secuencia} agregada. Asignala desde su detalle.`);
      setF({ titulo: '', centro_trabajo_id: null, horas_estimadas: '', checklist: '' });
      alCrear();
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <ConfirmDialog visible={visible} titulo="Agregar operación" textoConfirmar="Agregar" variante="primario" alConfirmar={crear} alCerrar={alCerrar}>
      <Campo etiqueta="Qué hay que hacer" value={f.titulo} onChangeText={cambiar('titulo')} error={errores.titulo} maxLength={150} placeholder="Ej.: Torneado del eje" />
      <Selector etiqueta="Máquina / puesto" ruta="/centros-trabajo" consulta={{ activo: 'true' }} valor={f.centro_trabajo_id} opcional
        placeholder="Sin máquina" alCambiar={cambiar('centro_trabajo_id')}
        ayuda="La operación queda en el área de la máquina y pide su habilidad."
        mapear={(c) => ({ titulo: `${c.codigo} · ${c.nombre}`, sub: [c.area_nombre, c.estado !== 'operativo' ? 'En mantenimiento' : null].filter(Boolean).join(' · ') })} />
      <Campo etiqueta="Horas estimadas" value={f.horas_estimadas} onChangeText={cambiar('horas_estimadas')} error={errores.horas_estimadas} keyboardType="decimal-pad" maxLength={6} />
      <Campo etiqueta="Lista de control (una por línea, opcional)" value={f.checklist} onChangeText={cambiar('checklist')} multiline numberOfLines={3} maxLength={2000} estilo={{ marginBottom: 0 }} />
    </ConfirmDialog>
  );
}

export default function DetalleOt() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const puede = usePuede();
  const toast = useToast();
  const t = useTema();
  const { columnas } = usePantalla();
  const [ot, setOt] = useState(null);
  const [error, setError] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState(null);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setOt(await api(`/ordenes-trabajo/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarEstado() {
    try {
      const r = await api(`/ordenes-trabajo/${id}`, { metodo: 'PUT', cuerpo: { estado: nuevoEstado } });
      setOt(r);
      toast.exito(`${r.numero}: ${ESTADO_OT[r.estado].texto.toLowerCase()}.`);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!ot) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /><Esqueleto estilo={{ marginTop: 14 }} /></Tarjeta></Pantalla>;

  const editable = puede('PROD', 'editar') && !['entregada', 'cancelada'].includes(ot.estado);
  const todasAprobadas = ot.operaciones > 0 && ot.operaciones_aprobadas === ot.operaciones;
  // "Enviar a calidad" solo cuando todas las operaciones están aprobadas (la API también lo exige).
  const transiciones = (editable ? TRANSICIONES_OT[ot.estado] : []).filter((e) => e !== 'control_calidad' || todasAprobadas);
  const desvio = Number(ot.horas_estimadas) > 0 ? Math.round((Number(ot.horas_reales) / Number(ot.horas_estimadas)) * 100) : null;

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: ot.numero }} />

      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{ot.numero}</Text>
          <Insignia texto={ESTADO_OT[ot.estado].texto} tono={ESTADO_OT[ot.estado].tono} />
          <Insignia texto={`Prioridad ${PRIORIDAD[ot.prioridad].texto.toLowerCase()}`} tono={PRIORIDAD[ot.prioridad].tono} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{ot.titulo}</Text>
        {ot.descripcion ? <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>{ot.descripcion}</Text> : null}
        <View style={estilos.datos}>
          <Dato etiqueta="Cliente">{ot.cliente_nombre ?? 'Trabajo interno'}</Dato>
          <Dato etiqueta="Tipo">{TIPO_TRABAJO[ot.tipo_trabajo]}</Dato>
          <Dato etiqueta="Área">{ot.area_nombre}</Dato>
          <Dato etiqueta="Responsable">{ot.responsable_nombre ?? '—'}</Dato>
          <Dato etiqueta="Cantidad">{String(ot.cantidad)}</Dato>
          <Dato etiqueta="Inicio">{fechaCorta(ot.fecha_inicio_plan)}</Dato>
          <Dato etiqueta="Entrega">{fechaCorta(ot.fecha_entrega_plan)}</Dato>
          <Dato etiqueta="Horas (real / est.)">{`${horas(ot.horas_reales)} / ${horas(ot.horas_estimadas)}${desvio !== null ? ` · ${desvio}%` : ''}`}</Dato>
        </View>
        <BarraProgreso valor={ot.operaciones_aprobadas} total={ot.operaciones} />
        {transiciones.length ? (
          <View style={[estilos.fila, { marginTop: espacio.l }]}>
            {transiciones.map((e) => (
              <Boton key={e} titulo={VERBO[e]} icono={ICONO[e]} chico variante={VARIANTE[e] ?? 'secundario'} onPress={() => setNuevoEstado(e)} />
            ))}
          </View>
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Operaciones" icono="list-outline" sinRelleno
        derecha={editable ? <Boton titulo="Agregar" icono="add" chico onPress={() => setAgregando(true)} /> : null}>
        {ot.tareas.length === 0 ? (
          <Vacio icono="construct-outline" titulo="Sin operaciones" texto="Agregá las operaciones del trabajo: diseño, torneado, soldadura, pintura…" />
        ) : null}
        {ot.tareas.map((op, i) => (
          <FilaLista key={op.id} ultima={i === ot.tareas.length - 1} onPress={() => router.push(`/modulos/tareas/${op.id}`)}>
            <Text style={[estilos.secuencia, { color: t.textoSuave }]}>{op.secuencia}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{op.titulo}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={columnas >= 3 ? 1 : 2}>
                {[op.centro_codigo && `${op.centro_codigo} ${op.centro_nombre}`, op.asignados ?? 'Sin asignar', op.horas_estimadas && `${horas(op.horas_reales)} / ${horas(op.horas_estimadas)}`].filter(Boolean).join(' · ')}
              </Text>
              {op.centro_estado && op.centro_estado !== 'operativo' ? (
                <View style={[estilos.fila, { marginTop: 4 }]}>
                  <Ionicons name="warning" size={13} color={t.avisoTexto} />
                  <Text style={{ color: t.avisoTexto, fontSize: 12 }}>Máquina en mantenimiento</Text>
                </View>
              ) : null}
            </View>
            <Insignia texto={ESTADO_TAREA[op.estado].texto} tono={ESTADO_TAREA[op.estado].tono} />
            <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
          </FilaLista>
        ))}
      </Tarjeta>

      <ConfirmDialog
        visible={Boolean(nuevoEstado)}
        titulo={nuevoEstado ? VERBO[nuevoEstado] : ''}
        mensaje={nuevoEstado ? `¿Pasar ${ot.numero} a "${ESTADO_OT[nuevoEstado].texto}"?` : ''}
        textoConfirmar={nuevoEstado ? VERBO[nuevoEstado] : ''}
        variante={nuevoEstado === 'cancelada' ? 'peligro' : 'primario'}
        alConfirmar={cambiarEstado}
        alCerrar={() => setNuevoEstado(null)}
      />
      <FormOperacion visible={agregando} otId={id} alCerrar={() => setAgregando(false)} alCrear={cargar} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
  secuencia: { width: 26, fontWeight: '700', fontSize: 13 },
});
