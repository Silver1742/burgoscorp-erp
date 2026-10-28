// Tablero: los números del día en tarjetas, pensado para mirarlo en el celular. Cada bloque aparece
// solo si el rol puede ver ese módulo (Finanzas, por ejemplo, solo Gerencia y Administración).
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Esqueleto, ErrorCarga } from '../../../componentes/ui';
import { api } from '../../../lib/api';
import { ESTADO_OT, fechaCorta, pesosAr } from '../../../modulos';
import { espacio, useTema } from '../../../tema';

/** Número grande con su etiqueta. `alerta` lo pinta de rojo con un ícono (nunca solo color). */
function Indicador({ etiqueta, valor, detalle, alerta, onPress }) {
  const t = useTema();
  return (
    <Tarjeta onPress={onPress} estilo={estilos.indicador}>
      <Text style={[estilos.etiqueta, { color: t.textoSuave }]}>{etiqueta}</Text>
      <View style={estilos.filaValor}>
        {alerta ? <Ionicons name="alert-circle" size={18} color={t.error} /> : null}
        <Text style={[estilos.valor, { color: alerta ? t.error : t.texto }]} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
      </View>
      {detalle ? <Text style={{ color: t.textoSuave, fontSize: 12 }}>{detalle}</Text> : null}
    </Tarjeta>
  );
}

function Bloque({ titulo, icono, children }) {
  const t = useTema();
  return (
    <View style={{ marginBottom: espacio.l }}>
      <View style={estilos.cabecera}>
        <Ionicons name={icono} size={18} color={t.primario} />
        <Text style={[estilos.titulo, { color: t.texto }]}>{titulo}</Text>
      </View>
      <View style={estilos.grilla}>{children}</View>
    </View>
  );
}

/** OT abiertas por estado: una sola serie (barras del mismo color) con el número escrito al lado. */
function BarrasEstado({ datos }) {
  const t = useTema();
  const max = Math.max(1, ...datos.map((d) => d.cantidad));
  const orden = Object.keys(ESTADO_OT);
  const filas = [...datos].sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado));
  return (
    <Tarjeta titulo="OT abiertas por estado" icono="bar-chart-outline" estilo={{ width: '100%' }}>
      {filas.map((d) => (
        <View key={d.estado} style={estilos.barraFila} accessible accessibilityLabel={`${ESTADO_OT[d.estado].texto}: ${d.cantidad}`}>
          <Text style={[estilos.barraEtiqueta, { color: t.textoSuave }]} numberOfLines={1}>{ESTADO_OT[d.estado].texto}</Text>
          <View style={estilos.barraPista}>
            <View style={[estilos.barra, { width: `${(d.cantidad / max) * 100}%`, backgroundColor: t.primario }]} />
          </View>
          <Text style={[estilos.barraValor, { color: t.texto }]}>{d.cantidad}</Text>
        </View>
      ))}
    </Tarjeta>
  );
}

