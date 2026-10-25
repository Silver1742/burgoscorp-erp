// Alta de una tarea suelta del área (sin orden de trabajo): ej. "Inventario del pañol".
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Opciones, Boton } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { PRIORIDAD } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

const OPC_PRIORIDAD = Object.entries(PRIORIDAD).map(([valor, p]) => ({ valor, titulo: p.texto }));

export default function NuevaTarea() {
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const { ancho } = usePantalla();
  const [f, setF] = useState({ titulo: '', descripcion: '', prioridad: 'media', fecha: '', hora: '17:00', horas_estimadas: '', centro_trabajo_id: null, habilidad_requerida_id: null, checklist: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const dos = ancho >= 520;

  async function guardar() {
    const e = {};
    if (!f.titulo.trim()) e.titulo = 'Escribí qué hay que hacer';
    if (f.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Formato AAAA-MM-DD';
    if (f.fecha && !/^\d{2}:\d{2}$/.test(f.hora)) e.hora = 'Formato HH:MM';
    if (f.horas_estimadas && !/^\d+([.,]\d{1,2})?$/.test(f.horas_estimadas)) e.horas_estimadas = 'Número de horas (ej. 2,5)';
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const tarea = await api('/tareas', {
        metodo: 'POST',
        cuerpo: {
          titulo: f.titulo.trim(),
          descripcion: f.descripcion.trim() || undefined,
          prioridad: f.prioridad,
          // La fecha y la hora se interpretan en la hora local del celular.
          fecha_limite: f.fecha ? new Date(`${f.fecha}T${f.hora}:00`).toISOString() : undefined,
          horas_estimadas: f.horas_estimadas ? Math.round(Number(f.horas_estimadas.replace(',', '.')) * 4) / 4 : undefined,
          centro_trabajo_id: f.centro_trabajo_id ?? undefined,
          habilidad_requerida_id: f.habilidad_requerida_id ?? undefined,
          checklist: f.checklist.split('\n').map((x) => x.trim()).filter(Boolean),
        },
      });
      toast.exito('Tarea creada. Asignala a alguien de tu equipo.');
      router.replace(`/modulos/tareas/${tarea.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nueva tarea" icono="add-circle" sub="Una tarea de tu área que no forma parte de una orden de trabajo." />
      <Tarjeta titulo="Qué hay que hacer" icono="create-outline">
        <Campo etiqueta="Título" value={f.titulo} onChangeText={cambiar('titulo')} error={errores.titulo} maxLength={150} placeholder="Ej.: Inventario del pañol" />
        <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChangeText={cambiar('descripcion')} maxLength={5000} multiline numberOfLines={3} />
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Prioridad</Text>
        <Opciones opciones={OPC_PRIORIDAD} valor={f.prioridad} alCambiar={cambiar('prioridad')} />
        <View style={dos && estilos.fila}>
          <Campo etiqueta="Vence (opcional)" value={f.fecha} onChangeText={cambiar('fecha')} error={errores.fecha} placeholder="AAAA-MM-DD" maxLength={10} estilo={dos && { flex: 2 }} />
          <Campo etiqueta="Hora" value={f.hora} onChangeText={cambiar('hora')} error={errores.hora} placeholder="HH:MM" maxLength={5} estilo={dos && { flex: 1 }} />
          <Campo etiqueta="Horas estimadas" value={f.horas_estimadas} onChangeText={cambiar('horas_estimadas')} error={errores.horas_estimadas} keyboardType="decimal-pad" maxLength={6} estilo={dos && { flex: 1 }} />
        </View>
      </Tarjeta>
      <Tarjeta titulo="Requisitos" icono="construct-outline">
        <Selector etiqueta="Máquina / puesto (opcional)" ruta="/centros-trabajo" consulta={{ activo: 'true' }} valor={f.centro_trabajo_id} opcional
          placeholder="Sin máquina" alCambiar={cambiar('centro_trabajo_id')}
          mapear={(c) => ({ titulo: `${c.codigo} · ${c.nombre}`, sub: c.area_nombre })} />
        <Selector etiqueta="Habilidad requerida (opcional)" ruta="/habilidades" valor={f.habilidad_requerida_id} opcional
          placeholder="Si elegís una máquina, se usa la suya" alCambiar={cambiar('habilidad_requerida_id')}
          mapear={(h) => ({ titulo: h.nombre, sub: h.requiere_certificacion ? 'Requiere certificación' : null })} />
        <Campo etiqueta="Lista de control (una por línea, opcional)" value={f.checklist} onChangeText={cambiar('checklist')} multiline numberOfLines={3} maxLength={2000} />
      </Tarjeta>
      <View style={estilos.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} estilo={{ flex: 1 }} />
        <Boton titulo="Crear tarea" icono="checkmark" onPress={guardar} cargando={enviando} textoCargando="Creando…" estilo={{ flex: 1 }} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
});
