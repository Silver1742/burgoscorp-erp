// "Nueva área" (administrador): código, nombre, descripción y qué trabaja el área.
// Solo se ofrecen los módulos que comparten varias áreas (Producción y Ventas); los demás tienen
// una sola área dueña que los gestiona para toda la empresa (ver routes/catalogos.js).
// El jefe se elige después, desde la ficha de una persona (cambiando su rol o su área).
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Campo, Casilla } from './ui';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { espacio, useTema } from '../tema';

const VACIA = { codigo: '', nombre: '', descripcion: '', produccion: false, ventas: false };

export default function NuevaArea({ visible, alCerrar, alCrear }) {
  const t = useTema();
  const toast = useToast();
  const [f, setF] = useState(VACIA);
  const [errores, setErrores] = useState({});
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));

  async function crear() {
    const e = {};
    if (!/^[A-Za-z0-9_-]{1,10}$/.test(f.codigo.trim())) e.codigo = 'Hasta 10 letras o números, sin espacios (ej. PIN)';
    if (!f.nombre.trim()) e.nombre = 'Escribí el nombre del área';
    setErrores(e);
    if (Object.keys(e).length) throw new Error('datos');
    try {
      const area = await api('/areas', {
        metodo: 'POST',
        cuerpo: { codigo: f.codigo.trim().toUpperCase(), nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null },
      });
      const modulos = [f.produccion && 'PROD', f.ventas && 'VEN'].filter(Boolean);
      if (modulos.length) await api(`/areas/${area.id}/modulos`, { metodo: 'PUT', cuerpo: { modulos } });
      toast.exito(`Área ${area.nombre} creada. Sumale gente y un jefe desde la ficha de cada persona.`);
      setF(VACIA);
      alCrear?.(area);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <ConfirmDialog visible={visible} titulo="Nueva área" variante="primario" textoConfirmar="Crear área"
      alConfirmar={crear} alCerrar={() => { setErrores({}); alCerrar(); }}>
      <View style={{ marginTop: espacio.s }}>
        <Campo etiqueta="Código" value={f.codigo} onChangeText={cambiar('codigo')} error={errores.codigo}
          autoCapitalize="characters" maxLength={10} placeholder="PIN" ayuda="Corto y único. Se usa en los listados." />
        <Campo etiqueta="Nombre" value={f.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} maxLength={80} placeholder="Pintura" />
        <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChangeText={cambiar('descripcion')} error={errores.descripcion} maxLength={255} />
        <Text style={{ color: t.texto, marginBottom: 6 }}>¿Qué trabaja el área?</Text>
        <Casilla marcada={f.produccion} alCambiar={cambiar('produccion')} etiqueta="Producción: tiene máquinas, órdenes de trabajo y tareas" />
        <Casilla marcada={f.ventas} alCambiar={cambiar('ventas')} etiqueta="Ventas y presupuestos: atiende pedidos de clientes" />
        <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 6 }}>
          Sin marcar nada, el área tiene su gente, sus tareas, su tablón y sus licencias.
        </Text>
      </View>
    </ConfirmDialog>
  );
}
