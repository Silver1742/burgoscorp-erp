// Finanzas: saldos a cobrar y a pagar, lo que falta facturar (OT aprobadas por Calidad y compras
// recibidas sin la factura del proveedor) y los comprobantes.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Insignia, Boton, Campo, Opciones, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import { usePuede } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_COMPROBANTE, TIPO_COMPROBANTE, fechaCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const VISTAS = [
  { valor: 'venta', titulo: 'A cobrar' },
  { valor: 'compra', titulo: 'A pagar' },
  { valor: 'todos', titulo: 'Todos' },
];

function Saldo({ etiqueta, valor, vencido }) {
  const t = useTema();
  return (
    <Tarjeta estilo={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
      <Text style={{ color: t.textoSuave, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' }}>{etiqueta}</Text>
      <Text style={{ color: t.texto, fontSize: 20, fontWeight: '700', marginTop: 4 }}>{pesosAr(valor)}</Text>
      {Number(vencido) > 0 ? <Text style={{ color: t.error, fontSize: 13, fontWeight: '600' }}>Vencido {pesosAr(vencido)}</Text> : null}
    </Tarjeta>
  );
}

export default function Finanzas() {
  const router = useRouter();
  const puede = usePuede();
  const toast = useToast();
  const t = useTema();
  const [vista, setVista] = useState('venta');
  const [resumen, setResumen] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [facturando, setFacturando] = useState(null); // OT
  const [cargando, setCargando] = useState(null); // OC
  const [fc, setFc] = useState({ letra: 'A', punto_venta: '', numero: '', fecha_vencimiento: '' });
  const [errores, setErrores] = useState({});

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [r, p, l] = await Promise.all([
        api('/comprobantes/resumen'), api('/comprobantes/pendientes'),
        api('/comprobantes', { consulta: { limite: 50, lado: vista === 'todos' ? undefined : vista } }),
      ]);
      setResumen(r);
      setPendientes(p);
      setLista(l.data);
    } catch (err) {
      setError(err.message);
    }
  }, [vista]);
  useEffect(() => { cargar(); }, [cargar]);

  const crea = puede('FIN', 'crear');

  async function facturar() {
    try {
      const c = await api('/comprobantes/factura-venta', { metodo: 'POST', cuerpo: { orden_trabajo_id: facturando.id } });
      toast.exito(`Factura ${c.letra} ${c.numero_completo} emitida por ${pesosAr(c.total)}.`);
      router.push(`/modulos/finanzas/${c.id}`);
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function cargarFactura() {
    const e = {};
    if (!/^\d{1,5}$/.test(fc.punto_venta) || Number(fc.punto_venta) < 1) e.punto_venta = 'Ej.: 3';
    if (!/^\d{1,8}$/.test(fc.numero) || Number(fc.numero) < 1) e.numero = 'Ej.: 12345';
    if (fc.fecha_vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fc.fecha_vencimiento)) e.fecha_vencimiento = 'AAAA-MM-DD';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const c = await api('/comprobantes/factura-compra', {
        metodo: 'POST',
        cuerpo: { orden_compra_id: cargando.id, letra: fc.letra, punto_venta: Number(fc.punto_venta), numero: Number(fc.numero), fecha_vencimiento: fc.fecha_vencimiento || undefined },
      });
      toast.exito('Factura del proveedor cargada. Sacale una foto.');
      setFc({ letra: 'A', punto_venta: '', numero: '', fecha_vencimiento: '' });
      router.push(`/modulos/finanzas/${c.id}`);
      cargar();
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <Pantalla anchoMax={1140}>
      <EncabezadoPagina titulo="Finanzas" icono="cash" sub="Facturas, cobros y pagos. Comprobantes internos (sin AFIP)." />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}

      {resumen ? (
        <View style={[estilos.fila, { marginBottom: espacio.l }]}>
          <Saldo etiqueta="A cobrar" valor={resumen.a_cobrar} vencido={resumen.a_cobrar_vencido} />
          <Saldo etiqueta="A pagar" valor={resumen.a_pagar} vencido={resumen.a_pagar_vencido} />
        </View>
      ) : null}

      {pendientes && (pendientes.ordenes_trabajo.length || pendientes.ordenes_compra.length) ? (
        <Tarjeta titulo="Para facturar o cargar" icono="alert-circle-outline" sinRelleno>
          {pendientes.ordenes_trabajo.map((o, i) => (
            <FilaLista key={`ot-${o.id}`} ultima={i === pendientes.ordenes_trabajo.length - 1 && !pendientes.ordenes_compra.length}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{o.numero} · {o.cliente_nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>{o.titulo}{o.presupuesto_total ? ` · ${pesosAr(o.presupuesto_total)}` : ''}</Text>
              </View>
              {crea ? <Boton titulo="Facturar" icono="receipt-outline" chico onPress={() => setFacturando(o)} estilo={{ marginBottom: 0 }} /> : null}
            </FilaLista>
          ))}
          {pendientes.ordenes_compra.map((o, i) => (
            <FilaLista key={`oc-${o.id}`} ultima={i === pendientes.ordenes_compra.length - 1}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{o.numero} · {o.proveedor_nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>Recibida sin factura · {pesosAr(o.total)}</Text>
              </View>
              {crea ? <Boton titulo="Cargar factura" icono="camera-outline" chico variante="secundario" onPress={() => setCargando(o)} estilo={{ marginBottom: 0 }} /> : null}
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      <Opciones opciones={VISTAS} valor={vista} alCambiar={setVista} />
      <Tarjeta titulo="Comprobantes" icono="receipt-outline" sinRelleno>
        {!lista && !error ? <View style={{ padding: espacio.l }}><EsqueletoLista filas={3} /></View> : null}
        {lista?.length === 0 ? <Vacio icono="receipt-outline" titulo="No hay comprobantes" /> : null}
        {lista?.map((c, i) => (
          <FilaLista key={c.id} ultima={i === lista.length - 1} onPress={() => router.push(`/modulos/finanzas/${c.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }} numberOfLines={1}>{c.contraparte}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {[`${TIPO_COMPROBANTE[c.tipo]} ${c.letra} ${c.numero_completo}`, c.ot_numero ?? c.oc_numero].filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ color: c.vencido ? t.error : t.textoSuave, fontSize: 13, fontWeight: c.vencido ? '600' : '400' }}>
                Vence {fechaCorta(c.fecha_vencimiento)}{c.vencido ? ' · vencida' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: t.texto, fontWeight: '700' }}>{pesosAr(c.estado === 'pagado' ? c.total : c.saldo)}</Text>
              <Insignia texto={ESTADO_COMPROBANTE[c.estado].texto} tono={ESTADO_COMPROBANTE[c.estado].tono} />
            </View>
          </FilaLista>
        ))}
      </Tarjeta>

      <ConfirmDialog visible={Boolean(facturando)} titulo="Emitir factura" variante="primario" textoConfirmar="Facturar"
        mensaje={facturando ? `Factura de ${facturando.numero} a ${facturando.cliente_nombre}, con las líneas del presupuesto aprobado.` : ''}
        alConfirmar={facturar} alCerrar={() => setFacturando(null)} />

      <ConfirmDialog visible={Boolean(cargando)} titulo="Factura del proveedor" variante="primario" textoConfirmar="Cargar"
        mensaje={cargando ? `${cargando.numero} · ${cargando.proveedor_nombre}. Los ítems salen de la orden de compra.` : ''}
        alConfirmar={cargarFactura} alCerrar={() => { setCargando(null); setErrores({}); }}>
        <Opciones opciones={['A', 'B', 'C'].map((l) => ({ valor: l, titulo: `Letra ${l}` }))} valor={fc.letra} alCambiar={(letra) => setFc((x) => ({ ...x, letra }))} />
        <View style={estilos.fila}>
          <Campo etiqueta="Punto de venta" value={fc.punto_venta} onChangeText={(v) => setFc((x) => ({ ...x, punto_venta: v }))} error={errores.punto_venta}
            keyboardType="number-pad" maxLength={5} estilo={{ flex: 1 }} />
          <Campo etiqueta="Número" value={fc.numero} onChangeText={(v) => setFc((x) => ({ ...x, numero: v }))} error={errores.numero}
            keyboardType="number-pad" maxLength={8} estilo={{ flex: 2 }} />
        </View>
        <Campo etiqueta="Vence (opcional, AAAA-MM-DD)" value={fc.fecha_vencimiento} onChangeText={(v) => setFc((x) => ({ ...x, fecha_vencimiento: v }))}
          error={errores.fecha_vencimiento} maxLength={10} estilo={{ marginBottom: 0 }} />
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
});
