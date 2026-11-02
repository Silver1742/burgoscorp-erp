// Ficha de una persona en una ventana (como el UserDetailModal de R3): se abre encima de la lista
// donde estás —Áreas, Personas, Buscar— y se cierra sin perder el lugar. Junta el legajo y la cuenta.
//
// Lo que se puede hacer depende de quién mira (lo decide la API en `acciones`):
//   Administrador → la barra de acciones de abajo, como en R3: Editar (nombre y rol), Aprobar (si pidió
//                   acceso), Activar / Desactivar, Clave (le manda un código por email para que la cree:
//                   nunca se ve ni se inventa una contraseña) y Eliminar (si la cuenta no tiene actividad).
//                   Área, puesto y habilidades se cambian en su pestaña.
//   Jefe de área  → ver a su gente y asignarle una tarea.
//   Gerencia      → solo consultar.
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Boton, Campo, Cargando, ErrorCarga, Insignia, InsigniaRol, Opciones } from './ui';
import ConfirmDialog from './ConfirmDialog';
import Contacto from './Contacto';
import UbicacionLaboral, { cuerpoUbicacion } from './UbicacionLaboral';
import { useJefatura, esCancelado } from './Jefatura';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { ESTADO_TAREA, fechaCorta, horaCorta } from '../modulos';
import { espacio, radio, sombra, useTema, usePantalla } from '../tema';
import { useAlCambiar } from '../lib/cambios';

type FilaProps = {
  etiqueta?: any;
  children?: React.ReactNode;
};

type FichaPersonaProps = {
  empleadoId?: any;
  alCerrar?: (...args: any[]) => any;
  alCambiar?: (...args: any[]) => any;
};


const PESTANAS = [
  { valor: 'datos', titulo: 'Datos' },
  { valor: 'area', titulo: 'Área y habilidades' },
  { valor: 'cuenta', titulo: 'Cuenta' },
  { valor: 'tareas', titulo: 'Tareas' },
];
const ROLES = [
  { valor: 'EMPLEADO', titulo: 'Empleado' }, { valor: 'JEFE', titulo: 'Jefe de área' },
  { valor: 'GERENCIA', titulo: 'Gerencia' }, { valor: 'ADMIN', titulo: 'Administrador' },
];
const NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

