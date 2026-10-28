// Nueva solicitud: lo que pide el cliente. Al crearla se abre el detalle para sacarle la foto a la
// pieza (o adjuntar la que mandó por WhatsApp desde la galería).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Opciones } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { TIPO_TRABAJO } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const TIPOS = Object.entries(TIPO_TRABAJO).map(([valor, titulo]) => ({ valor, titulo }));

export default function NuevaSolicitud() {
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [f, setF] = useState({ cliente_id: null, titulo: '', descripcion: '', tipo_trabajo: 'fabricacion', cantidad: '1', fecha_requerida: '' });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));

  async function crear() {
    const e = {};
    if (!f.cliente_id) e.cliente_id = 'Elegí el cliente';
    if (!f.titulo.trim()) e.titulo = 'Contá en pocas palabras qué pide';
    if (!/^\d{1,6}$/.test(f.cantidad) || Number(f.cantidad) < 1) e.cantidad = 'Cantidad de piezas (1 o más)';
    if (f.fecha_requerida && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_requerida)) e.fecha_requerida = 'Formato AAAA-MM-DD';
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const s = await api('/solicitudes', {
        metodo: 'POST',
        cuerpo: {
          cliente_id: f.cliente_id, titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || undefined, tipo_trabajo: f.tipo_trabajo,
          cantidad: Number(f.cantidad), fecha_requerida: f.fecha_requerida || undefined,
        },
      });
      toast.exito(`${s.numero} creada. Sacale una foto a la pieza.`);
      router.replace(`/modulos/ventas/solicitud/${s.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nueva solicitud" icono="briefcase" sub="El pedido del cliente, antes de presupuestar." />
      <Tarjeta titulo="Cliente" icono="business-outline">
        <Selector etiqueta="Cliente" ruta="/clientes" consulta={{ activo: 'true' }} valor={f.cliente_id} alCambiar={cambiar('cliente_id')} error={errores.cliente_id}
          mapear={(c) => ({ titulo: c.razon_social, sub: [c.localidad, c.contacto].filter(Boolean).join(' · ') })} estilo={{ marginBottom: 0 }} />
      </Tarjeta>
      <Tarjeta titulo="Qué pide" icono="chatbox-ellipses-outline">
        <Campo etiqueta="Título" value={f.titulo} onChangeText={cambiar('titulo')} error={errores.titulo} maxLength={120}
          placeholder="Ej.: Reducción de 9×30 cm a manguera de 15 cm" />
        <Campo etiqueta="Descripción (medidas, material, uso)" value={f.descripcion} onChangeText={cambiar('descripcion')}
          error={errores.descripcion} multiline numberOfLines={4} maxLength={5000} />
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Tipo de trabajo</Text>
        <Opciones opciones={TIPOS} valor={f.tipo_trabajo} alCambiar={cambiar('tipo_trabajo')} />
        <View style={estilos.fila}>
          <Campo etiqueta="Cantidad" value={f.cantidad} onChangeText={cambiar('cantidad')} error={errores.cantidad} keyboardType="number-pad" maxLength={6} estilo={{ flex: 1 }} />
          <Campo etiqueta="Para cuándo (opcional)" value={f.fecha_requerida} onChangeText={cambiar('fecha_requerida')} error={errores.fecha_requerida}
            placeholder="AAAA-MM-DD" maxLength={10} estilo={{ flex: 1 }} />
        </View>
      </Tarjeta>
      <Boton titulo="Crear y agregar fotos" icono="camera" onPress={crear} cargando={enviando} textoCargando="Creando…" />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
});
