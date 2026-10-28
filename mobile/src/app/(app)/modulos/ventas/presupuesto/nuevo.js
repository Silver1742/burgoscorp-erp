// Nuevo presupuesto para una solicitud. Cada línea es horas de máquina (se vuelven operaciones de
// la OT), material (se reserva del stock) u otro concepto. Los precios se sugieren (costo de la
// máquina o del material con margen) y se pueden cambiar; el total final lo calcula la API.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Opciones, Separador } from '../../../../../componentes/ui';
import Selector from '../../../../../componentes/Selector';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { TIPO_ITEM, cantidad, pesosAr } from '../../../../../modulos';
import { espacio, useTema } from '../../../../../tema';

const TIPOS = ['maquina', 'material', 'mano_obra', 'tercerizado', 'otro'].map((valor) => ({ valor, titulo: TIPO_ITEM[valor] }));
// Margen sugerido sobre el costo (se puede corregir en cada línea).
const MARGEN_MAQUINA = 1.5;
const MARGEN_MATERIAL = 1.3;
const esNumero = (v, dec) => new RegExp(`^\\d+([.,]\\d{1,${dec}})?$`).test(v);
const aNumero = (v) => Number(String(v).replace(',', '.'));
const redondear = (n) => String(Math.round(n));
let clave = 0;
const lineaVacia = (tipo = 'maquina') => ({ clave: ++clave, tipo, ref: null, texto: null, descripcion: '', cantidad: '1', unidad: tipo === 'maquina' ? 'h' : 'un', precio: '' });