export default function Tablero() {
  const router = useRouter();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setD(await api('/tablero'));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const pct = (v) => (v === null || v === undefined ? '—' : `${v} %`);

  return (
    <Pantalla anchoMax={1140} refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <EncabezadoPagina titulo="Tablero" icono="stats-chart"
        sub={d ? `${d.alcance === 'area' ? 'Producción de tu área' : 'Toda la empresa'} · ${fechaCorta(d.fecha)}` : 'Los números del día'} />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
      {!d && !error ? <Tarjeta><Esqueleto alto={60} /><Esqueleto alto={60} estilo={{ marginTop: 10 }} /></Tarjeta> : null}

      {d?.produccion ? (
        <Bloque titulo="Producción" icono="construct-outline">
          <Indicador etiqueta="OT abiertas" valor={d.produccion.abiertas} onPress={() => router.push('/modulos/produccion')} />
          <Indicador etiqueta="Atrasadas" valor={d.produccion.atrasadas} alerta={d.produccion.atrasadas > 0} detalle="Pasó la fecha de entrega" />
          <Indicador etiqueta="Para entregar" valor={d.produccion.para_entregar} detalle="Aprobadas por Calidad" />
          <Indicador etiqueta="Entregadas este mes" valor={d.produccion.entregadas_mes} />
          <Indicador etiqueta="Horas reales / estimadas" valor={d.produccion.horas_estimadas ? pct(Math.round((d.produccion.horas_reales / d.produccion.horas_estimadas) * 100)) : '—'}
            detalle={`${Math.round(d.produccion.horas_reales)} h de ${Math.round(d.produccion.horas_estimadas)} h`}
            alerta={d.produccion.horas_estimadas > 0 && d.produccion.horas_reales > d.produccion.horas_estimadas * 1.1} />
          {d.produccion.por_estado.length ? <BarrasEstado datos={d.produccion.por_estado} /> : null}
        </Bloque>
      ) : null}

      {d?.ventas ? (
        <Bloque titulo="Ventas" icono="briefcase-outline">
          <Indicador etiqueta="Pedidos sin presupuestar" valor={d.ventas.solicitudes_abiertas} onPress={() => router.push('/modulos/ventas')} />
          <Indicador etiqueta="Presupuestos esperando" valor={d.ventas.presupuestos_enviados} detalle={pesosAr(d.ventas.monto_enviado)} />
          <Indicador etiqueta="Aprobados este mes" valor={d.ventas.aprobados_mes} detalle={`Tasa de aprobación ${pct(d.ventas.tasa_aprobacion)}`} />
        </Bloque>
      ) : null}

      {d?.calidad ? (
        <Bloque titulo="Calidad" icono="ribbon-outline">
          <Indicador etiqueta="Inspecciones del mes" valor={d.calidad.inspecciones_mes} onPress={() => router.push('/modulos/calidad')} />
          <Indicador etiqueta="Aprobadas" valor={pct(d.calidad.porcentaje_aprobadas)} />
          <Indicador etiqueta="No conformidades" valor={d.calidad.rechazadas_mes} alerta={d.calidad.rechazadas_mes > 0} />
        </Bloque>
      ) : null}

      {d?.mantenimiento ? (
        <Bloque titulo="Mantenimiento" icono="build-outline">
          <Indicador etiqueta="Máquinas paradas" valor={`${d.mantenimiento.maquinas_paradas} de ${d.mantenimiento.maquinas}`}
            alerta={d.mantenimiento.maquinas_paradas > 0} onPress={() => router.push('/modulos/mantenimiento')} />
          <Indicador etiqueta="Fallas abiertas" valor={d.mantenimiento.ordenes_abiertas} />
          <Indicador etiqueta="Preventivos vencidos" valor={d.mantenimiento.preventivos_vencidos} alerta={d.mantenimiento.preventivos_vencidos > 0} />
        </Bloque>
      ) : null}

      {d?.inventario ? (
        <Bloque titulo="Inventario y compras" icono="cube-outline">
          <Indicador etiqueta="Bajo el mínimo" valor={d.inventario.bajo_minimo} alerta={d.inventario.bajo_minimo > 0} onPress={() => router.push('/modulos/inventario')} />
          <Indicador etiqueta="Valor del stock" valor={pesosAr(Math.round(d.inventario.valor_stock))} />
          <Indicador etiqueta="Compras para aprobar" valor={d.inventario.compras_para_aprobar} />
        </Bloque>
      ) : null}

      {d?.finanzas ? (
        <Bloque titulo="Finanzas" icono="cash-outline">
          <Indicador etiqueta="Facturado este mes" valor={pesosAr(d.finanzas.facturado_mes)} onPress={() => router.push('/modulos/finanzas')} />
          <Indicador etiqueta="Cobrado este mes" valor={pesosAr(d.finanzas.cobrado_mes)} />
          <Indicador etiqueta="A cobrar" valor={pesosAr(d.finanzas.a_cobrar)}
            detalle={d.finanzas.a_cobrar_vencido ? `Vencido ${pesosAr(d.finanzas.a_cobrar_vencido)}` : 'Nada vencido'} alerta={d.finanzas.a_cobrar_vencido > 0} />
          <Indicador etiqueta="A pagar" valor={pesosAr(d.finanzas.a_pagar)}
            detalle={d.finanzas.a_pagar_vencido ? `Vencido ${pesosAr(d.finanzas.a_pagar_vencido)}` : 'Nada vencido'} alerta={d.finanzas.a_pagar_vencido > 0} />
        </Bloque>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s },
  titulo: { fontSize: 17, fontWeight: '600' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
  indicador: { flexGrow: 1, flexBasis: 150, marginBottom: 0 },
  etiqueta: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  filaValor: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  valor: { fontSize: 24, fontWeight: '700', flexShrink: 1 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s },
  barraEtiqueta: { width: 120, fontSize: 13 },
  barraPista: { flex: 1, height: 12 },
  barra: { height: 12, borderTopRightRadius: 4, borderBottomRightRadius: 4, minWidth: 4 },
  barraValor: { width: 28, textAlign: 'right', fontWeight: '600' },
});
