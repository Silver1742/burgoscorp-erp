// Reportar una falla: se elige la máquina (o se escanea su QR), se cuenta qué pasa y si quedó
// parada. Después se le agrega la foto desde el detalle.
// Se puede abrir con ?maquina=ID (desde la ficha de la máquina) para que ya venga elegida.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Opciones, Casilla } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import Escaner from '../../../../componentes/Escaner';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ESTADO_MAQUINA } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const PRIORIDADES = [
  { valor: 'baja', titulo: 'Baja' }, { valor: 'media', titulo: 'Media' }, { valor: 'alta', titulo: 'Alta' }, { valor: 'urgente', titulo: 'Urgente' },
];

export default function ReportarFalla() {
  const { maquina } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [f, setF] = useState({ centro_trabajo_id: maquina ? Number(maquina) : null, texto: null, descripcion: '', prioridad: null, detiene_maquina: false });
  const [escaneando, setEscaneando] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));

  useEffect(() => {
    if (!maquina) return;
    api(`/maquinas/${maquina}`).then((m) => setF((x) => ({ ...x, texto: `${m.codigo} · ${m.nombre}` }))).catch(() => {});
  }, [maquina]);

  const alEscanear = useCallback((r) => {
    setF((x) => ({ ...x, centro_trabajo_id: r.id, texto: r.titulo }));
    setEscaneando(false);
    toast.exito(`Máquina: ${r.titulo}`);
  }, [toast]);

  async function reportar() {
    const e = {};
    if (!f.centro_trabajo_id) e.centro_trabajo_id = 'Elegí o escaneá la máquina';
    if (f.descripcion.trim().length < 5) e.descripcion = 'Contá qué pasa (al menos 5 letras)';
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    try {
      const om = await api('/ordenes-mantenimiento', {
        metodo: 'POST',
        cuerpo: { centro_trabajo_id: f.centro_trabajo_id, descripcion: f.descripcion.trim(), prioridad: f.prioridad ?? undefined, detiene_maquina: f.detiene_maquina },
      });
      toast.exito(`${om.numero} reportada. Mantenimiento ya tiene el aviso; agregale una foto de la falla.`);
      router.replace(`/modulos/mantenimiento/${om.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Reportar una falla" icono="warning" sub="Le llega el aviso al área de Mantenimiento." />
      <Tarjeta titulo="Máquina" icono="hardware-chip-outline">
        <Selector etiqueta="Máquina o puesto" ruta="/maquinas" valor={f.centro_trabajo_id} textoValor={f.texto} error={errores.centro_trabajo_id}
          alCambiar={(id, m) => setF((x) => ({ ...x, centro_trabajo_id: id, texto: m ? `${m.codigo} · ${m.nombre}` : null }))}
          mapear={(m) => ({ titulo: `${m.codigo} · ${m.nombre}`, sub: [m.area_nombre, m.ubicacion, m.estado !== 'operativo' ? ESTADO_MAQUINA[m.estado] : null].filter(Boolean).join(' · ') })} />
        <Boton titulo={escaneando ? 'Cerrar la cámara' : 'Escanear el QR de la máquina'} icono="qr-code-outline" variante="secundario" chico
          onPress={() => setEscaneando((x) => !x)} estilo={{ marginBottom: escaneando ? espacio.m : 0 }} />
        {escaneando ? <Escaner tipos={['maquina']} alEncontrar={alEscanear} ayuda="Apuntá a la etiqueta QR pegada en la máquina." /> : null}
      </Tarjeta>

      <Tarjeta titulo="Qué pasa" icono="chatbox-ellipses-outline">
        <Campo etiqueta="Descripción de la falla" value={f.descripcion} onChangeText={cambiar('descripcion')} error={errores.descripcion}
          multiline numberOfLines={4} maxLength={1000} placeholder="Ej.: hace ruido el husillo y vibra al pasar de 3000 rpm" />
        <Casilla marcada={f.detiene_maquina} alCambiar={cambiar('detiene_maquina')} etiqueta="La máquina quedó parada (no se puede usar)" />
        <Text style={{ color: t.textoSuave, marginBottom: 6 }}>Prioridad {f.prioridad ? '' : `(si no elegís: ${f.detiene_maquina ? 'alta' : 'media'})`}</Text>
        <Opciones opciones={PRIORIDADES} valor={f.prioridad} alCambiar={cambiar('prioridad')} />
        {f.detiene_maquina ? (
          <View style={{ marginTop: espacio.s }}>
            <Text style={{ color: t.avisoTexto }}>Mientras esté parada no se le pueden asignar ni iniciar operaciones.</Text>
          </View>
        ) : null}
      </Tarjeta>

      <Boton titulo="Reportar falla" icono="send" onPress={reportar} cargando={enviando} textoCargando="Enviando…" />
    </Pantalla>
  );
}
