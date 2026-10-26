// Nueva orden de compra: proveedor, para qué OT (opcional) y los ítems. Los importes finales los
// calcula la API; acá se muestra una estimación con IVA 21 %.
// Se puede abrir con ?producto=ID (desde un producto bajo el mínimo) para que ya venga cargado.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Separador } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { cantidad, pesosAr } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const esNumero = (v, decimales) => new RegExp(`^\\d+([.,]\\d{1,${decimales}})?$`).test(v);
const aNumero = (v) => Number(String(v).replace(',', '.'));
let clave = 0;
const itemVacio = () => ({ clave: ++clave, producto_id: null, texto: null, descripcion: '', cantidad: '', precio: '', unidad: '' });

export default function NuevaOrdenCompra() {
  const { producto } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [f, setF] = useState({ proveedor_id: null, orden_trabajo_id: null, fecha_entrega_esperada: '', observaciones: '' });
  const [items, setItems] = useState([itemVacio()]);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const cambiarItem = (k, cambios) => setItems((l) => l.map((it) => (it.clave === k ? { ...it, ...cambios } : it)));

  // Desde la ficha de un producto: se propone reponer hasta el doble del mínimo (o lo que falte para las OT).
  useEffect(() => {
    if (!producto) return;
    api(`/inventario/stock/${producto}`).then((p) => {
      const sugerido = Math.max(Number(p.stock_minimo) * 2 - Number(p.stock_total), Number(p.reservado) - Number(p.stock_total), 1);
      setItems([{ ...itemVacio(), producto_id: p.id, texto: `${p.codigo} · ${p.nombre}`, unidad: p.unidad,
        cantidad: String(Math.ceil(sugerido)), precio: String(p.costo_promedio) }]);
    }).catch(() => {});
  }, [producto]);

  const subtotal = items.reduce((a, it) => a + (esNumero(it.cantidad, 3) && esNumero(it.precio, 2) ? aNumero(it.cantidad) * aNumero(it.precio) : 0), 0);

  async function crear() {
    const e = {};
    if (!f.proveedor_id) e.proveedor_id = 'Elegí el proveedor';
    if (f.fecha_entrega_esperada && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_entrega_esperada)) e.fecha_entrega_esperada = 'Formato AAAA-MM-DD';
    items.forEach((it, i) => {
      if (!it.producto_id && !it.descripcion.trim()) e[`items.${i}.descripcion`] = 'Elegí un producto o escribí qué es';
      if (!esNumero(it.cantidad, 3) || aNumero(it.cantidad) <= 0) e[`items.${i}.cantidad`] = 'Cantidad mayor a cero';
      if (!esNumero(it.precio, 2)) e[`items.${i}.precio_unitario`] = 'Precio en pesos (ej. 1250,50)';
    });
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los campos marcados.');
      return;
    }
    setEnviando(true);
    try {
      const oc = await api('/ordenes-compra', {
        metodo: 'POST',
        cuerpo: {
          proveedor_id: f.proveedor_id,
          orden_trabajo_id: f.orden_trabajo_id ?? undefined,
          fecha_entrega_esperada: f.fecha_entrega_esperada || undefined,
          observaciones: f.observaciones.trim() || undefined,
          items: items.map((it) => ({
            producto_id: it.producto_id ?? undefined,
            descripcion: it.descripcion.trim() || undefined,
            cantidad: aNumero(it.cantidad),
            precio_unitario: aNumero(it.precio),
          })),
        },
      });
      toast.exito(`${oc.numero} creada como borrador. Enviala a aprobar cuando esté lista.`);
      router.replace(`/modulos/compras/${oc.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nueva orden de compra" icono="cart" sub="Queda en borrador hasta que la envíes a aprobar." />
      <Tarjeta titulo="Proveedor" icono="business-outline">
        <Selector etiqueta="Proveedor" ruta="/proveedores" consulta={{ activo: 'true' }} valor={f.proveedor_id} alCambiar={cambiar('proveedor_id')}
          error={errores.proveedor_id} mapear={(p) => ({ titulo: p.razon_social, sub: [p.rubro, p.tercerizado ? 'Servicio tercerizado' : null].filter(Boolean).join(' · ') })} />
        <Selector etiqueta="Para la orden de trabajo (opcional)" ruta="/ordenes-trabajo" consulta={{ abiertas: '1' }} valor={f.orden_trabajo_id}
          alCambiar={cambiar('orden_trabajo_id')} opcional placeholder="Compra para stock"
          ayuda="Si es para una OT, al recibirla se le avisa al responsable."
          mapear={(o) => ({ titulo: `${o.numero} · ${o.titulo}`, sub: o.cliente_nombre ?? 'Trabajo interno' })} />
        <Campo etiqueta="Entrega esperada (opcional)" value={f.fecha_entrega_esperada} onChangeText={cambiar('fecha_entrega_esperada')}
          error={errores.fecha_entrega_esperada} placeholder="AAAA-MM-DD" maxLength={10} />
        <Campo etiqueta="Observaciones (opcional)" value={f.observaciones} onChangeText={cambiar('observaciones')} multiline maxLength={2000} estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <Tarjeta titulo="Ítems" icono="list-outline">
        {items.map((it, i) => (
          <View key={it.clave}>
            {i > 0 ? <Separador /> : null}
            <View style={estilos.cabeceraItem}>
              <Text style={{ color: t.textoSuave, fontWeight: '600' }}>Ítem {i + 1}</Text>
              {items.length > 1 ? (
                <Pressable onPress={() => setItems((l) => l.filter((x) => x.clave !== it.clave))} accessibilityRole="button" accessibilityLabel={`Quitar ítem ${i + 1}`} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={t.error} />
                </Pressable>
              ) : null}
            </View>
            <Selector etiqueta="Producto" ruta="/productos" consulta={{ activo: 'true' }} valor={it.producto_id} textoValor={it.texto} opcional
              placeholder="Servicio u otro (sin stock)" error={errores[`items.${i}.producto_id`]}
              alCambiar={(id, p) => cambiarItem(it.clave, { producto_id: id, texto: p ? `${p.codigo} · ${p.nombre}` : null, unidad: p?.unidad ?? '', precio: p && !it.precio ? String(p.costo_promedio) : it.precio })}
              mapear={(p) => ({ titulo: `${p.codigo} · ${p.nombre}`, sub: `Stock ${cantidad(p.stock_total, p.unidad)}` })} />
            {!it.producto_id ? (
              <Campo etiqueta="Descripción" value={it.descripcion} onChangeText={(v) => cambiarItem(it.clave, { descripcion: v })}
                error={errores[`items.${i}.descripcion`]} maxLength={200} placeholder="Ej.: Galvanizado de 12 soportes" />
            ) : null}
            <View style={estilos.fila}>
              <Campo etiqueta={`Cantidad${it.unidad ? ` (${it.unidad})` : ''}`} value={it.cantidad} onChangeText={(v) => cambiarItem(it.clave, { cantidad: v })}
                error={errores[`items.${i}.cantidad`]} keyboardType="decimal-pad" maxLength={12} estilo={{ flex: 1 }} />
              <Campo etiqueta="Precio unitario ($)" value={it.precio} onChangeText={(v) => cambiarItem(it.clave, { precio: v })}
                error={errores[`items.${i}.precio_unitario`]} keyboardType="decimal-pad" maxLength={15} estilo={{ flex: 1 }} />
            </View>
          </View>
        ))}
        <Boton titulo="Agregar ítem" icono="add" chico variante="secundario" onPress={() => setItems((l) => [...l, itemVacio()])} deshabilitado={items.length >= 50} />
        <View style={[estilos.total, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave }}>Subtotal {pesosAr(subtotal)} + IVA 21 %</Text>
          <Text style={{ color: t.texto, fontSize: 18, fontWeight: '700' }}>{pesosAr(Math.round(subtotal * 121) / 100)}</Text>
        </View>
      </Tarjeta>

      <Boton titulo="Crear orden de compra" icono="checkmark" onPress={crear} cargando={enviando} textoCargando="Creando…" />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.m },
  cabeceraItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.s },
  total: { borderTopWidth: 1, paddingTop: espacio.m, marginTop: espacio.s, alignItems: 'flex-end' },
});
