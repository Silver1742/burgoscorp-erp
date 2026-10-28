// Detalle de un presupuesto: líneas e importes, envío al cliente (también por WhatsApp) y su
// respuesta. Si lo acepta, se elige el área y la API crea la OT con operaciones y material reservado.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pantalla, Tarjeta, FilaLista, Insignia, Dato, Boton, Campo, Opciones, Esqueleto, ErrorCarga } from '../../../../../componentes/ui';
import ConfirmDialog from '../../../../../componentes/ConfirmDialog';
import Contacto from '../../../../../componentes/Contacto';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { ESTADO_PRESUPUESTO, PRIORIDAD, TIPO_ITEM, cantidad, fechaCorta, pesosAr } from '../../../../../modulos';
import { espacio, useTema } from '../../../../../tema';

const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'].map((valor) => ({ valor, titulo: PRIORIDAD[valor].texto }));

export default function DetallePresupuesto() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [accion, setAccion] = useState(null); // enviar | aprobar | rechazar
  const [aprob, setAprob] = useState({ area_id: null, prioridad: 'media' });
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setP(await api(`/presupuestos/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function ejecutar() {
    if (accion === 'aprobar' && !aprob.area_id) {
      toast.error('Elegí qué área hace el trabajo.');
      throw new Error('sin área');
    }
    if (accion === 'rechazar' && !motivo.trim()) {
      toast.error('Contá por qué lo rechazó el cliente.');
      throw new Error('sin motivo');
    }
    try {
      const cuerpo = accion === 'aprobar' ? aprob : accion === 'rechazar' ? { comentario: motivo.trim() } : undefined;
      const r = await api(`/presupuestos/${id}/${accion}`, { metodo: 'POST', cuerpo });
      setP(r);
      if (accion === 'aprobar') {
        toast.exito(`${r.ot_numero} creada.${r.faltantes?.length ? ' Falta material: se avisó a Abastecimiento.' : ''}`);
      } else toast.exito(accion === 'enviar' ? 'Marcado como enviado. Mandáselo por WhatsApp.' : 'Presupuesto rechazado.');
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!p) return <Pantalla><Tarjeta><Esqueleto ancho="40%" /><Esqueleto alto={20} estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const estado = ESTADO_PRESUPUESTO[p.estado];
  // Resumen para mandar por WhatsApp (sin datos internos: solo lo que ve el cliente).
  const resumen = [`Hola, te enviamos el presupuesto ${p.numero} de BurgosCorp${p.solicitud_titulo ? ` por "${p.solicitud_titulo}"` : ''}.`,
    ...p.items.map((i) => `• ${i.descripcion}: ${pesosAr(i.subtotal)}`),
    `Total con IVA: ${pesosAr(p.total)}.`, p.plazo_entrega_dias ? `Plazo de entrega: ${p.plazo_entrega_dias} días.` : '',
    `Válido hasta el ${fechaCorta(p.vence)}.`].filter(Boolean).join('\n');

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: p.numero }} />
      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Text style={[estilos.numero, { color: t.primario }]}>{p.numero}</Text>
          <Insignia texto={estado.texto} tono={estado.tono} />
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{p.solicitud_titulo ?? p.cliente_nombre}</Text>
        <View style={estilos.datos}>
          <Dato etiqueta="Cliente">{p.cliente_nombre}</Dato>
          <Dato etiqueta="Total con IVA">{pesosAr(p.total)}</Dato>
          <Dato etiqueta="Plazo">{p.plazo_entrega_dias ? `${p.plazo_entrega_dias} días` : '—'}</Dato>
          <Dato etiqueta="Válido hasta">{fechaCorta(p.vence)}</Dato>
          <Dato etiqueta="Preparó">{p.creado_por_nombre}</Dato>
          {p.ot_numero ? <Dato etiqueta="Orden de trabajo">{p.ot_numero}</Dato> : null}
        </View>
        {p.observaciones ? <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>{p.observaciones}</Text> : null}
        {p.estado === 'enviado' ? <Contacto telefono={p.cliente_telefono} mensaje={resumen} /> : null}
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          {p.puede_enviar ? <Boton titulo="Marcar enviado" icono="send-outline" chico onPress={() => setAccion('enviar')} estilo={{ marginBottom: 0 }} /> : null}
          {p.puede_resolver ? <Boton titulo="Aceptado: crear OT" icono="checkmark-done" chico variante="exito" onPress={() => setAccion('aprobar')} estilo={{ marginBottom: 0 }} /> : null}
          {p.puede_resolver ? <Boton titulo="Rechazado" chico variante="contornoPeligro" onPress={() => setAccion('rechazar')} estilo={{ marginBottom: 0 }} /> : null}
          {p.puede_ver_ot ? <Boton titulo={`Ver ${p.ot_numero}`} icono="clipboard-outline" chico variante="secundario" onPress={() => router.push(`/modulos/produccion/${p.orden_trabajo_id}`)} estilo={{ marginBottom: 0 }} /> : null}
          {p.solicitud_id ? <Boton titulo="Ver solicitud" chico variante="texto" onPress={() => router.push(`/modulos/ventas/solicitud/${p.solicitud_id}`)} estilo={{ marginBottom: 0 }} /> : null}
        </View>
      </Tarjeta>

      <Tarjeta titulo="Líneas" icono="list-outline" sinRelleno>
        {p.items.map((i, n) => (
          <FilaLista key={i.id} ultima={n === p.items.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.texto, fontWeight: '600' }}>{i.descripcion}</Text>
              <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                {[TIPO_ITEM[i.tipo], i.centro_codigo ?? i.producto_codigo, `${cantidad(i.cantidad, i.unidad)} × ${pesosAr(i.precio_unitario)}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{pesosAr(i.subtotal)}</Text>
          </FilaLista>
        ))}
        <View style={[estilos.totales, { borderTopColor: t.borde }]}>
          <Text style={{ color: t.textoSuave }}>Subtotal {pesosAr(p.subtotal)} · IVA {pesosAr(p.iva_monto)}</Text>
          <Text style={{ color: t.texto, fontSize: 17, fontWeight: '700' }}>{pesosAr(p.total)}</Text>
        </View>
      </Tarjeta>

      <ConfirmDialog visible={Boolean(accion)} variante={accion === 'rechazar' ? 'peligro' : 'primario'}
        titulo={{ enviar: 'Marcar como enviado', aprobar: 'El cliente aceptó', rechazar: 'El cliente rechazó' }[accion] ?? ''}
        mensaje={{
          enviar: 'Queda esperando la respuesta del cliente. Después podés mandárselo por WhatsApp desde acá.',
          aprobar: 'Se crea la orden de trabajo: una operación por cada línea de máquina y la reserva de cada material.',
          rechazar: '',
        }[accion] ?? ''}
        textoConfirmar={{ enviar: 'Marcar enviado', aprobar: 'Crear OT', rechazar: 'Rechazar' }[accion] ?? ''}
        alConfirmar={ejecutar} alCerrar={() => { setAccion(null); setMotivo(''); }}>
        {accion === 'aprobar' ? (
          <>
            <Text style={[estilos.etiqueta, { color: t.texto }]}>Área responsable</Text>
            <Opciones opciones={p.areas_produccion.map((a) => ({ valor: a.id, titulo: a.nombre }))} valor={aprob.area_id}
              alCambiar={(area_id) => setAprob((x) => ({ ...x, area_id }))} />
            <Text style={[estilos.etiqueta, { color: t.texto }]}>Prioridad</Text>
            <Opciones opciones={PRIORIDADES} valor={aprob.prioridad} alCambiar={(prioridad) => setAprob((x) => ({ ...x, prioridad }))} />
          </>
        ) : null}
        {accion === 'rechazar' ? <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} maxLength={500} multiline estilo={{ marginBottom: 0 }} /> : null}
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  numero: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  titulo: { fontSize: 21, fontWeight: '600', marginVertical: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginBottom: espacio.s },
  totales: { borderTopWidth: 1, padding: espacio.l, alignItems: 'flex-end' },
  etiqueta: { fontSize: 15, marginBottom: 6 },
});
