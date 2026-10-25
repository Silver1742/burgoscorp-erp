// Alta de una orden de trabajo. Después se le agregan las operaciones desde su detalle.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Opciones, Boton } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useSesion } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { PRIORIDAD, TIPO_TRABAJO } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const esFecha = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
const OPC_TIPO = Object.entries(TIPO_TRABAJO).map(([valor, titulo]) => ({ valor, titulo }));
const OPC_PRIORIDAD = Object.entries(PRIORIDAD).map(([valor, p]) => ({ valor, titulo: p.texto }));
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function NuevaOt() {
  const { usuario, permisos } = useSesion();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const { ancho } = usePantalla();
  const todaLaEmpresa = permisos.PROD?.alcance === 'todo';
  const [f, setF] = useState({
    titulo: '', descripcion: '', tipo_trabajo: 'fabricacion', prioridad: 'media', cantidad: '1',
    cliente_id: null, area_id: usuario.area?.id ?? null, responsable_id: usuario.empleadoId ?? null,
    fecha_inicio_plan: enDias(0), fecha_entrega_plan: enDias(7),
  });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (campo) => (v) => setF((x) => ({ ...x, [campo]: v }));
  const dos = ancho >= 520;

  async function guardar() {
    const e = {};
    if (!f.titulo.trim()) e.titulo = 'Escribí un título';
    if (!/^\d+$/.test(f.cantidad) || Number(f.cantidad) < 1) e.cantidad = 'Cantidad entera mayor a 0';
    if (!esFecha(f.fecha_inicio_plan)) e.fecha_inicio_plan = 'Formato AAAA-MM-DD';
    if (!esFecha(f.fecha_entrega_plan)) e.fecha_entrega_plan = 'Formato AAAA-MM-DD';
    if (!e.fecha_inicio_plan && !e.fecha_entrega_plan && f.fecha_inicio_plan && f.fecha_entrega_plan && f.fecha_entrega_plan < f.fecha_inicio_plan) {
      e.fecha_entrega_plan = 'No puede ser anterior al inicio';
    }
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const ot = await api('/ordenes-trabajo', {
        metodo: 'POST',
        cuerpo: {
          titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || undefined, tipo_trabajo: f.tipo_trabajo,
          prioridad: f.prioridad, cantidad: Number(f.cantidad), cliente_id: f.cliente_id ?? undefined,
          area_id: f.area_id ?? undefined, responsable_id: f.responsable_id ?? undefined,
          fecha_inicio_plan: f.fecha_inicio_plan || undefined, fecha_entrega_plan: f.fecha_entrega_plan || undefined,
        },
      });
      toast.exito(`Se creó la orden ${ot.numero}. Ahora agregale las operaciones.`);
      router.replace(`/modulos/produccion/${ot.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nueva orden de trabajo" icono="add-circle" sub="Un trabajo para un cliente o interno. Las operaciones se cargan después." />
      <Tarjeta titulo="Trabajo" icono="clipboard-outline">
        <Campo etiqueta="Título" value={f.titulo} onChangeText={cambiar('titulo')} error={errores.titulo} maxLength={120}
          placeholder="Ej.: Reparación de eje de cosechadora" />
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Tipo de trabajo</Text>
        <Opciones opciones={OPC_TIPO} valor={f.tipo_trabajo} alCambiar={cambiar('tipo_trabajo')} />
        <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChangeText={cambiar('descripcion')} error={errores.descripcion}
          maxLength={5000} multiline numberOfLines={3} />
        <Selector etiqueta="Cliente" ruta="/clientes" consulta={{ activo: 'true' }} valor={f.cliente_id} opcional
          placeholder="Trabajo interno (sin cliente)" alCambiar={cambiar('cliente_id')} error={errores.cliente_id}
          mapear={(c) => ({ titulo: c.razon_social, sub: [c.cuit, c.localidad].filter(Boolean).join(' · ') })} />
      </Tarjeta>

      <Tarjeta titulo="Planificación" icono="calendar-outline">
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Prioridad</Text>
        <Opciones opciones={OPC_PRIORIDAD} valor={f.prioridad} alCambiar={cambiar('prioridad')} />
        <View style={dos && estilos.fila}>
          <Campo etiqueta="Cantidad" value={f.cantidad} onChangeText={cambiar('cantidad')} error={errores.cantidad} keyboardType="number-pad" maxLength={6} estilo={dos && { flex: 1 }} />
          <Campo etiqueta="Inicio" value={f.fecha_inicio_plan} onChangeText={cambiar('fecha_inicio_plan')} error={errores.fecha_inicio_plan} placeholder="AAAA-MM-DD" maxLength={10} estilo={dos && { flex: 1 }} />
          <Campo etiqueta="Entrega" value={f.fecha_entrega_plan} onChangeText={cambiar('fecha_entrega_plan')} error={errores.fecha_entrega_plan} placeholder="AAAA-MM-DD" maxLength={10} estilo={dos && { flex: 1 }} />
        </View>
        {todaLaEmpresa ? (
          <Selector etiqueta="Área responsable" ruta="/areas" consulta={{ activo: 'true' }} valor={f.area_id} textoValor={usuario.area?.nombre}
            alCambiar={(id) => setF((x) => ({ ...x, area_id: id, responsable_id: null }))} error={errores.area_id}
            mapear={(a) => ({ titulo: a.nombre, sub: a.jefe_nombre ? `Jefe: ${a.jefe_nombre}` : null })} />
        ) : null}
        <Selector etiqueta="Responsable" ruta="/empleados" consulta={{ estado: 'activo', ...(f.area_id ? { area_id: f.area_id } : {}) }}
          valor={f.responsable_id} textoValor={f.responsable_id === usuario.empleadoId ? `${usuario.nombre} ${usuario.apellido}` : undefined}
          opcional alCambiar={cambiar('responsable_id')} error={errores.responsable_id}
          mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: [e.puesto_nombre, e.area_nombre].filter(Boolean).join(' · ') })} />
      </Tarjeta>

      <View style={estilos.botones}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} estilo={{ flex: 1 }} />
        <Boton titulo="Crear orden" icono="checkmark" onPress={guardar} cargando={enviando} textoCargando="Creando…" estilo={{ flex: 1 }} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
  botones: { flexDirection: 'row', gap: espacio.m, marginTop: espacio.s },
});
