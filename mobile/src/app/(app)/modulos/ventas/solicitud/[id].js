// Detalle de una solicitud: qué pide el cliente, fotos de la pieza, contacto por teléfono o
// WhatsApp, asignación a Ingeniería y el paso a presupuesto.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Esqueleto, ErrorCarga } from '../../../../../componentes/ui';
import ConfirmDialog from '../../../../../componentes/ConfirmDialog';
import Contacto from '../../../../../componentes/Contacto';
import Fotos from '../../../../../componentes/Fotos';
import Selector from '../../../../../componentes/Selector';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { ESTADO_PRESUPUESTO, ESTADO_SOLICITUD, TIPO_TRABAJO, fechaCorta, fechaHoraCorta, pesosAr } from '../../../../../modulos';
import { espacio, useTema } from '../../../../../tema';

export default function DetalleSolicitud() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setS(await api(`/solicitudes/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function editar(cuerpo, mensaje) {
    try {
      setS(await api(`/solicitudes/${id}`, { metodo: 'PUT', cuerpo }));
      toast.exito(mensaje);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!s) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const estado = ESTADO_SOLICITUD[s.estado];
  const saludo = `Hola${s.cliente_contacto ? ` ${s.cliente_contacto}` : ''}, te escribimos de BurgosCorp por tu pedido ${s.numero} (${s.titulo}).`;

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: s.numero }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{s.numero}</Text>
          <Insignia texto={estado.texto} tono={estado.tono} />
          <Insignia texto={TIPO_TRABAJO[s.tipo_trabajo]} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{s.titulo}</Text>
        {s.descripcion ? <Text style={{ color: t.texto, marginBottom: espacio.m }}>{s.descripcion}</Text> : null}
        <View style={estilos.datos}>
          <Dato etiqueta="Cliente">{s.cliente_nombre}</Dato>
          {s.cliente_contacto ? <Dato etiqueta="Contacto">{s.cliente_contacto}</Dato> : null}
          <Dato etiqueta="Cantidad">{String(s.cantidad)}</Dato>
          <Dato etiqueta="Para">{fechaCorta(s.fecha_requerida)}</Dato>
          <Dato etiqueta="Recibió">{s.recibida_por_nombre}</Dato>
          <Dato etiqueta="Fecha">{fechaHoraCorta(s.created_at)}</Dato>
        </View>
        <Contacto telefono={s.cliente_telefono} mensaje={saludo} />
        {/* El análisis lo asigna el jefe de Ingeniería a alguien de su equipo. */}
        {s.puede_asignar ? (
          <Selector etiqueta="Analiza (Ingeniería)" ruta="/solicitudes/analistas" valor={null} textoValor={s.asignada_a_nombre}
            placeholder="Asignar a…" estilo={{ marginTop: espacio.l }}
            alCambiar={(empleadoId) => empleadoId && editar({ asignada_a: empleadoId }, 'Asignada. Le llegó el aviso.').catch(() => {})}
            mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.abiertas} ${Number(e.abiertas) === 1 ? 'pedido abierto' : 'pedidos abiertos'}` })} />
        ) : (
          <Text style={{ color: t.textoSuave, marginTop: espacio.m }}>
            {s.asignada_a_nombre ? `Analiza: ${s.asignada_a_nombre}`
              : s.jefe_ingenieria ? `Lo asigna ${s.jefe_ingenieria}, jefe de Ingeniería.` : 'Sin asignar.'}
          </Text>
        )}
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          {s.puede_presupuestar ? (
            <Boton titulo="Presupuestar" icono="calculator-outline" chico estilo={{ marginBottom: 0 }}
              onPress={() => router.push({ pathname: '/modulos/ventas/presupuesto/nuevo', params: { solicitud: s.id } })} />
          ) : null}
          {s.puede_editar ? <Boton titulo="Cancelar pedido" chico variante="contornoPeligro" onPress={() => setCancelando(true)} estilo={{ marginBottom: 0 }} /> : null}
        </View>
      </Tarjeta>

      <Fotos key={s.estado} entidad="solicitud" entidadId={s.id} titulo="Fotos de la pieza"
        vacio="Sacale una foto a la pieza (con una cinta métrica al lado) o adjuntá la que mandó el cliente." />

      {s.presupuestos.length ? (
        <Tarjeta titulo="Presupuestos" icono="calculator-outline" sinRelleno>
          {s.presupuestos.map((p, i) => (
            <FilaLista key={p.id} ultima={i === s.presupuestos.length - 1} onPress={() => router.push(`/modulos/ventas/presupuesto/${p.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.primario, fontWeight: '700', fontSize: 13 }}>{p.numero}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>{fechaCorta(p.fecha)} · {pesosAr(p.total)}</Text>
              </View>
              <Insignia texto={ESTADO_PRESUPUESTO[p.estado].texto} tono={ESTADO_PRESUPUESTO[p.estado].tono} />
              <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      <ConfirmDialog visible={cancelando} titulo="Cancelar pedido" mensaje={`¿Cancelar ${s.numero}? El cliente ya no lo quiere o no se va a hacer.`}
        textoConfirmar="Cancelar pedido" alConfirmar={() => editar({ estado: 'cancelada' }, 'Pedido cancelado.')} alCerrar={() => setCancelando(false)} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.m },
});
