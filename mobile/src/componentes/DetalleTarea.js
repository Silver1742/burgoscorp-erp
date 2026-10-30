// Detalle de una tarea / operación. Lo usan "Mis tareas" y el módulo de Tareas.
// Según quién mira, muestra:
//  - asignado: iniciar / pausar / terminar, tildar la lista de control y comentar;
//  - jefe del área: asignar personas (solo aptas: habilidad, certificación, máquina operativa),
//    aprobar, rechazar con motivo o cancelar.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, Tarjeta, FilaLista, Insignia, Dato, Avatar, Boton, Campo, Casilla, Esqueleto, ErrorCarga, Vacio, Cargando,
} from './ui';
import ConfirmDialog from './ConfirmDialog';
import Fotos from './Fotos';
import MaterialesOt from './MaterialesOt';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { ESTADO_TAREA, PRIORIDAD, fechaHoraCorta, horas } from '../modulos';
import { espacio, useTema, usePantalla } from '../tema';

const NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

function DialogoAsignar({ visible, tarea, alCerrar, alAsignar }) {
  const t = useTema();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setLista(null);
    setElegido(null);
    setError(null);
    api(`/tareas/${tarea.id}/candidatos`).then(setLista).catch((err) => setError(err.message));
  }, [visible, tarea.id]);

  async function asignar() {
    if (!elegido) {
      toast.aviso('Elegí a quién asignar');
      throw new Error('sin elegir');
    }
    try {
      await alAsignar(elegido);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  const disponibles = lista?.filter((e) => !e.ya_asignado) ?? [];
  return (
    <ConfirmDialog visible={visible} titulo="Asignar persona" textoConfirmar="Asignar" variante="primario" alConfirmar={asignar} alCerrar={alCerrar}
      mensaje={tarea.habilidad_nombre ? `Solo aparecen personas de ${tarea.area_nombre} con "${tarea.habilidad_nombre}"${tarea.habilidad_certificada ? ' y la certificación vigente' : ''}.` : `Personas activas de ${tarea.area_nombre}.`}>
      <View style={{ marginTop: espacio.m }}>
        {error ? <ErrorCarga error={error} /> : null}
        {!lista && !error ? <Cargando /> : null}
        {lista && disponibles.length === 0 ? <Vacio icono="person-remove-outline" titulo="No hay personas aptas disponibles" /> : null}
        {disponibles.map((e) => {
          const activo = elegido === e.id;
          return (
            <Pressable key={e.id} onPress={() => setElegido(e.id)} accessibilityRole="radio" accessibilityState={{ selected: activo }}
              style={[estilos.candidato, { borderColor: activo ? t.primario : t.borde, backgroundColor: activo ? t.rojoSuave : t.superficie }]}>
              <Avatar nombre={`${e.nombre} ${e.apellido}`} tamano={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{e.apellido}, {e.nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 12 }}>{[e.puesto_nombre, e.nivel && NIVEL[e.nivel]].filter(Boolean).join(' · ')}</Text>
              </View>
              <Insignia texto={`${e.carga} abiertas`} tono={e.carga >= 3 ? 'aviso' : 'gris'} />
            </Pressable>
          );
        })}
      </View>
    </ConfirmDialog>
  );
}

export default function DetalleTarea({ id }) {
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const { columnas } = usePantalla();
  const [tarea, setTarea] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [dialogo, setDialogo] = useState(null); // 'asignar' | 'terminar' | 'aprobar' | 'rechazar' | 'cancelar' | {quitar}
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState(null);
  const [comentario, setComentario] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setTarea(await api(`/tareas/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  /** Ejecuta una acción de la API, actualiza la tarea y avisa con un toast. */
  async function accion(ruta, cuerpo, mensaje) {
    setOcupado(true);
    try {
      const r = await api(`/tareas/${id}/${ruta}`, { metodo: 'POST', cuerpo: cuerpo ?? {} });
      setTarea(r);
      if (mensaje) toast.exito(mensaje);
      return r;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setOcupado(false);
    }
  }

  async function marcar(item) {
    try {
      setTarea(await api(`/tareas/${id}/checklist/${item.id}`, { metodo: 'PUT', cuerpo: { hecho: !item.hecho } }));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function comentar() {
    if (!comentario.trim()) return;
    try {
      setTarea(await api(`/tareas/${id}/comentarios`, { metodo: 'POST', cuerpo: { texto: comentario.trim() } }));
      setComentario('');
    } catch (err) {
      toast.error(err.message);
    }
  }

  function abrirConMotivo(tipo) {
    setMotivo('');
    setErrorMotivo(null);
    setDialogo(tipo);
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!tarea) return <Pantalla><Tarjeta><Esqueleto ancho="60%" alto={20} /><Esqueleto estilo={{ marginTop: 12 }} /><Esqueleto ancho="80%" estilo={{ marginTop: 10 }} /></Tarjeta></Pantalla>;

  const est = ESTADO_TAREA[tarea.estado];
  const cerrada = ['aprobada', 'cancelada'].includes(tarea.estado);
  const yo = tarea.es_asignado;
  const jefe = tarea.puede_gestionar;
  // Asignar lo hace el jefe del área; el administrador solo si el área no tiene jefe.
  const asigna = tarea.puede_asignar;
  const maquinaParada = tarea.centro_trabajo_id && tarea.centro_estado !== 'operativo';
  const puedeTildar = (yo || jefe) && !['aprobada', 'cancelada', 'en_revision'].includes(tarea.estado);
  const dosColumnas = columnas >= 3;
  const columna = dosColumnas ? { flex: 1 } : null;

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: tarea.ot_numero ? `${tarea.ot_numero} · ${tarea.secuencia}` : 'Tarea' }} />

      <Tarjeta acentoArriba>
        <View style={estilos.fila}>
          <Insignia texto={est.texto} tono={est.tono} />
          <Insignia texto={`Prioridad ${PRIORIDAD[tarea.prioridad].texto.toLowerCase()}`} tono={PRIORIDAD[tarea.prioridad].tono} />
          {tarea.ot_numero ? (
            <Pressable onPress={() => router.push(`/modulos/produccion/${tarea.orden_trabajo_id}`)} accessibilityRole="link">
              <Text style={{ color: t.primario, fontWeight: '600' }}>{tarea.ot_numero} ›</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[estilos.titulo, { color: t.texto }]}>{tarea.titulo}</Text>
        {tarea.ot_titulo ? <Text style={{ color: t.textoSuave, marginBottom: espacio.s }}>{tarea.ot_titulo}</Text> : null}
        {tarea.descripcion ? <Text style={{ color: t.texto, marginBottom: espacio.m }}>{tarea.descripcion}</Text> : null}
        <View style={estilos.datos}>
          <Dato etiqueta="Máquina">{tarea.centro_codigo ? `${tarea.centro_codigo} · ${tarea.centro_nombre}` : 'Sin máquina'}</Dato>
          <Dato etiqueta="Habilidad">{tarea.habilidad_nombre ?? 'No requiere'}</Dato>
          <Dato etiqueta="Área">{tarea.area_nombre}</Dato>
          <Dato etiqueta="Vence">{fechaHoraCorta(tarea.fecha_limite)}</Dato>
          <Dato etiqueta="Horas (real / est.)">{`${horas(tarea.horas_reales)} / ${tarea.horas_estimadas != null ? horas(tarea.horas_estimadas) : '—'}`}</Dato>
        </View>
        {maquinaParada ? (
          <View style={[estilos.alertaMaquina, { backgroundColor: t.avisoSuave }]}>
            <Ionicons name="warning" size={16} color={t.avisoTexto} />
            <Text style={{ color: t.avisoTexto, flex: 1 }}>La máquina {tarea.centro_codigo} está en mantenimiento: no se puede asignar ni iniciar hasta que vuelva a estar operativa.</Text>
          </View>
        ) : null}

        {/* Acciones según quién mira y en qué estado está */}
        <View style={[estilos.fila, { marginTop: espacio.m }]}>
          {yo && ['pendiente', 'pausada', 'rechazada'].includes(tarea.estado) ? (
            <Boton titulo={tarea.estado === 'pendiente' ? 'Iniciar' : 'Reanudar'} icono="play" cargando={ocupado} deshabilitado={maquinaParada}
              onPress={() => accion('iniciar', null, 'Tarea en curso: se empezaron a contar tus horas.').catch(() => {})} estilo={{ marginBottom: 0 }} />
          ) : null}
          {yo && tarea.estado === 'en_curso' ? (
            <Boton titulo="Pausar" icono="pause" variante="oscuro" cargando={ocupado}
              onPress={() => accion('pausar', null, 'Tarea pausada. Las horas quedaron registradas.').catch(() => {})} estilo={{ marginBottom: 0 }} />
          ) : null}
          {yo && ['en_curso', 'pausada'].includes(tarea.estado) ? (
            <Boton titulo="Terminar" icono="checkmark-done" variante="exito" deshabilitado={ocupado} onPress={() => abrirConMotivo('terminar')} estilo={{ marginBottom: 0 }} />
          ) : null}
          {jefe && !yo && tarea.estado === 'en_revision' ? (
            <>
              <Boton titulo="Aprobar" icono="checkmark" variante="exito" onPress={() => abrirConMotivo('aprobar')} estilo={{ marginBottom: 0 }} />
              <Boton titulo="Rechazar" icono="close" variante="contornoPeligro" onPress={() => abrirConMotivo('rechazar')} estilo={{ marginBottom: 0 }} />
            </>
          ) : null}
          {jefe && !cerrada ? (
            <Boton titulo="Cancelar tarea" icono="close-circle-outline" variante="secundario" chico onPress={() => abrirConMotivo('cancelar')} />
          ) : null}
        </View>
      </Tarjeta>

      <View style={[{ gap: espacio.m }, dosColumnas && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={columna}>
          <Tarjeta titulo="Asignados" icono="people-outline" sinRelleno
            derecha={asigna && !cerrada ? <Boton titulo="Asignar" icono="person-add" chico onPress={() => setDialogo('asignar')} /> : null}>
            {tarea.asignados_detalle.length === 0 ? (
              <Vacio icono="person-outline" titulo="Sin asignar"
                texto={asigna ? 'Asigná a alguien con la habilidad necesaria.' : tarea.jefe_area ? `La asigna ${tarea.jefe_area}, jefe de ${tarea.area_nombre}.` : null} />
            ) : null}
            {tarea.asignados_detalle.map((a, i) => (
              <FilaLista key={a.id} ultima={i === tarea.asignados_detalle.length - 1}>
                <Avatar nombre={`${a.nombre} ${a.apellido}`} tamano={32} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.texto, fontWeight: '600' }}>{a.apellido}, {a.nombre}</Text>
                  <Text style={{ color: t.textoSuave, fontSize: 12 }}>{a.legajo} · asignado {fechaHoraCorta(a.asignado_at)}</Text>
                </View>
                {asigna && !cerrada ? (
                  <Boton titulo="Quitar" variante="texto" chico onPress={() => setDialogo({ quitar: a })} estilo={{ borderWidth: 0 }} />
                ) : null}
              </FilaLista>
            ))}
          </Tarjeta>

          <Tarjeta titulo="Lista de control" icono="checkbox-outline"
            derecha={tarea.checklist.length ? <Insignia texto={`${tarea.checklist.filter((c) => c.hecho).length}/${tarea.checklist.length}`} tono="gris" /> : null}>
            {tarea.checklist.length === 0 ? <Text style={{ color: t.textoSuave }}>Sin puntos de control.</Text> : null}
            {tarea.checklist.map((c) => (
              <View key={c.id} style={{ opacity: puedeTildar ? 1 : 0.7 }} pointerEvents={puedeTildar ? 'auto' : 'none'}>
                <Casilla marcada={Boolean(c.hecho)} alCambiar={() => marcar(c)} etiqueta={c.texto} />
              </View>
            ))}
          </Tarjeta>

          <Fotos entidad="tarea" entidadId={tarea.id} titulo="Fotos del trabajo"
            vacio={tarea.es_asignado ? 'Sacá una foto del avance o del trabajo terminado para que la vea tu jefe.' : 'Todavía no hay fotos.'} />
          {/* El operario registra el material que usa sin salir de su tarea. */}
          {tarea.orden_trabajo_id ? <MaterialesOt otId={tarea.orden_trabajo_id} tareaId={tarea.id} /> : null}

          <Tarjeta titulo="Horas registradas" icono="time-outline" sinRelleno>
            {tarea.horas.length === 0 ? <Vacio icono="time-outline" titulo="Todavía no se trabajó" /> : null}
            {tarea.horas.map((h, i) => (
              <FilaLista key={`${h.inicio_at}-${i}`} ultima={i === tarea.horas.length - 1}>
                <Text style={{ color: t.texto, flex: 1 }}>{h.empleado}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>{fechaHoraCorta(h.inicio_at)} → {h.fin_at ? fechaHoraCorta(h.fin_at) : 'en curso'}</Text>
                <Text style={{ color: t.texto, fontWeight: '600', minWidth: 50, textAlign: 'right' }}>{h.fin_at ? horas(h.horas) : '…'}</Text>
              </FilaLista>
            ))}
          </Tarjeta>
        </View>

        <View style={columna}>
          <Tarjeta titulo="Comentarios" icono="chatbubbles-outline">
            {tarea.comentarios.length === 0 ? <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>Todavía no hay comentarios.</Text> : null}
            {tarea.comentarios.map((c) => (
              <View key={c.id} style={estilos.comentario}>
                <Avatar nombre={c.autor} tamano={28} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.texto, fontWeight: '600', fontSize: 13 }}>{c.autor} <Text style={{ color: t.textoTenue, fontWeight: '400' }}>· {fechaHoraCorta(c.created_at)}</Text></Text>
                  <Text style={{ color: t.texto }}>{c.texto}</Text>
                </View>
              </View>
            ))}
            {yo || jefe ? (
              <View style={estilos.nuevoComentario}>
                <Campo value={comentario} onChangeText={setComentario} placeholder="Escribí un comentario…" maxLength={2000} multiline estilo={{ flex: 1, marginBottom: 0 }} accessibilityLabel="Nuevo comentario" />
                <Boton titulo="Enviar" icono="send" chico onPress={comentar} deshabilitado={!comentario.trim()} />
              </View>
            ) : null}
          </Tarjeta>

          <Tarjeta titulo="Historial" icono="git-commit-outline" sinRelleno>
            {tarea.historial.map((h, i) => (
              <FilaLista key={i} ultima={i === tarea.historial.length - 1}>
                <View style={[estilos.punto, { backgroundColor: i === tarea.historial.length - 1 ? t.primario : t.textoTenue }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.texto }}>
                    {h.estado_anterior ? `${ESTADO_TAREA[h.estado_anterior]?.texto ?? h.estado_anterior} → ` : 'Creada · '}{ESTADO_TAREA[h.estado_nuevo]?.texto ?? h.estado_nuevo}
                  </Text>
                  <Text style={{ color: t.textoSuave, fontSize: 12 }}>{h.autor} · {fechaHoraCorta(h.created_at)}</Text>
                  {h.comentario ? <Text style={{ color: t.textoSuave, fontSize: 13, fontStyle: 'italic' }}>“{h.comentario}”</Text> : null}
                </View>
              </FilaLista>
            ))}
          </Tarjeta>
        </View>
      </View>

      <DialogoAsignar visible={dialogo === 'asignar'} tarea={tarea} alCerrar={() => setDialogo(null)}
        alAsignar={async (empleadoId) => {
          const r = await api(`/tareas/${id}/asignaciones`, { metodo: 'POST', cuerpo: { empleado_id: empleadoId } });
          setTarea(r);
          toast.exito('Persona asignada. Le llegó un aviso.');
        }} />

      <ConfirmDialog
        visible={Boolean(dialogo?.quitar)}
        titulo="Quitar asignación"
        mensaje={dialogo?.quitar ? `¿Quitar a ${dialogo.quitar.nombre} ${dialogo.quitar.apellido} de la tarea?` : ''}
        textoConfirmar="Quitar"
        alCerrar={() => setDialogo(null)}
        alConfirmar={async () => {
          try {
            setTarea(await api(`/tareas/${id}/asignaciones/${dialogo.quitar.id}`, { metodo: 'DELETE' }));
            toast.exito('Asignación quitada.');
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />

      <ConfirmDialog
        visible={['terminar', 'aprobar', 'rechazar', 'cancelar'].includes(dialogo)}
        titulo={{ terminar: 'Terminar tarea', aprobar: 'Aprobar tarea', rechazar: 'Rechazar tarea', cancelar: 'Cancelar tarea' }[dialogo] ?? ''}
        mensaje={{
          terminar: 'La tarea pasa a revisión del jefe del área.',
          aprobar: 'La tarea queda aprobada. Si es la última operación, la orden pasa a control de calidad.',
          rechazar: 'La tarea vuelve a las personas asignadas para rehacerla.',
          cancelar: 'La tarea se cancela y deja de contar para la orden.',
        }[dialogo] ?? ''}
        textoConfirmar={{ terminar: 'Terminar', aprobar: 'Aprobar', rechazar: 'Rechazar', cancelar: 'Cancelar tarea' }[dialogo] ?? ''}
        variante={{ terminar: 'exito', aprobar: 'exito', rechazar: 'peligro', cancelar: 'peligro' }[dialogo] ?? 'primario'}
        alCerrar={() => setDialogo(null)}
        alConfirmar={async () => {
          if (dialogo === 'rechazar' && !motivo.trim()) {
            setErrorMotivo('Escribí qué hay que corregir');
            throw new Error('falta el motivo');
          }
          const mensajes = { terminar: 'Tarea enviada a revisión.', aprobar: 'Tarea aprobada.', rechazar: 'Tarea devuelta para rehacer.', cancelar: 'Tarea cancelada.' };
          await accion(dialogo, { comentario: motivo.trim() || undefined }, mensajes[dialogo]);
        }}
      >
        <Campo etiqueta={dialogo === 'rechazar' ? 'Qué hay que corregir' : 'Comentario (opcional)'} value={motivo} onChangeText={setMotivo}
          error={errorMotivo} maxLength={500} multiline estilo={{ marginTop: espacio.l, marginBottom: 0 }} />
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  titulo: { fontSize: 21, fontWeight: '600', marginTop: espacio.s, marginBottom: 2 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, marginTop: espacio.m },
  alertaMaquina: { flexDirection: 'row', gap: espacio.s, padding: espacio.m, borderRadius: 6, marginTop: espacio.xs },
  candidato: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, borderWidth: 1, borderRadius: 8, padding: espacio.m, marginBottom: espacio.s },
  comentario: { flexDirection: 'row', gap: espacio.s, marginBottom: espacio.m },
  nuevoComentario: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s, marginTop: espacio.s },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
