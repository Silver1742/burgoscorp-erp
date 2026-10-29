// Liquidación de sueldos (Administración y Finanzas): por período, cuántas veces llegó tarde cada
// persona, cuántas horas trabajó, sus horas extra, horas faltantes y ausencias sin justificar, y el
// sueldo que resulta. Se descarga como planilla (CSV que abre Excel).
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Insignia, IconoEstadistica, Opciones, Boton, Campo, Dato,
  EsqueletoLista, ErrorCarga, Vacio, Texto, Avatar,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import { usePuede } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { descargarCsv } from '../../../../lib/archivos';
import { fechaCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const PERIODOS = [
  { valor: 'mes', titulo: 'Este mes' },
  { valor: 'quincena', titulo: 'Quincena' },
  { valor: 'anterior', titulo: 'Mes pasado' },
  { valor: 'otro', titulo: 'Elegir fechas' },
];
const iso = (d) => d.toISOString().slice(0, 10);
function rango(p) {
  const h = new Date();
  const y = h.getFullYear();
  const m = h.getMonth();
  const utc = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd));
  if (p === 'anterior') return { desde: iso(utc(y, m - 1, 1)), hasta: iso(utc(y, m, 0)) };
  if (p === 'quincena') return h.getDate() <= 15 ? { desde: iso(utc(y, m, 1)), hasta: iso(utc(y, m, 15)) } : { desde: iso(utc(y, m, 16)), hasta: iso(utc(y, m + 1, 0)) };
  return { desde: iso(utc(y, m, 1)), hasta: iso(utc(y, m + 1, 0)) };
}
const horas = (h) => `${Number(h).toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`;
const ESTADO_DIA = {
  trabajado: { texto: 'Trabajó', tono: 'exito' }, ausente: { texto: 'Ausente', tono: 'error' },
  licencia: { texto: 'Licencia', tono: 'gris' }, franco: { texto: 'Franco', tono: 'gris' },
  futuro: { texto: '—', tono: 'gris' }, hoy: { texto: 'Hoy', tono: 'gris' },
};
const DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const COLUMNAS = ['Legajo', 'Apellido', 'Nombre', 'Área', 'Valor hora', 'Días hábiles', 'Días trabajados', 'Días de licencia',
  'Ausencias sin justificar', 'Llegadas tarde', 'Minutos tarde', 'Horas trabajadas', 'Horas extra (hábiles)',
  'Horas extra (fin de semana)', 'Horas faltantes', 'Sueldo base', 'Adicional horas extra', 'Descuento ausencias',
  'Descuento horas faltantes', 'Total a pagar'];
const fila = (e) => [e.legajo, e.apellido, e.nombre, e.area, e.valor_hora, e.dias_habiles, e.dias_trabajados, e.dias_licencia,
  e.ausencias, e.llegadas_tarde, e.minutos_tarde, e.horas_trabajadas, e.horas_extra_habil, e.horas_extra_finde, e.horas_faltantes,
  e.sueldo_base, e.adicional_extras, e.descuento_ausencias, e.descuento_horas, e.total];

function Numero({ icono, tono, valor, etiqueta }) {
  const t = useTema();
  return (
    <Tarjeta estilo={{ marginBottom: 0, flex: 1 }}>
      <IconoEstadistica icono={icono} tono={tono} />
      <Text style={[estilos.numero, { color: t.texto }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }}>{etiqueta}</Text>
    </Tarjeta>
  );
}

