// Ficha de una persona en una ventana (como el UserDetailModal de R3): se abre encima de la lista
// donde estás —Áreas, Personas, Buscar— y se cierra sin perder el lugar. Junta el legajo y la cuenta.
//
// Lo que se puede hacer depende de quién mira (lo decide la API en `acciones`):
//   Administrador → editar rol y cuenta, cambiar área/puesto/habilidades, mandar código, dar de baja.
//   Jefe de área  → ver a su gente y asignarle una tarea.
//   Gerencia      → solo consultar.
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Boton, Cargando, ErrorCarga, Insignia, InsigniaRol, Opciones } from './ui';
import ConfirmDialog from './ConfirmDialog';
import Contacto from './Contacto';
import UbicacionLaboral, { cuerpoUbicacion } from './UbicacionLaboral';
import { useJefatura, esCancelado } from './Jefatura';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { ESTADO_TAREA, fechaCorta, horaCorta } from '../modulos';
import { espacio, radio, sombra, useTema, usePantalla } from '../tema';

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

function Fila({ etiqueta, children }) {
  const t = useTema();
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={{ color: t.textoSuave, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>{etiqueta.toUpperCase()}</Text>
      {typeof children === 'string' ? <Text style={{ color: t.texto, fontSize: 15 }}>{children}</Text> : children}
    </View>
  );
}

export default function FichaPersona({ empleadoId, alCerrar, alCambiar }) {
  const t = useTema();
  const router = useRouter();
  const toast = useToast();
  const { esAncho } = usePantalla();
  const { conJefatura, dialogoJefatura } = useJefatura();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [pestana, setPestana] = useState('datos');
  const [rol, setRol] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await api(`/personas/${empleadoId}`);
      setP(d);
      setRol(d.cuenta?.rol ?? null);
      setUbicacion({
        area_id: d.area_id, area_codigo: d.area_codigo, area_nombre: d.area_nombre, puesto_id: d.puesto_id, puesto_nombre: d.puesto,
        habilidades: d.habilidades.map((h) => ({ habilidad_id: h.habilidad_id, nombre: h.nombre, nivel: h.nivel, requiere_certificacion: h.requiere_certificacion })),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [empleadoId]);
  useEffect(() => { if (empleadoId) { setPestana('datos'); setP(null); cargar(); } }, [empleadoId, cargar]);

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

  const guardarRol = () => ejecutar(() => conJefatura((jefeActual) => api(`/usuarios/${p.cuenta.id}`, {
    metodo: 'PUT', cuerpo: { rol, ...(jefeActual ? { jefe_actual: jefeActual } : {}) },
  })), 'Rol actualizado. Sus sesiones se cerraron para que rija enseguida.');
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
          <View style={[estilos.hoja, sombra, { backgroundColor: t.fondo, borderColor: t.borde }, esAncho ? estilos.hojaAncha : estilos.hojaCelular]}>
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
                      {a.editar_cuenta ? (
                        <>
                          <Fila etiqueta="Rol">
                            <Opciones opciones={ROLES} valor={rol} alCambiar={setRol} />
                          </Fila>
                          {rol !== p.cuenta.rol ? <Boton titulo="Guardar rol" icono="checkmark" onPress={guardarRol} cargando={guardando} /> : null}
                          <View style={estilos.linea}>
                            <Boton titulo="Mandar código para su contraseña" variante="secundario" chico icono="mail-outline"
                              onPress={() => ejecutar(() => api(`/usuarios/${p.cuenta.id}/restablecer-password`, { metodo: 'POST' }), 'Le mandamos el código por email.')} />
                            <Boton titulo={p.cuenta.activo ? 'Dar de baja' : 'Reactivar'} variante={p.cuenta.activo ? 'contornoPeligro' : 'secundario'} chico
                              icono={p.cuenta.activo ? 'person-remove-outline' : 'person-add-outline'} onPress={() => setConfirmar(p.cuenta.activo ? 'baja' : 'alta')} />
                          </View>
                        </>
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

                {/* Acciones fijas abajo */}
                {a.asignar_tarea ? (
                  <View style={[estilos.pie, { borderTopColor: t.borde }]}>
                    <Boton titulo={`Asignarle una tarea a ${p.nombre}`} icono="add-circle-outline" estilo={{ marginBottom: 0 }}
                      onPress={() => { alCerrar(); router.push(`/modulos/tareas/nueva?empleado=${p.id}`, { withAnchor: true }); }} />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <ConfirmDialog visible={Boolean(confirmar)} titulo={confirmar === 'baja' ? 'Dar de baja la cuenta' : 'Reactivar la cuenta'}
        mensaje={confirmar === 'baja' ? `${nombre} no va a poder entrar y se cierran sus sesiones. Su historia se conserva.` : `${nombre} va a poder entrar de nuevo.`}
        textoConfirmar={confirmar === 'baja' ? 'Dar de baja' : 'Reactivar'} variante={confirmar === 'baja' ? 'peligro' : 'primario'}
        alCerrar={() => setConfirmar(null)}
        alConfirmar={() => ejecutar(() => api(`/usuarios/${p.cuenta.id}`, { metodo: 'PUT', cuerpo: { activo: confirmar !== 'baja' } }),
          confirmar === 'baja' ? `${nombre} quedó dado de baja.` : `${nombre} está activo de nuevo.`)} />
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