export default function NuevoPresupuesto() {
  const { solicitud } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [sol, setSol] = useState(null);
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [f, setF] = useState({ plazo: '7', validez: '15', observaciones: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiarLinea = (k, cambios) => setLineas((l) => l.map((x) => (x.clave === k ? { ...x, ...cambios } : x)));

  useEffect(() => {
    if (solicitud) api(`/solicitudes/${solicitud}`).then(setSol).catch((err) => toast.error(err.message));
  }, [solicitud, toast]);

  const subtotal = lineas.reduce((a, l) => a + (esNumero(l.cantidad, 3) && esNumero(l.precio, 2) ? aNumero(l.cantidad) * aNumero(l.precio) : 0), 0);

  async function crear() {
    const e = {};
    lineas.forEach((l, i) => {
      if (l.tipo === 'maquina' && !l.ref) e[`items.${i}.centro_trabajo_id`] = 'Elegí la máquina';
      if (!l.descripcion.trim()) e[`items.${i}.descripcion`] = 'Describí la línea';
      if (!esNumero(l.cantidad, 3) || aNumero(l.cantidad) <= 0) e[`items.${i}.cantidad`] = 'Cantidad mayor a cero';
      if (!esNumero(l.precio, 2)) e[`items.${i}.precio_unitario`] = 'Precio en pesos';
    });
    if (!/^\d{1,3}$/.test(f.plazo)) e.plazo_entrega_dias = 'Días (ej. 7)';
    if (!/^\d{1,3}$/.test(f.validez)) e.validez_dias = 'Días (ej. 15)';
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los campos marcados.');
      return;
    }
    setEnviando(true);
    try {
      const p = await api('/presupuestos', {
        metodo: 'POST',
        cuerpo: {
          solicitud_id: Number(solicitud),
          plazo_entrega_dias: Number(f.plazo), validez_dias: Number(f.validez), observaciones: f.observaciones.trim() || undefined,
          items: lineas.map((l) => ({
            tipo: l.tipo, descripcion: l.descripcion.trim(), cantidad: aNumero(l.cantidad), unidad: l.unidad, precio_unitario: aNumero(l.precio),
            centro_trabajo_id: l.tipo === 'maquina' ? l.ref : undefined,
            producto_id: l.tipo === 'material' && l.ref ? l.ref : undefined,
          })),
        },
      });
      toast.exito(`${p.numero} creado en borrador. Revisalo y envialo al cliente.`);
      router.replace(`/modulos/ventas/presupuesto/${p.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nuevo presupuesto" icono="calculator" sub={sol ? `${sol.numero} · ${sol.cliente_nombre}: ${sol.titulo}` : 'Cargando la solicitud…'} />

      <Tarjeta titulo="Líneas" icono="list-outline">
        {lineas.map((l, i) => (
          <View key={l.clave}>
            {i > 0 ? <Separador /> : null}
            <View style={estilos.cabecera}>
              <Text style={{ color: t.textoSuave, fontWeight: '600' }}>Línea {i + 1}</Text>
              {lineas.length > 1 ? (
                <Pressable onPress={() => setLineas((x) => x.filter((y) => y.clave !== l.clave))} accessibilityRole="button" accessibilityLabel={`Quitar línea ${i + 1}`} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={t.error} />
                </Pressable>
              ) : null}
            </View>
            <Opciones opciones={TIPOS} valor={l.tipo} alCambiar={(tipo) => cambiarLinea(l.clave, { ...lineaVacia(tipo), clave: l.clave })} />
            {l.tipo === 'maquina' ? (
              <Selector etiqueta="Máquina" ruta="/maquinas" valor={l.ref} textoValor={l.texto} error={errores[`items.${i}.centro_trabajo_id`]}
                alCambiar={(id, m) => cambiarLinea(l.clave, {
                  ref: id, texto: m ? `${m.codigo} · ${m.nombre}` : null, descripcion: l.descripcion || (m?.nombre ?? ''),
                  precio: m ? redondear(Number(m.costo_hora) * MARGEN_MAQUINA) : l.precio,
                })}
                mapear={(m) => ({ titulo: `${m.codigo} · ${m.nombre}`, sub: `${m.area_nombre} · costo ${pesosAr(m.costo_hora)}/h` })} />
            ) : null}
            {l.tipo === 'material' ? (
              <Selector etiqueta="Material del stock (opcional)" ruta="/productos" consulta={{ activo: 'true' }} valor={l.ref} textoValor={l.texto} opcional
                placeholder="Material comprado aparte"
                alCambiar={(id, p) => cambiarLinea(l.clave, {
                  ref: id, texto: p ? `${p.codigo} · ${p.nombre}` : null, descripcion: l.descripcion || (p?.nombre ?? ''), unidad: p?.unidad ?? l.unidad,
                  precio: p ? redondear(Number(p.precio_venta ?? Number(p.costo_promedio) * MARGEN_MATERIAL)) : l.precio,
                })}
                mapear={(p) => ({ titulo: `${p.codigo} · ${p.nombre}`, sub: `Stock ${cantidad(p.stock_total, p.unidad)}` })} />
            ) : null}
            <Campo etiqueta="Descripción" value={l.descripcion} onChangeText={(v) => cambiarLinea(l.clave, { descripcion: v })}
              error={errores[`items.${i}.descripcion`]} maxLength={200} placeholder={l.tipo === 'maquina' ? 'Ej.: Rolado y soldadura MIG' : ''} />
            <View style={estilos.fila}>
              <Campo etiqueta={`Cantidad (${l.unidad})`} value={l.cantidad} onChangeText={(v) => cambiarLinea(l.clave, { cantidad: v })}
                error={errores[`items.${i}.cantidad`]} keyboardType="decimal-pad" maxLength={12} estilo={{ flex: 1 }} />
              <Campo etiqueta={`Precio por ${l.unidad} ($)`} value={l.precio} onChangeText={(v) => cambiarLinea(l.clave, { precio: v })}
                error={errores[`items.${i}.precio_unitario`]} keyboardType="decimal-pad" maxLength={15} estilo={{ flex: 1 }} />
            </View>
          </View>
        ))}
        <Boton titulo="Agregar línea" icono="add" chico variante="secundario" onPress={() => setLineas((l) => [...l, lineaVacia()])} deshabilitado={lineas.length >= 60} />
        <View style={[estilos.total, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave }}>Subtotal {pesosAr(subtotal)} + IVA 21 %</Text>
          <Text style={{ color: t.texto, fontSize: 18, fontWeight: '700' }}>{pesosAr(Math.round(subtotal * 121) / 100)}</Text>
        </View>
      </Tarjeta>

      <Tarjeta titulo="Condiciones" icono="document-text-outline">
        <View style={estilos.fila}>
          <Campo etiqueta="Plazo de entrega (días)" value={f.plazo} onChangeText={(v) => setF((x) => ({ ...x, plazo: v }))} error={errores.plazo_entrega_dias}
            keyboardType="number-pad" maxLength={3} estilo={{ flex: 1 }} />
          <Campo etiqueta="Validez (días)" value={f.validez} onChangeText={(v) => setF((x) => ({ ...x, validez: v }))} error={errores.validez_dias}
            keyboardType="number-pad" maxLength={3} estilo={{ flex: 1 }} />
        </View>
        <Campo etiqueta="Observaciones (opcional)" value={f.observaciones} onChangeText={(v) => setF((x) => ({ ...x, observaciones: v }))}
          multiline maxLength={2000} estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <Boton titulo="Crear presupuesto" icono="checkmark" onPress={crear} cargando={enviando} textoCargando="Creando…" deshabilitado={!sol} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.m },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.s },
  total: { borderTopWidth: 1, paddingTop: espacio.m, marginTop: espacio.s, alignItems: 'flex-end' },
});