/** Detalle de una persona: el cálculo y día por día. */
function Detalle({ e, desde, hasta, alCerrar }) {
  const t = useTema();
  const toast = useToast();
  const [dias, setDias] = useState(null);
  useEffect(() => {
    api(`/liquidacion/${e.empleado_id}`, { consulta: { desde, hasta } }).then((r) => setDias(r.dias)).catch((err) => toast.error(err.message));
  }, [e.empleado_id, desde, hasta, toast]);

  async function descargar() {
    try {
      await descargarCsv(`detalle_${e.legajo}_${desde}_${hasta}`,
        ['Fecha', 'Día', 'Estado', 'Entrada', 'Salida', 'Horas', 'Minutos tarde', 'Horas extra', 'Horas faltantes'],
        dias.map((d) => [d.fecha, DIA[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()], ESTADO_DIA[d.estado].texto + (d.incompleto ? ' (fichaje sin salida)' : ''),
          d.entrada, d.salida, d.horas, d.tarde_min, d.extra_h, d.faltante_h]));
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <ConfirmDialog visible titulo={`${e.apellido}, ${e.nombre} · ${e.legajo}`} variante="primario" textoConfirmar="Cerrar"
      alConfirmar={async () => {}} alCerrar={alCerrar}>
      <View style={estilos.datos}>
        <Dato etiqueta="Sueldo base">{pesosAr(e.sueldo_base)}</Dato>
        <Dato etiqueta="+ Horas extra">{pesosAr(e.adicional_extras)}</Dato>
        <Dato etiqueta="− Ausencias">{pesosAr(e.descuento_ausencias)}</Dato>
        <Dato etiqueta="− Horas faltantes">{pesosAr(e.descuento_horas)}</Dato>
        <Dato etiqueta="Total a pagar"><Text style={{ color: t.texto, fontWeight: '800', fontSize: 17 }}>{pesosAr(e.total)}</Text></Dato>
        <Dato etiqueta="Valor hora">{pesosAr(e.valor_hora)}</Dato>
      </View>
      <Text style={{ color: t.textoSuave, fontSize: 13, marginBottom: espacio.m }}>
        {e.dias_trabajados} de {e.dias_habiles} días hábiles · {horas(e.horas_trabajadas)} trabajadas · {e.llegadas_tarde} llegadas tarde ({e.minutos_tarde} min)
        · {horas(e.horas_extra_habil + e.horas_extra_finde)} extra · {horas(e.horas_faltantes)} faltantes · {e.ausencias} ausencias
        {e.fichajes_incompletos ? ` · ${e.fichajes_incompletos} fichajes sin salida` : ''}
      </Text>
      {!dias ? <EsqueletoLista filas={3} /> : (
        <>
          <Boton titulo="Descargar el detalle por día" icono="download-outline" variante="secundario" chico onPress={descargar} />
          {dias.map((d) => (
            <View key={d.fecha} style={[estilos.dia, { borderBottomColor: t.borde }]}>
              <Text style={{ color: t.texto, width: 74, fontSize: 13 }}>{DIA[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()]} {fechaCorta(d.fecha).slice(0, 5)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                  {d.entrada ? `${d.entrada} – ${d.salida ?? 'sin salida'} · ${horas(d.horas)}` : ''}
                </Text>
                <View style={[estilos.fila, { marginTop: 2 }]}>
                  <Insignia texto={ESTADO_DIA[d.estado].texto} tono={ESTADO_DIA[d.estado].tono} />
                  {d.tarde_min ? <Insignia texto={`${d.tarde_min} min tarde`} tono="aviso" /> : null}
                  {d.extra_h ? <Insignia texto={`+${horas(d.extra_h)}`} tono="exito" /> : null}
                  {d.faltante_h ? <Insignia texto={`−${horas(d.faltante_h)}`} tono="error" /> : null}
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </ConfirmDialog>
  );
}

export default function Liquidacion() {
  const t = useTema();
  const toast = useToast();
  const puede = usePuede();
  const { columnas } = usePantalla();
  const [periodo, setPeriodo] = useState('mes');
  const [fechas, setFechas] = useState(rango('mes'));
  const [areas, setAreas] = useState([]);
  const [area, setArea] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [jornada, setJornada] = useState(null); // edición

  useEffect(() => {
    api('/areas', { consulta: { activo: 'true', limite: 50 } }).then((r) => setAreas(r.data)).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await api('/liquidacion', { consulta: { ...fechas, area_id: area || undefined } }));
    } catch (err) {
      setError(err.message);
    }
  }, [fechas, area]);
  useEffect(() => { cargar(); }, [cargar]);

  function elegirPeriodo(p) {
    setPeriodo(p);
    if (p !== 'otro') setFechas(rango(p));
  }

  async function descargar() {
    try {
      const filas = datos.empleados.map(fila);
      const tot = datos.totales;
      filas.push(['', 'TOTAL', '', '', '', '', '', '', tot.ausencias, tot.llegadas_tarde, '', tot.horas_trabajadas, '', '', tot.horas_faltantes,
        tot.sueldo_base, tot.adicional_extras, '', '', tot.total]);
      await descargarCsv(`liquidacion_${datos.desde}_${datos.hasta}`, COLUMNAS, filas);
      toast.exito('Planilla lista.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function guardarJornada() {
    try {
      const j = await api('/jornada', {
        metodo: 'PUT',
        cuerpo: {
          hora_entrada: jornada.hora_entrada, tolerancia_min: Number(jornada.tolerancia_min), horas_diarias: Number(String(jornada.horas_diarias).replace(',', '.')),
          recargo_extra_habil: Number(jornada.recargo_extra_habil), recargo_extra_finde: Number(jornada.recargo_extra_finde),
        },
      });
      toast.exito(`Jornada guardada: entrada ${j.hora_entrada}, ${j.horas_diarias} h.`);
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  const tot = datos?.totales;
  const porFila = columnas >= 3 ? 5 : 2;
  const j = datos?.jornada;

  return (
    <Pantalla anchoMax={1140}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <EncabezadoPagina titulo="Liquidación de sueldos" icono="wallet"
        sub="Llegadas tarde, horas trabajadas, horas extra, faltantes y ausencias, con el sueldo de cada persona."
        acciones={tot ? <Boton titulo="Descargar planilla" icono="download" chico onPress={descargar} /> : null} />

      <Opciones opciones={PERIODOS} valor={periodo} alCambiar={elegirPeriodo} />
      {periodo === 'otro' ? (
        <View style={estilos.fechas}>
          <Campo etiqueta="Desde (AAAA-MM-DD)" value={fechas.desde} onChangeText={(desde) => setFechas((f) => ({ ...f, desde }))} maxLength={10} estilo={{ flex: 1 }} />
          <Campo etiqueta="Hasta (AAAA-MM-DD)" value={fechas.hasta} onChangeText={(hasta) => setFechas((f) => ({ ...f, hasta }))} maxLength={10} estilo={{ flex: 1 }} />
        </View>
      ) : null}
      <Opciones opciones={[{ valor: '', titulo: 'Todas las áreas' }, ...areas.map((a) => ({ valor: a.id, titulo: a.nombre }))]} valor={area} alCambiar={setArea} />

      {j ? (
        <Tarjeta>
          <View style={estilos.fila}>
            <Ionicons name="time-outline" size={18} color={t.primario} />
            <Text style={{ color: t.texto, flex: 1, minWidth: 200 }}>
              Del {fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)} · Jornada: entrada {j.hora_entrada} (tolerancia {j.tolerancia_min} min), {j.horas_diarias} h
              de lunes a viernes · extras +{j.recargo_extra_habil} % (hábiles) y +{j.recargo_extra_finde} % (fin de semana)
            </Text>
            {puede('FIN', 'editar') ? <Boton titulo="Cambiar" variante="secundario" chico estilo={{ marginBottom: 0 }} onPress={() => setJornada({ ...j })} /> : null}
          </View>
        </Tarjeta>
      ) : null}

      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
      {!datos && !error ? <Tarjeta><EsqueletoLista filas={5} /></Tarjeta> : null}

      {tot ? (
        <View style={estilos.grilla}>
          {[
            { icono: 'alarm', tono: 'aviso', valor: tot.llegadas_tarde, etiqueta: 'Llegadas tarde' },
            { icono: 'time', tono: 'gris', valor: horas(tot.horas_trabajadas), etiqueta: 'Horas trabajadas' },
            { icono: 'trending-up', tono: 'exito', valor: horas(tot.horas_extra), etiqueta: 'Horas extra' },
            { icono: 'close-circle', tono: 'rojo', valor: tot.ausencias, etiqueta: 'Ausencias sin justificar' },
            { icono: 'wallet', tono: 'rojo', valor: pesosAr(tot.total), etiqueta: `Total a pagar (${tot.empleados} personas)` },
          ].map((n) => (
            <View key={n.etiqueta} style={{ width: `${100 / porFila}%`, padding: espacio.xs }}><Numero {...n} /></View>
          ))}
        </View>
      ) : null}

      {datos && !datos.empleados.length ? <Tarjeta><Vacio icono="people-outline" titulo="No hay personas en ese período o área" /></Tarjeta> : null}

      {datos?.empleados.length ? (
        <Tarjeta titulo="Por persona" icono="people-outline" sinRelleno>
          <Texto suave estilo={{ paddingHorizontal: espacio.l, paddingTop: espacio.m, fontSize: 13 }}>Tocá una persona para ver el detalle día por día.</Texto>
          {datos.empleados.map((e, i) => (
            <FilaLista key={e.empleado_id} ultima={i === datos.empleados.length - 1} onPress={() => setDetalle(e)}>
              <Avatar nombre={`${e.nombre} ${e.apellido}`} tamano={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }} numberOfLines={1}>{e.apellido}, {e.nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 12 }} numberOfLines={1}>{e.legajo} · {e.area} · {horas(e.horas_trabajadas)}</Text>
                <View style={[estilos.fila, { marginTop: 4 }]}>
                  {e.llegadas_tarde ? <Insignia texto={`${e.llegadas_tarde} tarde`} tono="aviso" /> : null}
                  {e.horas_extra_habil + e.horas_extra_finde ? <Insignia texto={`+${horas(e.horas_extra_habil + e.horas_extra_finde)} extra`} tono="exito" /> : null}
                  {e.ausencias ? <Insignia texto={`${e.ausencias} ${e.ausencias === 1 ? 'ausencia' : 'ausencias'}`} tono="error" /> : null}
                  {e.horas_faltantes ? <Insignia texto={`−${horas(e.horas_faltantes)}`} tono="error" /> : null}
                </View>
              </View>
              <Text style={{ color: t.texto, fontWeight: '700' }}>{pesosAr(e.total)}</Text>
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      {datos ? (
        <Texto suave estilo={{ fontSize: 12, marginBottom: espacio.xl }}>
          El sueldo usa el valor hora del legajo: base = días hábiles × horas de la jornada × valor hora; se suman las horas extra
          (en bloques de media hora) con su recargo y se descuentan las ausencias sin justificar y las horas faltantes. Las licencias
          aprobadas se pagan. No incluye feriados, aportes ni retenciones.
        </Texto>
      ) : null}

      {detalle ? <Detalle e={detalle} desde={datos.desde} hasta={datos.hasta} alCerrar={() => setDetalle(null)} /> : null}

      <ConfirmDialog visible={Boolean(jornada)} titulo="Jornada laboral" variante="primario" textoConfirmar="Guardar"
        alConfirmar={guardarJornada} alCerrar={() => setJornada(null)}>
        {jornada ? (
          <>
            <Campo etiqueta="Hora de entrada (HH:MM)" value={jornada.hora_entrada} maxLength={5}
              onChangeText={(v) => setJornada((x) => ({ ...x, hora_entrada: v }))} />
            <Campo etiqueta="Tolerancia (minutos)" value={String(jornada.tolerancia_min)} keyboardType="number-pad" maxLength={2}
              onChangeText={(v) => setJornada((x) => ({ ...x, tolerancia_min: v }))} />
            <Campo etiqueta="Horas por día" value={String(jornada.horas_diarias)} keyboardType="decimal-pad" maxLength={5}
              onChangeText={(v) => setJornada((x) => ({ ...x, horas_diarias: v }))} />
            <Campo etiqueta="Recargo hora extra, días hábiles (%)" value={String(jornada.recargo_extra_habil)} keyboardType="number-pad" maxLength={3}
              onChangeText={(v) => setJornada((x) => ({ ...x, recargo_extra_habil: v }))} />
            <Campo etiqueta="Recargo hora extra, fin de semana (%)" value={String(jornada.recargo_extra_finde)} keyboardType="number-pad" maxLength={3}
              onChangeText={(v) => setJornada((x) => ({ ...x, recargo_extra_finde: v }))} estilo={{ marginBottom: 0 }} />
          </>
        ) : null}
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs, marginBottom: espacio.l },
  numero: { fontSize: 24, fontWeight: '600', marginTop: espacio.s },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m },
  fechas: { flexDirection: 'row', gap: espacio.m },
  dia: { flexDirection: 'row', gap: espacio.s, paddingVertical: espacio.s, borderBottomWidth: 1 },
});