function Fila({ etiqueta, children }: FilaProps) {
  const t = useTema();
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={{ color: t.textoSuave, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>{etiqueta.toUpperCase()}</Text>
      {typeof children === 'string' ? <Text style={{ color: t.texto, fontSize: 15 }}>{children}</Text> : children}
    </View>
  );
}

export default function FichaPersona({ empleadoId, alCerrar, alCambiar }: FichaPersonaProps) {
  const t = useTema();
  const router = useRouter();
  const toast = useToast();
  const { esAncho } = usePantalla();
  const insets = useSafeAreaInsets();
  const { conJefatura, dialogoJefatura } = useJefatura();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [pestana, setPestana] = useState('datos');
  const [ubicacion, setUbicacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // 'baja' | 'alta' | 'eliminar'
  const [editando, setEditando] = useState(null); // { nombre, apellido, rol, errores }

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await api(`/personas/${empleadoId}`);
      setP(d);
      setUbicacion({
        area_id: d.area_id, area_codigo: d.area_codigo, area_nombre: d.area_nombre, puesto_id: d.puesto_id, puesto_nombre: d.puesto,
        habilidades: d.habilidades.map((h) => ({ habilidad_id: h.habilidad_id, nombre: h.nombre, nivel: h.nivel, requiere_certificacion: h.requiere_certificacion })),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [empleadoId]);
  useEffect(() => { if (empleadoId) { setPestana('datos'); setP(null); cargar(); } }, [empleadoId, cargar]);
  useAlCambiar(() => { if (empleadoId) cargar(); });

  async function ejecutar(fn, mensaje) {
    setGuardando(true);
    try {
      await fn();
      toast.exito(mensaje);
      await cargar();
      alCambiar?.();
    } catch (err) {
      if (esCancelado(err)) toast.info(err.message);
      else toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const guardarArea = () => ejecutar(() => conJefatura((jefeActual) => api(`/usuarios/${p.cuenta.id}/legajo`, {
    metodo: 'PUT', cuerpo: { ...cuerpoUbicacion(ubicacion), ...(jefeActual ? { jefe_actual: jefeActual } : {}) },
  })), 'Área y habilidades actualizadas.');

  const a = p?.acciones ?? {};
  const visibles = PESTANAS.filter((x) => x.valor !== 'cuenta' || p?.cuenta);
  const nombre = p ? `${p.nombre} ${p.apellido}` : '';
  const presente = p?.hoy?.trabajando ? `Trabajando desde ${horaCorta(p.hoy.entrada)}` : p?.hoy?.entrada ? `Vino hoy ${horaCorta(p.hoy.entrada)}` : 'No fichó hoy';

  return (
    <>
      <Modal visible={Boolean(empleadoId)} transparent animationType={esAncho ? 'fade' : 'slide'} onRequestClose={alCerrar}>
        <View style={[estilos.fondo, esAncho && { justifyContent: 'center', alignItems: 'center' }]}>
          {/* En el celular la hoja sale desde abajo: se deja el alto de la barra del sistema (atrás, inicio,
              apps abiertas) para que el botón de abajo no quede tapado. */}
          <View style={[estilos.hoja, sombra, { backgroundColor: t.fondo, borderColor: t.borde }, esAncho ? estilos.hojaAncha : [estilos.hojaCelular, { paddingBottom: insets.bottom }]]}>
            {/* Cabecera */}
            <View style={[estilos.cabecera, { borderBottomColor: t.borde }]}>
              {p ? <Avatar nombre={nombre} tamano={48} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>{p ? nombre : 'Cargando…'}</Text>
                {p ? (
                  <View style={estilos.linea}>
                    {p.cuenta ? <InsigniaRol rol={p.cuenta.rol} /> : <Insignia texto="Sin cuenta" tono="aviso" />}
                    {p.es_jefe ? <Insignia texto="Jefe del área" tono="rojo" icono="star" /> : null}
                    <Text style={{ color: t.textoSuave, fontSize: 13 }}>{p.legajo} · {p.area_nombre}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={alCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
                <Ionicons name="close" size={24} color={t.textoSuave} />
              </Pressable>
            </View>

            {error ? <ErrorCarga error={error} onReintentar={cargar} /> : null}
            {!p && !error ? <Cargando /> : null}

            {p ? (
              <>
                <View style={{ paddingHorizontal: espacio.l, paddingTop: espacio.m }}>
                  <Opciones opciones={visibles} valor={pestana} alCambiar={setPestana} />
                </View>
                <ScrollView contentContainerStyle={{ padding: espacio.l, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
                  {pestana === 'datos' ? (
                    <>
                      <Fila etiqueta="Hoy">{presente}</Fila>
                      <Fila etiqueta="Puesto">{p.puesto ?? 'Sin puesto'}</Fila>
                      <Fila etiqueta="Supervisor">{p.supervisor ?? '—'}</Fila>
                      <Fila etiqueta="Ingreso">{fechaCorta(p.fecha_ingreso)}</Fila>
                      <Fila etiqueta="Email">{p.cuenta?.email ?? p.email_laboral ?? '—'}</Fila>
                      {p.telefono ? <Fila etiqueta="Teléfono"><Contacto telefono={p.telefono} /></Fila> : null}
                    </>
                  ) : null}

                  {pestana === 'area' ? (
                    a.editar_area && p.cuenta ? (
                      <>
                        <UbicacionLaboral valor={ubicacion} alCambiar={setUbicacion} />
                        <Boton titulo="Guardar área y habilidades" icono="checkmark" onPress={guardarArea} cargando={guardando} />
                      </>
                    ) : (
                      <>
                        <Fila etiqueta="Área">{p.area_nombre}</Fila>
                        <Fila etiqueta="Habilidades">
                          {p.habilidades.length ? p.habilidades.map((h) => (
                            <Text key={h.nombre} style={{ color: t.texto, fontSize: 15 }}>
                              • {h.nombre} ({NIVEL[h.nivel] ?? h.nivel}){h.requiere_certificacion ? ` · certificado hasta ${fechaCorta(h.certificado_vence)}` : ''}
                            </Text>
                          )) : <Text style={{ color: t.textoSuave }}>Sin habilidades cargadas</Text>}
                        </Fila>
                      </>
                    )
                  ) : null}

                  {pestana === 'cuenta' && p.cuenta ? (
                    <>
                      <Fila etiqueta="Estado">{p.cuenta.activo ? (p.cuenta.estado_cuenta === 'habilitada' ? 'Activa' : p.cuenta.estado_cuenta) : 'Dada de baja'}</Fila>
                      <Fila etiqueta="Último ingreso">{p.cuenta.ultimo_login_at ? `${fechaCorta(p.cuenta.ultimo_login_at)} ${horaCorta(p.cuenta.ultimo_login_at)}` : 'Nunca'}</Fila>
                      <Fila etiqueta="Verificación en dos pasos">{p.cuenta.dos_pasos ? 'Activada' : 'Desactivada'}</Fila>
                      <Fila etiqueta="Rol"><InsigniaRol rol={p.cuenta.rol} /></Fila>
                      {p.cuenta.estado_cuenta === 'pendiente' ? (
                        <Text style={{ color: t.textoSuave, marginTop: espacio.s }}>Pidió acceso y todavía no puede entrar: tocá "Aprobar".</Text>
                      ) : null}
                    </>
                  ) : null}

                  {pestana === 'tareas' ? (
                    p.tareas_abiertas.length ? p.tareas_abiertas.map((x) => (
                      <Pressable key={x.id} onPress={() => { alCerrar(); router.push(`/modulos/tareas/${x.id}`, { withAnchor: true }); }} accessibilityRole="button"
                        style={[estilos.tarea, { borderColor: t.borde, backgroundColor: t.superficie }]}>
                        <Text style={{ color: t.texto, flex: 1 }} numberOfLines={1}>{x.titulo}</Text>
                        <Insignia texto={ESTADO_TAREA[x.estado]?.texto ?? x.estado} tono={ESTADO_TAREA[x.estado]?.tono} />
                      </Pressable>
                    )) : <Text style={{ color: t.textoSuave }}>No tiene tareas abiertas.</Text>
                  ) : null}
                </ScrollView>

                {/* Acciones fijas abajo, siempre a la vista (como la barra de acciones de cada usuario en R3). */}
                {a.editar_cuenta || a.asignar_tarea ? (
                  <View style={[estilos.pie, { borderTopColor: t.borde }]}>
                    {a.editar_cuenta ? (
                      <View style={[estilos.linea, { marginTop: 0, marginBottom: a.asignar_tarea ? espacio.s : 0 }]}>
                        <Boton titulo="Editar" variante="secundario" chico icono="create-outline" estilo={{ marginBottom: 0 }}
                          onPress={() => setEditando({ nombre: p.cuenta.nombre ?? p.nombre, apellido: p.cuenta.apellido ?? p.apellido, rol: p.cuenta.rol, errores: {} })} />
                        {p.cuenta.estado_cuenta === 'pendiente' ? (
                          <Boton titulo="Aprobar" variante="exito" chico icono="person-add-outline" estilo={{ marginBottom: 0 }}
                            onPress={() => { alCerrar(); router.push('/modulos/usuarios/solicitudes', { withAnchor: true }); }} />
                        ) : (
                          <Boton titulo={p.cuenta.activo ? 'Desactivar' : 'Activar'} variante={p.cuenta.activo ? 'aviso' : 'exito'} chico
                            icono={p.cuenta.activo ? 'person-remove-outline' : 'person-add-outline'} estilo={{ marginBottom: 0 }}
                            onPress={() => setConfirmar(p.cuenta.activo ? 'baja' : 'alta')} />
                        )}
                        {p.cuenta.activo && p.cuenta.estado_cuenta === 'habilitada' ? (
                          <Boton titulo="Clave" variante="secundario" chico icono="key-outline" estilo={{ marginBottom: 0 }}
                            onPress={() => setConfirmar('clave')} />
                        ) : null}
                        {a.eliminar_cuenta ? (
                          <Boton titulo="Eliminar" variante="contornoPeligro" chico icono="trash-outline" estilo={{ marginBottom: 0 }}
                            onPress={() => setConfirmar('eliminar')} />
                        ) : null}
                      </View>
                    ) : null}
                    {a.asignar_tarea ? (
                      <Boton titulo={`Asignarle una tarea a ${p.nombre}`} icono="add-circle-outline" estilo={{ marginBottom: 0 }}
                        onPress={() => { alCerrar(); router.push(`/modulos/tareas/nueva?empleado=${p.id}`, { withAnchor: true }); }} />
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ConfirmDialog visible={confirmar === 'baja' || confirmar === 'alta'} titulo={confirmar === 'baja' ? 'Dar de baja la cuenta' : 'Reactivar la cuenta'}
        mensaje={confirmar === 'baja' ? `${nombre} no va a poder entrar y se cierran sus sesiones. Su historia se conserva.` : `${nombre} va a poder entrar de nuevo.`}
        textoConfirmar={confirmar === 'baja' ? 'Dar de baja' : 'Reactivar'} variante={confirmar === 'baja' ? 'peligro' : 'primario'}
        alCerrar={() => setConfirmar(null)}
        alConfirmar={() => ejecutar(() => api(`/usuarios/${p.cuenta.id}`, { metodo: 'PUT', cuerpo: { activo: confirmar !== 'baja' } }),
          confirmar === 'baja' ? `${nombre} quedó dado de baja.` : `${nombre} está activo de nuevo.`)} />
      <ConfirmDialog visible={confirmar === 'clave'} titulo="Clave: mandar código por email" textoConfirmar="Mandar" variante="primario"
        mensaje={`Le llega a ${p?.cuenta?.email ?? 'su email'} un código de 6 dígitos (vale 10 minutos) para crear su contraseña. Vos nunca ves ni inventás su contraseña.`}
        alCerrar={() => setConfirmar(null)}
        alConfirmar={() => ejecutar(() => api(`/usuarios/${p.cuenta.id}/restablecer-password`, { metodo: 'POST' }), 'Le mandamos el código por email.')} />
      <ConfirmDialog visible={confirmar === 'eliminar'} titulo="Eliminar la cuenta" textoConfirmar="Eliminar" variante="peligro"
        mensaje={`Vas a eliminar definitivamente la cuenta de ${nombre}. No se puede deshacer. Solo se puede si la cuenta no tiene actividad; si la tiene, dala de baja. El legajo se conserva.`}
        alCerrar={() => setConfirmar(null)}
        alConfirmar={async () => {
          try {
            await api(`/usuarios/${p.cuenta.id}`, { metodo: 'DELETE' });
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
          toast.exito(`La cuenta de ${nombre} fue eliminada.`);
          await cargar();
          alCambiar?.();
        }} />
      <ConfirmDialog visible={Boolean(editando)} titulo={`Editar a ${nombre}`} textoConfirmar="Guardar" variante="primario"
        alCerrar={() => setEditando(null)}
        alConfirmar={async () => {
          const e: Record<string, any> = {};
          if (!editando.nombre.trim()) e.nombre = 'Escribí el nombre';
          if (!editando.apellido.trim()) e.apellido = 'Escribí el apellido';
          if (Object.keys(e).length) { setEditando((x) => ({ ...x, errores: e })); throw new Error('datos'); }
          const cambiaRol = editando.rol !== p.cuenta.rol;
          const cuerpo = { nombre: editando.nombre.trim(), apellido: editando.apellido.trim(), ...(cambiaRol ? { rol: editando.rol } : {}) };
          try {
            // Si pasa a ser jefe de un área que ya tiene jefe, primero pregunta qué hacer con el actual.
            await conJefatura((jefeActual) => api(`/usuarios/${p.cuenta.id}`, { metodo: 'PUT', cuerpo: { ...cuerpo, ...(jefeActual ? { jefe_actual: jefeActual } : {}) } }));
          } catch (err) {
            if (esCancelado(err)) { toast.info(err.message); throw err; }
            setEditando((x) => ({ ...x, errores: err.porCampo ?? {} }));
            toast.error(err.message);
            throw err;
          }
          toast.exito(cambiaRol ? 'Datos guardados. Cambió el rol: sus sesiones se cerraron para que rija enseguida.' : 'Datos guardados en la cuenta y en el legajo.');
          await cargar();
          alCambiar?.();
        }}>
        {editando ? (
          <View style={{ marginTop: espacio.s }}>
            <Campo etiqueta="Nombre" value={editando.nombre} maxLength={60} error={editando.errores.nombre}
              onChangeText={(v) => setEditando((x) => ({ ...x, nombre: v }))} />
            <Campo etiqueta="Apellido" value={editando.apellido} maxLength={60} error={editando.errores.apellido}
              onChangeText={(v) => setEditando((x) => ({ ...x, apellido: v }))} />
            <Text style={{ color: t.texto, marginBottom: 6 }}>Rol</Text>
            <Opciones opciones={ROLES} valor={editando.rol} alCambiar={(v) => setEditando((x) => ({ ...x, rol: v }))} />
            <Text style={{ color: t.textoSuave, fontSize: 12, marginTop: 6 }}>El área, el puesto y las habilidades se cambian en la pestaña "Área y habilidades".</Text>
          </View>
        ) : null}
      </ConfirmDialog>
      {dialogoJefatura}
    </>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  hoja: { borderWidth: 1, overflow: 'hidden' },
  hojaCelular: { maxHeight: '92%', borderTopLeftRadius: radio.xl * 1.5, borderTopRightRadius: radio.xl * 1.5 },
  hojaAncha: { width: '92%', maxWidth: 720, maxHeight: '88%', borderRadius: radio.xl },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: espacio.l, borderBottomWidth: 1 },
  linea: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tarea: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.l, padding: espacio.m, marginBottom: 6 },
  pie: { padding: espacio.m, borderTopWidth: 1 },
});
