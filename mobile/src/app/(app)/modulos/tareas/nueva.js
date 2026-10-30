// Alta de una tarea suelta (sin orden de trabajo): ej. "Inventario del pañol".
//  - Un jefe la crea en su área y después la asigna él.
//  - El administrador elige a qué área (o áreas) va: la app sugiere la de la máquina o la que tiene
//    gente con la habilidad pedida. Se crea una tarea por área y a cada jefe le llega el aviso para
//    que la asigne a alguien de su equipo (el jefe es quien conoce a su gente).
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Opciones, Boton, Esqueleto, useMostrarError } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { useSesion } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { PRIORIDAD } from '../../../../modulos';
import { espacio, radio, useTema, usePantalla } from '../../../../tema';

const OPC_PRIORIDAD = Object.entries(PRIORIDAD).map(([valor, p]) => ({ valor, titulo: p.texto }));

// Nombres de la API → campos del formulario (la fecha y la hora se mandan juntas).
const CAMPO_FORM = { fecha_limite: 'fecha' };

/** Elección de las áreas a las que se manda la tarea, con la sugerencia del sistema. */
function Destino({ centroId, habilidadId, elegidas, alCambiar, error }) {
  const t = useTema();
  const [datos, setDatos] = useState(null);
  const tocadas = useRef(false); // si la persona ya eligió a mano, no se pisa su elección
  const contenedor = useMostrarError(error);

  useEffect(() => {
    let vigente = true;
    api('/tareas/destinos', { consulta: { centro_trabajo_id: centroId, habilidad_requerida_id: habilidadId } })
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        if (d.area_fija) alCambiar([d.area_fija]);
        else if (!tocadas.current && d.sugeridas.length) alCambiar(d.sugeridas);
      })
      .catch(() => vigente && setDatos({ areas: [], sugeridas: [], motivo: null }));
    return () => { vigente = false; };
    // alCambiar es estable (setState del padre)
  }, [centroId, habilidadId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!datos) return <View style={{ gap: 8 }}><Esqueleto ancho="60%" /><Esqueleto /><Esqueleto ancho="80%" /></View>;

  function alternar(id) {
    tocadas.current = true;
    alCambiar(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);
  }
  const todas = datos.areas.length > 0 && elegidas.length === datos.areas.length;

  return (
    <View ref={contenedor}>
      {datos.motivo ? (
        <View style={[estilos.sugerencia, { backgroundColor: t.superficieSec, borderColor: t.borde }]}>
          <Ionicons name="bulb-outline" size={18} color={t.primario} />
          <Text style={{ color: t.texto, flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>Sugerencia: </Text>{datos.motivo}
          </Text>
        </View>
      ) : (
        <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>
          Elegí una máquina o una habilidad y te sugerimos el área. También podés elegirla a mano.
        </Text>
      )}
      {datos.area_fija ? (
        <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>Con máquina, la tarea va al área de la máquina.</Text>
      ) : (
        <Boton titulo={todas ? 'Quitar todas' : 'Todas las áreas'} variante="texto" chico icono={todas ? 'remove-circle-outline' : 'albums-outline'}
          onPress={() => { tocadas.current = true; alCambiar(todas ? [] : datos.areas.map((a) => a.id)); }} estilo={{ alignSelf: 'flex-start', marginBottom: espacio.s }} />
      )}
      <View style={{ gap: espacio.s }}>
        {datos.areas.map((a) => {
          const activa = elegidas.includes(a.id);
          const bloqueada = Boolean(datos.area_fija) && a.id !== datos.area_fija;
          if (bloqueada) return null;
          return (
            <Pressable key={a.id} onPress={() => !datos.area_fija && alternar(a.id)} accessibilityRole="checkbox" accessibilityState={{ checked: activa }}
              style={[estilos.area, { borderColor: activa ? t.primario : error ? t.error : t.borde, backgroundColor: activa ? t.superficieSec : t.superficie }]}>
              <Ionicons name={activa ? 'checkbox' : 'square-outline'} size={20} color={activa ? t.primario : t.textoSuave} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>
                  {a.nombre}{a.sugerida ? <Text style={{ color: t.primario, fontWeight: '400' }}>  · sugerida</Text> : null}
                </Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>
                  {a.jefe ? `La asigna ${a.jefe}` : 'Sin jefe: la asignás vos'}
                  {habilidadId || centroId ? ` · ${a.pueden} ${a.pueden === 1 ? 'puede hacerla' : 'pueden hacerla'}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ color: t.error, fontSize: 13, marginTop: espacio.s }}>{error}</Text> : null}
    </View>
  );
}

export default function NuevaTarea() {
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const { permisos } = useSesion();
  const { ancho } = usePantalla();
  // Quien ve las tareas de toda la empresa (el administrador) elige a qué áreas mandarla.
  const deEmpresa = permisos?.TAR?.alcance === 'todo';
  const [f, setF] = useState({ titulo: '', descripcion: '', prioridad: 'media', fecha: '', hora: '17:00', horas_estimadas: '', centro_trabajo_id: null, habilidad_requerida_id: null, checklist: '' });
  const [areas, setAreas] = useState([]);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const dos = ancho >= 520;

  async function guardar() {
    const e = {};
    if (!f.titulo.trim()) e.titulo = 'Escribí qué hay que hacer';
    if (f.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Formato AAAA-MM-DD';
    else if (f.fecha && Number.isNaN(new Date(`${f.fecha}T00:00:00`).getTime())) e.fecha = 'Esa fecha no existe';
    if (f.fecha && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.hora)) e.hora = 'Formato HH:MM';
    if (f.horas_estimadas && !/^\d+([.,]\d{1,2})?$/.test(f.horas_estimadas)) e.horas_estimadas = 'Número de horas (ej. 2,5)';
    if (deEmpresa && !areas.length) e.area_ids = 'Elegí a qué área va la tarea';
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los datos marcados en rojo');
      return;
    }

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
          area_ids: deEmpresa ? areas : undefined,
        },
      });
      if (!deEmpresa) {
        toast.exito('Tarea creada. Asignala a alguien de tu equipo.');
        router.replace(`/modulos/tareas/${tarea.id}`);
      } else if (tarea.creadas.length === 1) {
        const [c] = tarea.creadas;
        toast.exito(c.jefe ? `Tarea enviada a ${c.jefe} (${c.area_nombre}) para que la asigne.` : `Tarea creada en ${c.area_nombre}. El área no tiene jefe: asignala vos.`);
        router.replace(`/modulos/tareas/${tarea.id}`);
      } else {
        toast.exito(`Se creó una tarea en cada una de las ${tarea.creadas.length} áreas. Cada jefe recibió el aviso para asignarla.`);
        router.replace('/modulos/tareas');
      }
    } catch (err) {
      const porCampo = {};
      for (const [c, m] of Object.entries(err.porCampo ?? {})) porCampo[CAMPO_FORM[c] ?? c.split('.')[0]] = m;
      setErrores(porCampo);
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nueva tarea" icono="add-circle"
        sub={deEmpresa
          ? 'Elegí a qué área va: el jefe de cada área recibe el aviso y la asigna a alguien de su equipo.'
          : 'Una tarea de tu área que no forma parte de una orden de trabajo.'} />
      <Tarjeta titulo="Qué hay que hacer" icono="create-outline">
        <Campo etiqueta="Título" value={f.titulo} onChangeText={cambiar('titulo')} error={errores.titulo} maxLength={150} placeholder="Ej.: Inventario del pañol" />
        <Campo etiqueta="Descripción (opcional)" value={f.descripcion} onChangeText={cambiar('descripcion')} error={errores.descripcion} maxLength={5000} multiline numberOfLines={3} />
        <Text style={[estilos.etiqueta, { color: t.texto }]}>Prioridad</Text>
        <Opciones opciones={OPC_PRIORIDAD} valor={f.prioridad} alCambiar={cambiar('prioridad')} error={errores.prioridad} />
        <View style={dos && estilos.fila}>
          <Campo etiqueta="Vence (opcional)" value={f.fecha} onChangeText={cambiar('fecha')} error={errores.fecha} placeholder="AAAA-MM-DD" maxLength={10} estilo={dos && { flex: 2 }} />
          <Campo etiqueta="Hora" value={f.hora} onChangeText={cambiar('hora')} error={errores.hora} placeholder="HH:MM" maxLength={5} estilo={dos && { flex: 1 }} />
          <Campo etiqueta="Horas estimadas" value={f.horas_estimadas} onChangeText={cambiar('horas_estimadas')} error={errores.horas_estimadas} keyboardType="decimal-pad" maxLength={6} estilo={dos && { flex: 1 }} />
        </View>
      </Tarjeta>
      <Tarjeta titulo="Requisitos" icono="construct-outline">
        <Selector etiqueta="Máquina / puesto (opcional)" ruta="/centros-trabajo" consulta={{ activo: 'true' }} valor={f.centro_trabajo_id} opcional
          placeholder="Sin máquina" alCambiar={cambiar('centro_trabajo_id')} error={errores.centro_trabajo_id}
          mapear={(c) => ({ titulo: `${c.codigo} · ${c.nombre}`, sub: c.area_nombre })} />
        <Selector etiqueta="Habilidad requerida (opcional)" ruta="/habilidades" valor={f.habilidad_requerida_id} opcional
          placeholder="Si elegís una máquina, se usa la suya" alCambiar={cambiar('habilidad_requerida_id')} error={errores.habilidad_requerida_id}
          mapear={(h) => ({ titulo: h.nombre, sub: h.requiere_certificacion ? 'Requiere certificación' : null })} />
        <Campo etiqueta="Lista de control (una por línea, opcional)" value={f.checklist} onChangeText={cambiar('checklist')} error={errores.checklist} multiline numberOfLines={3} maxLength={2000} />
      </Tarjeta>
      {deEmpresa ? (
        <Tarjeta titulo="¿A qué área va?" icono="git-branch-outline">
          <Destino centroId={f.centro_trabajo_id} habilidadId={f.habilidad_requerida_id} elegidas={areas}
            alCambiar={(v) => { setAreas(v); setErrores((x) => ({ ...x, area_ids: undefined })); }} error={errores.area_ids} />
        </Tarjeta>
      ) : null}
      <View style={estilos.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} estilo={{ flex: 1 }} />
        <Boton titulo={deEmpresa ? (areas.length > 1 ? `Enviar a ${areas.length} áreas` : 'Enviar al jefe') : 'Crear tarea'} icono="checkmark"
          onPress={guardar} cargando={enviando} textoCargando="Creando…" estilo={{ flex: 1 }} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: espacio.m },
  sugerencia: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start', borderWidth: 1, borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.m },
  area: { flexDirection: 'row', gap: espacio.m, alignItems: 'center', borderWidth: 1, borderRadius: radio.m, padding: espacio.m },
});
