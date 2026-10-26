// Ficha de un producto: stock por depósito, para qué OT está reservado, compras en camino y
// movimientos. Abastecimiento ajusta (conteo físico) y transfiere entre depósitos.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Campo, Opciones, Esqueleto, ErrorCarga, Vacio,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import EtiquetaQR from '../../../../componentes/EtiquetaQR';
import { usePuede } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_OC, TIPO_MOVIMIENTO, TIPO_PRODUCTO, cantidad, fechaCorta, fechaHoraCorta, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const esCantidad = (v) => /^\d+([.,]\d{1,3})?$/.test(v) && Number(v.replace(',', '.')) > 0;
const aNumero = (v) => Number(v.replace(',', '.'));

/** Diálogo de ajuste (+/−) o de transferencia entre depósitos. */
function Movimiento({ modo, producto, alCerrar, alGuardar }) {
  const t = useTema();
  const toast = useToast();
  const depositos = producto.depositos;
  const [f, setF] = useState({ tipo: 'ajuste_positivo', deposito: depositos[0]?.id, hacia: depositos[1]?.id, cantidad: '', observacion: '' });
  const [errores, setErrores] = useState({});
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const opcionesDeposito = depositos.map((d) => ({ valor: d.id, titulo: `${d.codigo} (${cantidad(d.cantidad)})` }));

  async function guardar() {
    const e = {};
    if (!esCantidad(f.cantidad)) e.cantidad = 'Cantidad mayor a cero (hasta 3 decimales)';
    if (modo === 'ajuste' && f.observacion.trim().length < 3) e.observacion = 'Contá el motivo (conteo, rotura, pérdida…)';
    if (modo === 'transferencia' && f.deposito === f.hacia) e.hacia = 'Elegí otro depósito';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos inválidos');
    try {
      const r = modo === 'ajuste'
        ? await api('/inventario/ajustes', { metodo: 'POST', cuerpo: { producto_id: producto.id, deposito_id: f.deposito, tipo: f.tipo, cantidad: aNumero(f.cantidad), observacion: f.observacion.trim() } })
        : await api('/inventario/transferencias', { metodo: 'POST', cuerpo: { producto_id: producto.id, desde_deposito_id: f.deposito, hacia_deposito_id: f.hacia, cantidad: aNumero(f.cantidad), observacion: f.observacion.trim() || undefined } });
      toast.exito(modo === 'ajuste' ? 'Stock ajustado.' : 'Transferencia registrada.');
      alGuardar(r);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <ConfirmDialog visible titulo={modo === 'ajuste' ? 'Ajustar stock' : 'Transferir entre depósitos'} textoConfirmar="Guardar" variante="primario"
      alConfirmar={guardar} alCerrar={alCerrar}>
      {modo === 'ajuste' ? (
        <Opciones opciones={[{ valor: 'ajuste_positivo', titulo: 'Sumar', icono: 'add' }, { valor: 'ajuste_negativo', titulo: 'Restar', icono: 'remove' }]}
          valor={f.tipo} alCambiar={cambiar('tipo')} />
      ) : null}
      <Text style={[estilos.etiqueta, { color: t.textoSuave }]}>{modo === 'ajuste' ? 'Depósito' : 'Desde'}</Text>
      <Opciones opciones={opcionesDeposito} valor={f.deposito} alCambiar={cambiar('deposito')} />
      {modo === 'transferencia' ? (
        <>
          <Text style={[estilos.etiqueta, { color: t.textoSuave }]}>Hacia</Text>
          <Opciones opciones={opcionesDeposito} valor={f.hacia} alCambiar={cambiar('hacia')} />
          {errores.hacia ? <Text style={{ color: t.error, marginBottom: espacio.s }}>{errores.hacia}</Text> : null}
        </>
      ) : null}
      <Campo etiqueta={`Cantidad (${producto.unidad})`} value={f.cantidad} onChangeText={cambiar('cantidad')} error={errores.cantidad} keyboardType="decimal-pad" maxLength={12} />
      <Campo etiqueta={modo === 'ajuste' ? 'Motivo' : 'Observación (opcional)'} value={f.observacion} onChangeText={cambiar('observacion')}
        error={errores.observacion} maxLength={255} estilo={{ marginBottom: 0 }} />
    </ConfirmDialog>
  );
}

export default function Producto() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const puede = usePuede();
  const t = useTema();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setP(await api(`/inventario/stock/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!p) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const gestiona = puede('INV', 'editar');
  const falta = Math.max(0, Number(p.reservado) - Number(p.stock_total));

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: p.codigo }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.codigo, { color: t.primario }]}>{p.codigo}</Text>
          <Insignia texto={TIPO_PRODUCTO[p.tipo]} />
          {p.bajo_minimo ? <Insignia texto="Bajo mínimo" tono="error" icono="alert-circle" /> : null}
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{p.nombre}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Hay">{cantidad(p.stock_total, p.unidad)}</Dato>
          <Dato etiqueta="Reservado para OT">{cantidad(p.reservado, p.unidad)}</Dato>
          <Dato etiqueta="Disponible">{cantidad(p.disponible, p.unidad)}</Dato>
          <Dato etiqueta="En camino">{cantidad(p.en_camino, p.unidad)}</Dato>
          <Dato etiqueta="Mínimo">{cantidad(p.stock_minimo, p.unidad)}</Dato>
          <Dato etiqueta="Costo promedio">{`${pesosAr(p.costo_promedio)} / ${p.unidad}`}</Dato>
        </View>
        {falta > 0 ? <Text style={{ color: t.error, fontWeight: '600', marginBottom: espacio.s }}>Faltan {cantidad(falta, p.unidad)} para cubrir lo reservado.</Text> : null}
        <View style={estilos.fila}>
          <EtiquetaQR codigo={`BC:PRD:${p.codigo}`} titulo={p.nombre} sub={p.codigo} textoBoton="QR del estante" />
          {gestiona ? <Boton titulo="Ajustar" icono="create-outline" chico variante="secundario" onPress={() => setModo('ajuste')} estilo={{ marginBottom: 0 }} /> : null}
          {gestiona && p.depositos.length > 1 ? <Boton titulo="Transferir" icono="swap-horizontal" chico variante="secundario" onPress={() => setModo('transferencia')} estilo={{ marginBottom: 0 }} /> : null}
          {puede('COM', 'crear') && (p.bajo_minimo || falta > 0) ? (
            <Boton titulo="Pedir compra" icono="cart-outline" chico onPress={() => router.push({ pathname: '/modulos/compras/nueva', params: { producto: p.id } })} estilo={{ marginBottom: 0 }} />
          ) : null}
        </View>
      </Tarjeta>

      <Tarjeta titulo="Por depósito" icono="business-outline" sinRelleno>
        {p.depositos.map((d, i) => (
          <FilaLista key={d.id} ultima={i === p.depositos.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{d.nombre}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>{d.codigo}</Text>
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{cantidad(d.cantidad, p.unidad)}</Text>
          </FilaLista>
        ))}
      </Tarjeta>

      <Tarjeta titulo="Reservado para órdenes de trabajo" icono="clipboard-outline" sinRelleno>
        {p.reservas.length === 0 ? <Vacio icono="clipboard-outline" titulo="Nada reservado" /> : null}
        {p.reservas.map((r, i) => (
          <FilaLista key={r.id} ultima={i === p.reservas.length - 1} onPress={() => router.push(`/modulos/produccion/${r.orden_trabajo_id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.primario, fontWeight: '700', fontSize: 13 }}>{r.ot_numero}</Text>
              <Text style={{ color: t.texto }} numberOfLines={1}>{r.ot_titulo}</Text>
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{cantidad(r.cantidad - r.cantidad_consumida, p.unidad)}</Text>
          </FilaLista>
        ))}
      </Tarjeta>

      {p.compras.length ? (
        <Tarjeta titulo="Compras en curso" icono="cart-outline" sinRelleno>
          {p.compras.map((c, i) => (
            <FilaLista key={c.id} ultima={i === p.compras.length - 1} onPress={() => router.push(`/modulos/compras/${c.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.primario, fontWeight: '700', fontSize: 13 }}>{c.numero}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>{c.proveedor_nombre} · llega {fechaCorta(c.fecha_entrega_esperada)}</Text>
              </View>
              <Insignia texto={ESTADO_OC[c.estado].texto} tono={ESTADO_OC[c.estado].tono} />
              <Text style={{ color: t.texto, fontWeight: '600' }}>{cantidad(c.pendiente, p.unidad)}</Text>
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      <Tarjeta titulo="Últimos movimientos" icono="swap-vertical-outline" sinRelleno>
        {p.movimientos.length === 0 ? <Vacio icono="swap-vertical-outline" titulo="Sin movimientos" /> : null}
        {p.movimientos.map((m, i) => {
          const tipo = TIPO_MOVIMIENTO[m.tipo];
          return (
            <FilaLista key={m.id} ultima={i === p.movimientos.length - 1}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{tipo.texto}{m.ref_numero ? ` · ${m.ref_numero}` : ''}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={2}>
                  {[fechaHoraCorta(m.created_at), m.deposito_codigo, m.usuario_nombre, m.observacion].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={{ color: tipo.signo === '+' ? t.exito : t.error, fontWeight: '700' }}>{tipo.signo}{cantidad(m.cantidad)}</Text>
            </FilaLista>
          );
        })}
      </Tarjeta>

      {modo ? <Movimiento modo={modo} producto={p} alCerrar={() => setModo(null)} alGuardar={(r) => setP(r)} /> : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  codigo: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
  etiqueta: { fontSize: 14, marginBottom: 6 },
});
