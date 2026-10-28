// Detalle de una orden de compra: ítems, aprobación, envío, recepción en el depósito y la foto
// del remito o la factura del proveedor.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Campo, Opciones, BarraProgreso, Esqueleto, ErrorCarga,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Contacto from '../../../../componentes/Contacto';
import EtiquetaQR from '../../../../componentes/EtiquetaQR';
import Fotos from '../../../../componentes/Fotos';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_OC, cantidad, fechaCorta, fechaHoraCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const esCantidad = (v) => /^\d+([.,]\d{1,3})?$/.test(v);
const aNumero = (v) => Number(String(v).replace(',', '.'));

/** Recepción: en qué depósito entra, número de remito y cuánto llegó de cada ítem. */
function Recepcion({ oc, alCerrar, alGuardar }) {
  const t = useTema();
  const toast = useToast();
  const pendientes = oc.items.filter((i) => Number(i.cantidad) > Number(i.cantidad_recibida));
  const [depositos, setDepositos] = useState([]);
  const [deposito, setDeposito] = useState(null);
  const [remito, setRemito] = useState('');
  const [cant, setCant] = useState(Object.fromEntries(pendientes.map((i) => [i.id, String(Number(i.cantidad) - Number(i.cantidad_recibida))])));
  const [errores, setErrores] = useState({});

  useEffect(() => {
    // Sin depósito elegido de antemano: que quien recibe confirme dónde lo guarda.
    api('/depositos', { consulta: { activo: 'true', limite: 20 } }).then((r) => setDepositos(r.data)).catch((err) => toast.error(err.message));
  }, [toast]);

  async function guardar() {
    const e = {};
    const items = [];
    for (const i of pendientes) {
      const v = cant[i.id] ?? '';
      if (v === '' || aNumero(v) === 0) continue;
      if (!esCantidad(v)) e[i.id] = 'Cantidad inválida';
      else if (aNumero(v) > Number(i.cantidad) - Number(i.cantidad_recibida)) e[i.id] = 'Es más de lo que falta recibir';
      else items.push({ item_id: i.id, cantidad: aNumero(v) });
    }
    if (!items.length && !Object.keys(e).length) e.general = 'Cargá cuánto llegó de al menos un ítem';
    if (remito && !/^[A-Za-z0-9 -]*$/.test(remito)) e.remito = 'Solo letras, números y guiones';
    if (!deposito) e.deposito = 'Elegí en qué depósito entra';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const r = await api(`/ordenes-compra/${oc.id}/recibir`, { metodo: 'POST', cuerpo: { deposito_id: deposito, remito: remito.trim() || undefined, items } });
      toast.exito(r.estado === 'recibida' ? `${r.numero} recibida completa. Ya está en el stock.` : 'Recepción registrada. Queda una parte por llegar.');
      alGuardar(r);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <ConfirmDialog visible titulo="Recibir mercadería" textoConfirmar="Ingresar al stock" variante="primario" alConfirmar={guardar} alCerrar={alCerrar}>
      <Text style={[estilos.etiqueta, { color: t.textoSuave }]}>Depósito</Text>
      <Opciones opciones={depositos.map((d) => ({ valor: d.id, titulo: d.codigo }))} valor={deposito} alCambiar={setDeposito} />
      {errores.deposito ? <Text style={{ color: t.error, marginBottom: espacio.s }}>{errores.deposito}</Text> : null}
      <Campo etiqueta="Número de remito (opcional)" value={remito} onChangeText={setRemito} error={errores.remito} maxLength={30} autoCapitalize="characters" />
      {pendientes.map((i) => (
        <Campo key={i.id} etiqueta={`${i.descripcion} (faltan ${cantidad(Number(i.cantidad) - Number(i.cantidad_recibida), i.unidad)})`}
          value={cant[i.id]} onChangeText={(v) => setCant((c) => ({ ...c, [i.id]: v }))} error={errores[i.id]} keyboardType="decimal-pad" maxLength={12} />
      ))}
      {errores.general ? <Text style={{ color: t.error }}>{errores.general}</Text> : null}
    </ConfirmDialog>
  );
}

