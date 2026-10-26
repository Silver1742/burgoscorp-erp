// Materiales de una orden de trabajo: el jefe reserva (y ve si falta), el operario registra lo
// que usa. Si no alcanza, la API le avisa a Abastecimiento para que compre.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Tarjeta, FilaLista, Insignia, Boton, Campo, Esqueleto, ErrorCarga, Vacio } from './ui';
import ConfirmDialog from './ConfirmDialog';
import Selector from './Selector';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { cantidad } from '../modulos';
import { espacio, useTema } from '../tema';

const esCantidad = (v) => /^\d+([.,]\d{1,3})?$/.test(v) && Number(v.replace(',', '.')) > 0;
const aNumero = (v) => Number(String(v).replace(',', '.'));

/** `tareaId`: si se abre desde una operación, el consumo queda asociado a ella. */
export default function MaterialesOt({ otId, tareaId, alCambiar }) {
  const t = useTema();
  const toast = useToast();
  const router = useRouter();
  const [lista, setLista] = useState(null);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState(null);
  const [reservando, setReservando] = useState(null); // { producto_id, texto, unidad, disponible, cantidad }
  const [usando, setUsando] = useState(null);         // { reserva, cantidad }
  const [liberando, setLiberando] = useState(null);
  const [errores, setErrores] = useState({});

  const aplicar = (r) => { setLista(r.data); setMeta(r.meta); };
  const cargar = useCallback(async () => {
    setError(null);
    try {
      aplicar(await api(`/ordenes-trabajo/${otId}/materiales`));
    } catch (err) {
      setError(err.message);
    }
  }, [otId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function reservar() {
    const e = {};
    if (!reservando.producto_id) e.producto_id = 'Elegí el material';
    if (!esCantidad(reservando.cantidad)) e.cantidad = 'Cantidad mayor a cero (hasta 3 decimales)';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const r = await api(`/ordenes-trabajo/${otId}/materiales`, { metodo: 'POST', cuerpo: { producto_id: reservando.producto_id, cantidad: aNumero(reservando.cantidad) } });
      aplicar(r);
      if (r.meta.faltante > 0) toast.info(`Reservado. Faltan ${cantidad(r.meta.faltante, reservando.unidad)}: se le avisó a Abastecimiento para que compre.`);
      else toast.exito('Material reservado para la orden.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function usar() {
    if (!esCantidad(usando.cantidad)) {
      setErrores({ usar: 'Cantidad mayor a cero' });
      throw new Error('datos inválidos');
    }
    try {
      aplicar(await api(`/ordenes-trabajo/${otId}/materiales/${usando.reserva.id}/consumir`, { metodo: 'POST', cuerpo: { cantidad: aNumero(usando.cantidad), tarea_id: tareaId ?? undefined } }));
      toast.exito('Consumo registrado. Se descontó del stock.');
      alCambiar?.();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function liberar() {
    try {
      aplicar(await api(`/ordenes-trabajo/${otId}/materiales/${liberando.id}`, { metodo: 'DELETE' }));
      toast.exito('Reserva liberada.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <Tarjeta titulo="Materiales" icono="cube-outline" sinRelleno
      derecha={meta.puede_reservar ? (
        <Boton titulo="Reservar" icono="add" chico onPress={() => { setErrores({}); setReservando({ producto_id: null, texto: null, unidad: '', disponible: null, cantidad: '' }); }} />
      ) : null}>
      {error ? <ErrorCarga error={error} onReintentar={cargar} /> : null}
      {lista === null && !error ? <View style={{ padding: espacio.l }}><Esqueleto /></View> : null}
      {lista?.length === 0 ? (
        <Vacio icono="cube-outline" titulo="Sin material reservado" texto={meta.puede_reservar ? 'Reservá lo que necesita el trabajo: así se aparta del stock y, si falta, se avisa a Abastecimiento.' : null} />
      ) : null}
      {lista?.map((r, i) => (
        <FilaLista key={r.id} ultima={i === lista.length - 1}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.texto, fontWeight: '600' }} onPress={() => router.push(`/modulos/inventario/${r.producto_id}`)}>{r.producto_nombre}</Text>
            <Text style={{ color: t.textoSuave, fontSize: 13 }}>
              {r.producto_codigo} · usado {cantidad(r.cantidad_consumida)} de {cantidad(r.cantidad, r.unidad)}
            </Text>
            {r.faltante > 0 ? <Text style={{ color: t.error, fontSize: 13, fontWeight: '600' }}>Faltan {cantidad(r.faltante, r.unidad)} · Abastecimiento avisado</Text> : null}
            {r.estado === 'activa' && (meta.puede_consumir || meta.puede_reservar) ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.s }}>
                {meta.puede_consumir ? (
                  <Boton titulo="Usar" icono="remove-circle-outline" chico variante="secundario" estilo={{ marginBottom: 0 }}
                    onPress={() => { setErrores({}); setUsando({ reserva: r, cantidad: String(r.pendiente) }); }} />
                ) : null}
                {meta.puede_reservar ? <Boton titulo="Liberar" chico variante="contornoPeligro" estilo={{ marginBottom: 0 }} onPress={() => setLiberando(r)} /> : null}
              </View>
            ) : null}
          </View>
          {r.estado === 'consumida' ? <Insignia texto="Usado" tono="exito" />
            : r.faltante > 0 ? <Insignia texto="Falta" tono="error" /> : <Insignia texto="Reservado" tono="negro" />}
        </FilaLista>
      ))}

      <ConfirmDialog visible={Boolean(reservando)} titulo="Reservar material" textoConfirmar="Reservar" variante="primario"
        alConfirmar={reservar} alCerrar={() => setReservando(null)}>
        {reservando ? (
          <>
            <Selector etiqueta="Material" ruta="/inventario/stock" valor={reservando.producto_id} textoValor={reservando.texto} error={errores.producto_id}
              alCambiar={(pid, p) => setReservando((x) => ({ ...x, producto_id: pid, texto: p ? `${p.codigo} · ${p.nombre}` : null, unidad: p?.unidad ?? '', disponible: p?.disponible ?? null }))}
              mapear={(p) => ({ titulo: `${p.codigo} · ${p.nombre}`, sub: `Disponible ${cantidad(p.disponible, p.unidad)}${p.bajo_minimo ? ' · bajo mínimo' : ''}` })} />
            <Campo etiqueta={`Cantidad${reservando.unidad ? ` (${reservando.unidad})` : ''}`} value={reservando.cantidad}
              onChangeText={(v) => setReservando((x) => ({ ...x, cantidad: v }))} error={errores.cantidad} keyboardType="decimal-pad" maxLength={12}
              ayuda={reservando.disponible !== null ? `Disponible ahora: ${cantidad(reservando.disponible, reservando.unidad)}` : undefined} estilo={{ marginBottom: 0 }} />
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(usando)} titulo="Registrar material usado" textoConfirmar="Descontar" variante="primario"
        mensaje={usando ? `${usando.reserva.producto_nombre}: quedan ${cantidad(usando.reserva.pendiente, usando.reserva.unidad)} reservados.` : ''}
        alConfirmar={usar} alCerrar={() => setUsando(null)}>
        {usando ? (
          <Campo etiqueta={`Cantidad usada (${usando.reserva.unidad})`} value={usando.cantidad} onChangeText={(v) => setUsando((x) => ({ ...x, cantidad: v }))}
            error={errores.usar} keyboardType="decimal-pad" maxLength={12} estilo={{ marginBottom: 0 }} />
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(liberando)} titulo="Liberar reserva"
        mensaje={liberando ? `¿Liberar lo que queda reservado de ${liberando.producto_nombre}? Vuelve a estar disponible para otras órdenes.` : ''}
        textoConfirmar="Liberar" alConfirmar={liberar} alCerrar={() => setLiberando(null)} />
    </Tarjeta>
  );
}
