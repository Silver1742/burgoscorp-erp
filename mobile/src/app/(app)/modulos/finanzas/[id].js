// Detalle de un comprobante: ítems, cobros o pagos registrados, el saldo y (en las de proveedor)
// la foto o el PDF de la factura.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Campo, Opciones, Esqueleto, ErrorCarga, Vacio } from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Fotos from '../../../../componentes/Fotos';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_COMPROBANTE, TIPO_COMPROBANTE, cantidad, fechaCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const MEDIOS = ['transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro'].map((v) => ({ valor: v, titulo: v[0].toUpperCase() + v.slice(1) }));

export default function DetalleComprobante() {
  const { id } = useLocalSearchParams();
  const toast = useToast();
  const t = useTema();
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [pago, setPago] = useState({ monto: '', medio: 'transferencia', referencia: '' });
  const [errores, setErrores] = useState({});

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setC(await api(`/comprobantes/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function registrar() {
    const e = {};
    if (!/^\d+([.,]\d{1,2})?$/.test(pago.monto) || Number(pago.monto.replace(',', '.')) <= 0) e.monto = 'Importe en pesos (ej. 50000)';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const r = await api(`/comprobantes/${id}/pagos`, {
        metodo: 'POST', cuerpo: { monto: Number(pago.monto.replace(',', '.')), medio: pago.medio, referencia: pago.referencia.trim() || undefined },
      });
      setC(r);
      setPago({ monto: '', medio: 'transferencia', referencia: '' });
      toast.exito(r.estado === 'pagado' ? 'Saldado.' : `Registrado. Queda un saldo de ${pesosAr(r.saldo)}.`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  async function anular() {
    try {
      setC(await api(`/comprobantes/${id}/anular`, { metodo: 'POST', cuerpo: {} }));
      toast.exito('Comprobante anulado.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!c) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const esVenta = c.tipo.endsWith('venta');
  const estado = ESTADO_COMPROBANTE[c.estado];

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: `${c.letra} ${c.numero_completo}` }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{TIPO_COMPROBANTE[c.tipo]} {c.letra} {c.numero_completo}</Text>
          <Insignia texto={estado.texto} tono={estado.tono} />
          {c.vencido ? <Insignia texto="Vencida" tono="error" /> : null}
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{c.contraparte}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Total">{pesosAr(c.total)}</Dato>
          <Dato etiqueta={esVenta ? 'Falta cobrar' : 'Falta pagar'}>{pesosAr(c.saldo)}</Dato>
          <Dato etiqueta="Fecha">{fechaCorta(c.fecha)}</Dato>
          <Dato etiqueta="Vence">{fechaCorta(c.fecha_vencimiento)}</Dato>
          {c.ot_numero ? <Dato etiqueta="Orden de trabajo">{c.ot_numero}</Dato> : null}
          {c.oc_numero ? <Dato etiqueta="Orden de compra">{c.oc_numero}</Dato> : null}
        </View>
        <View style={estilos.fila}>
          {c.puede_pagar ? (
            <Boton titulo={esVenta ? 'Registrar cobro' : 'Registrar pago'} icono="cash-outline" chico estilo={{ marginBottom: 0 }}
              onPress={() => { setPago((x) => ({ ...x, monto: String(c.saldo) })); setPagando(true); }} />
          ) : null}
          {c.puede_anular ? <Boton titulo="Anular" chico variante="contornoPeligro" onPress={() => setAnulando(true)} estilo={{ marginBottom: 0 }} /> : null}
        </View>
      </Tarjeta>

      <Tarjeta titulo="Ítems" icono="list-outline" sinRelleno>
        {c.items.map((i, n) => (
          <FilaLista key={i.id} ultima={n === c.items.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{i.descripcion}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>{cantidad(i.cantidad)} × {pesosAr(i.precio_unitario)} · IVA {i.iva_alicuota} %</Text>
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{pesosAr(i.subtotal)}</Text>
          </FilaLista>
        ))}
        <View style={[estilos.totales, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave }}>Neto {pesosAr(c.subtotal)} · IVA {pesosAr(c.iva_monto)}</Text>
          <Text style={{ color: t.texto, fontSize: 17, fontWeight: '700' }}>{pesosAr(c.total)}</Text>
        </View>
      </Tarjeta>

      <Tarjeta titulo={esVenta ? 'Cobros' : 'Pagos'} icono="cash-outline" sinRelleno>
        {c.pagos.length === 0 ? <Vacio icono="cash-outline" titulo={esVenta ? 'Todavía no se cobró' : 'Todavía no se pagó'} /> : null}
        {c.pagos.map((p, n) => (
          <FilaLista key={p.id} ultima={n === c.pagos.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{fechaCorta(p.fecha)} · {p.medio}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>{[p.referencia, p.registrado_por_nombre].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={{ color: t.exito, fontWeight: '700' }}>{pesosAr(p.monto)}</Text>
          </FilaLista>
        ))}
      </Tarjeta>

      {!esVenta ? (
        <Fotos key={c.estado} entidad="comprobante" entidadId={c.id} titulo="Foto de la factura"
          vacio="Sacale una foto a la factura del proveedor (o adjuntá el PDF desde la web)." />
      ) : null}

      <ConfirmDialog visible={pagando} titulo={esVenta ? 'Registrar cobro' : 'Registrar pago'} variante="primario" textoConfirmar="Registrar"
        mensaje={`Saldo: ${pesosAr(c.saldo)}`} alConfirmar={registrar} alCerrar={() => { setPagando(false); setErrores({}); }}>
        <Campo etiqueta="Monto ($)" value={pago.monto} onChangeText={(v) => setPago((x) => ({ ...x, monto: v }))} error={errores.monto} keyboardType="decimal-pad" maxLength={15} />
        <Opciones opciones={MEDIOS} valor={pago.medio} alCambiar={(medio) => setPago((x) => ({ ...x, medio }))} />
        <Campo etiqueta="Referencia (opcional)" value={pago.referencia} onChangeText={(v) => setPago((x) => ({ ...x, referencia: v }))}
          error={errores.referencia} maxLength={80} placeholder="N.º de operación o de cheque" estilo={{ marginBottom: 0 }} />
      </ConfirmDialog>
      <ConfirmDialog visible={anulando} titulo="Anular comprobante" mensaje="¿Anularlo? Queda registrado y no se puede deshacer."
        textoConfirmar="Anular" alConfirmar={anular} alCerrar={() => setAnulando(false)} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
  totales: { borderTopWidth: 1, padding: espacio.l, alignItems: 'flex-end' },
});