export default function DetalleOrdenCompra() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [oc, setOc] = useState(null);
  const [error, setError] = useState(null);
  const [accion, setAccion] = useState(null); // enviar-aprobacion | aprobar | enviar | rechazar | cancelar
  const [motivo, setMotivo] = useState('');
  const [recibiendo, setRecibiendo] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setOc(await api(`/ordenes-compra/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const ACCIONES = {
    'enviar-aprobacion': { titulo: 'Enviar a aprobar', mensaje: 'La jefa de Abastecimiento recibe el aviso para aprobarla.', exito: 'Enviada a aprobar.' },
    aprobar: { titulo: 'Aprobar', mensaje: '¿Aprobar la compra por el total indicado?', exito: 'Orden de compra aprobada.' },
    enviar: { titulo: 'Marcar enviada', mensaje: '¿Ya se le mandó el pedido al proveedor?', exito: 'Marcada como enviada al proveedor.' },
    rechazar: { titulo: 'Devolver a borrador', mensaje: 'Contá qué hay que corregir.', exito: 'Devuelta a borrador.', conMotivo: true },
    cancelar: { titulo: 'Cancelar orden', mensaje: '¿Cancelar la orden de compra? No se puede deshacer.', exito: 'Orden de compra cancelada.', peligro: true },
  };

  async function ejecutar() {
    const a = ACCIONES[accion];
    if (a.conMotivo && !motivo.trim()) {
      toast.error('Escribí el motivo.');
      throw new Error('sin motivo');
    }
    try {
      const r = await api(`/ordenes-compra/${id}/${accion}`, {
        metodo: 'POST',
        cuerpo: ['rechazar', 'cancelar'].includes(accion) ? { comentario: motivo.trim() || undefined } : undefined,
      });
      setOc(r);
      setMotivo('');
      toast.exito(a.exito);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!oc) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const recibido = oc.items.reduce((a, i) => a + Math.min(Number(i.cantidad_recibida), Number(i.cantidad)), 0);
  const pedido = oc.items.reduce((a, i) => a + Number(i.cantidad), 0);
  const a = accion ? ACCIONES[accion] : null;

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: oc.numero }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{oc.numero}</Text>
          <Insignia texto={ESTADO_OC[oc.estado].texto} tono={ESTADO_OC[oc.estado].tono} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{oc.proveedor_nombre}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Total con IVA">{pesosAr(oc.total)}</Dato>
          <Dato etiqueta="Fecha">{fechaCorta(oc.fecha)}</Dato>
          <Dato etiqueta="Entrega esperada">{fechaCorta(oc.fecha_entrega_esperada)}</Dato>
          <Dato etiqueta="Pidió">{oc.solicitado_por_nombre}</Dato>
          {oc.aprobado_por_nombre ? <Dato etiqueta="Aprobó">{oc.aprobado_por_nombre}</Dato> : null}
          {oc.ot_numero ? <Dato etiqueta="Para la OT">{`${oc.ot_numero} · ${oc.ot_titulo}`}</Dato> : null}
        </View>
        {oc.observaciones ? <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>{oc.observaciones}</Text> : null}
        <Contacto telefono={oc.proveedor_telefono} mensaje={`Hola, te escribimos de BurgosCorp por la orden de compra ${oc.numero}.`} />
        {['recibida_parcial', 'recibida'].includes(oc.estado) ? (
          <>
            <BarraProgreso valor={recibido} total={pedido} conTexto={false} />
            <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 4 }}>Recibido {Math.round((recibido / pedido) * 100)} % de lo pedido</Text>
          </>
        ) : null}
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          {oc.puede_enviar_aprobacion ? <Boton titulo="Enviar a aprobar" icono="send-outline" chico onPress={() => setAccion('enviar-aprobacion')} estilo={{ marginBottom: 0 }} /> : null}
          {oc.puede_aprobar ? <Boton titulo="Aprobar" icono="checkmark-done" chico variante="exito" onPress={() => setAccion('aprobar')} estilo={{ marginBottom: 0 }} /> : null}
          {oc.puede_aprobar ? <Boton titulo="Devolver" icono="arrow-undo-outline" chico variante="secundario" onPress={() => setAccion('rechazar')} estilo={{ marginBottom: 0 }} /> : null}
          {oc.puede_enviar ? <Boton titulo="Marcar enviada" icono="paper-plane-outline" chico onPress={() => setAccion('enviar')} estilo={{ marginBottom: 0 }} /> : null}
          {oc.puede_recibir ? <Boton titulo="Recibir" icono="download-outline" chico variante="exito" onPress={() => setRecibiendo(true)} estilo={{ marginBottom: 0 }} /> : null}
          <EtiquetaQR codigo={`BC:OC:${oc.numero}`} titulo={oc.numero} sub={oc.proveedor_nombre} textoBoton="QR" />
          {oc.ot_numero ? <Boton titulo="Ver OT" icono="clipboard-outline" chico variante="texto" onPress={() => router.push(`/modulos/produccion/${oc.orden_trabajo_id}`)} estilo={{ marginBottom: 0 }} /> : null}
          {oc.puede_cancelar ? <Boton titulo="Cancelar" chico variante="contornoPeligro" onPress={() => setAccion('cancelar')} estilo={{ marginBottom: 0 }} /> : null}
        </View>
      </Tarjeta>

      <Tarjeta titulo="Ítems" icono="list-outline" sinRelleno>
        {oc.items.map((i, n) => (
          <FilaLista key={i.id} ultima={n === oc.items.length - 1} onPress={i.producto_id ? () => router.push(`/modulos/inventario/${i.producto_id}`) : undefined}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{i.descripcion}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {[i.producto_codigo, `${cantidad(i.cantidad, i.unidad)} × ${pesosAr(i.precio_unitario)}`, `IVA ${i.iva_alicuota} %`].filter(Boolean).join(' · ')}
              </Text>
              {Number(i.cantidad_recibida) > 0 ? (
                <Text style={{ color: Number(i.cantidad_recibida) >= Number(i.cantidad) ? t.exito : t.avisoTexto, fontSize: 13 }}>
                  Recibido {cantidad(i.cantidad_recibida)} de {cantidad(i.cantidad, i.unidad)}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{pesosAr(i.subtotal)}</Text>
          </FilaLista>
        ))}
        <View style={[estilos.totales, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave }}>Subtotal {pesosAr(oc.subtotal)} · IVA {pesosAr(oc.iva_monto)}</Text>
          <Text style={{ color: t.texto, fontSize: 17, fontWeight: '700' }}>{pesosAr(oc.total)}</Text>
        </View>
      </Tarjeta>

      <Fotos key={oc.estado} entidad="orden_compra" entidadId={oc.id} titulo="Remito y factura del proveedor"
        vacio="Al recibir, sacale una foto al remito firmado y a la factura." />

      {oc.recepciones.length ? (
        <Tarjeta titulo="Recepciones" icono="download-outline" sinRelleno>
          {oc.recepciones.map((r, n) => (
            <FilaLista key={`${r.created_at}-${n}`} ultima={n === oc.recepciones.length - 1}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{r.producto_nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                  {[fechaHoraCorta(r.created_at), r.deposito_codigo, r.usuario_nombre, r.observacion].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={{ color: t.exito, fontWeight: '700' }}>+{cantidad(r.cantidad, r.unidad)}</Text>
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      <ConfirmDialog visible={Boolean(a)} titulo={a?.titulo ?? ''} mensaje={a?.mensaje ?? ''} textoConfirmar={a?.titulo ?? ''}
        variante={a?.peligro ? 'peligro' : 'primario'} alConfirmar={ejecutar} alCerrar={() => { setAccion(null); setMotivo(''); }}>
        {a?.conMotivo || accion === 'cancelar' ? (
          <Campo etiqueta={a?.conMotivo ? 'Motivo' : 'Motivo (opcional)'} value={motivo} onChangeText={setMotivo} maxLength={500} multiline estilo={{ marginBottom: 0 }} />
        ) : null}
      </ConfirmDialog>
      {recibiendo ? <Recepcion oc={oc} alCerrar={() => setRecibiendo(false)} alGuardar={setOc} /> : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
  totales: { borderTopWidth: 1, padding: espacio.l, alignItems: 'flex-end' },
  etiqueta: { fontSize: 14, marginBottom: 6 },
});
