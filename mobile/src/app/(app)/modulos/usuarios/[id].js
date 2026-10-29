// Ficha de un usuario (como el UserDetailModal de R3) con sus acciones: editar, dar de baja o
// reactivar, mandarle el código para crear su contraseña y eliminarlo (solo si no tiene actividad).
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pantalla, Tarjeta, Insignia, InsigniaRol, Avatar, Boton, Campo, Opciones, Dato, Cargando, ErrorCarga, Texto,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Selector from '../../../../componentes/Selector';
import { usePuede, useSesion } from '../../../../contexto/sesion';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { estadoUsuario, haceCuanto, metodoIngreso } from '../../../../lib/usuarios';
import { ROLES, fechaHoraCorta } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const OPCIONES_ROL = ['EMPLEADO', 'JEFE', 'GERENCIA', 'ADMIN'].map((valor) => ({ valor, titulo: ROLES[valor] }));

export default function Usuario() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const puede = usePuede();
  const { usuario: yo } = useSesion();
  const toast = useToast();
  const t = useTema();
  const [u, setU] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // copia editable
  const [erroresEdicion, setErroresEdicion] = useState({});
  const [confirmar, setConfirmar] = useState(null); // { titulo, mensaje, texto, variante, accion }

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setU(await api(`/usuarios/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!u) return <Pantalla><Cargando texto="Cargando usuario…" /></Pantalla>;

  const esYo = u.id === yo.id;
  const estado = estadoUsuario(u);
  const habilitada = u.estado_cuenta === 'habilitada';
  const nombre = `${u.nombre} ${u.apellido}`;

  async function ejecutar(accion, mensaje) {
    try {
      const r = await accion();
      toast.exito(mensaje ?? r?.mensaje ?? 'Listo');
      await cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function guardarEdicion() {
    setErroresEdicion({});
    const cuerpo = {};
    if (editando.nombre.trim() !== u.nombre) cuerpo.nombre = editando.nombre.trim();
    if (editando.apellido.trim() !== u.apellido) cuerpo.apellido = editando.apellido.trim();
    if (!esYo && editando.rol !== u.rol) cuerpo.rol = editando.rol;
    if ((editando.empleado_id ?? null) !== (u.empleado_id ?? null)) cuerpo.empleado_id = editando.empleado_id ?? null;
    if (!Object.keys(cuerpo).length) return;
    try {
      await ejecutar(() => api(`/usuarios/${u.id}`, { metodo: 'PUT', cuerpo }), 'Cambios guardados');
    } catch (err) {
      setErroresEdicion(err.porCampo ?? {});
      throw err;
    }
  }

  return (
    <Pantalla>
      <Stack.Screen options={{ title: nombre }} />

      <Tarjeta acentoArriba>
        <View style={estilos.cabecera}>
          <Avatar nombre={nombre} tamano={64} />
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={[estilos.nombre, { color: t.texto }]}>{nombre}{esYo ? '  ·  Vos' : ''}</Text>
            <Text style={{ color: t.textoSuave }} selectable>{u.email}</Text>
            <View style={[estilos.fila, { marginTop: espacio.s }]}>
              <InsigniaRol rol={u.rol} />
              <Insignia texto={estado.texto} tono={estado.tono} icono={estado.icono} />
              {u.dos_pasos ? <Insignia texto="2FA activo" tono="exito" icono="shield-checkmark" /> : null}
            </View>
          </View>
        </View>
      </Tarjeta>

      <Tarjeta titulo="Datos" icono="information-circle-outline">
        <View style={estilos.datos}>
          <Dato etiqueta="Legajo">{u.legajo ?? 'Sin legajo'}</Dato>
          <Dato etiqueta="Área">{u.area_nombre ?? '—'}</Dato>
          <Dato etiqueta="Puesto">{u.puesto_nombre ?? '—'}</Dato>
          <Dato etiqueta="Cómo entra">{metodoIngreso(u.redes)}</Dato>
          <Dato etiqueta="Email">{u.email_verificado ? 'Verificado' : 'Sin verificar'}</Dato>
          <Dato etiqueta="Último ingreso">{u.ultimo_login_at ? haceCuanto(u.ultimo_login_at) : 'Nunca'}</Dato>
          <Dato etiqueta="Alta">{fechaHoraCorta(u.created_at)}</Dato>
          {u.motivo_rechazo ? <Dato etiqueta="Motivo del rechazo">{u.motivo_rechazo}</Dato> : null}
        </View>
        {!u.legajo && u.rol !== 'ADMIN' && habilitada ? (
          <Texto suave estilo={{ fontSize: 13 }}>Sin legajo la persona entra pero no ve ningún módulo: editala y vinculala a su legajo.</Texto>
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Acciones" icono="flash-outline">
        {u.estado_cuenta === 'pendiente' ? (
          <>
            <Texto suave estilo={{ marginBottom: espacio.m }}>Esta persona pidió acceso y todavía no puede entrar.</Texto>
            <Boton titulo="Revisar la solicitud" icono="person-add" variante="exito"
              onPress={() => router.push('/modulos/usuarios/solicitudes')} />
          </>
        ) : null}

        {puede('SEG', 'editar') && habilitada ? (
          <Boton titulo="Editar datos, rol o legajo" icono="create-outline" variante="secundario"
            onPress={() => { setErroresEdicion({}); setEditando({ nombre: u.nombre, apellido: u.apellido, rol: u.rol, empleado_id: u.empleado_id, legajo: u.legajo }); }} />
        ) : null}

        {puede('SEG', 'editar') && habilitada && u.activo ? (
          <Boton titulo="Mandarle un código para crear su contraseña" icono="mail-outline" variante="secundario"
            onPress={() => setConfirmar({
              titulo: 'Mandar código por email', texto: 'Mandar', variante: 'primario',
              mensaje: `Le llega a ${u.email} un código de 6 dígitos (vale 10 minutos). En la app toca "¿Olvidaste tu contraseña?" → "Ya tengo un código". Vos nunca ves su contraseña.`,
              accion: () => ejecutar(() => api(`/usuarios/${u.id}/restablecer-password`, { metodo: 'POST' })),
            })} />
        ) : null}

        {puede('SEG', 'editar') && habilitada && !esYo ? (
          u.activo ? (
            <Boton titulo="Dar de baja" icono="pause-circle-outline" variante="aviso"
              onPress={() => setConfirmar({
                titulo: `¿Dar de baja a ${nombre}?`, texto: 'Dar de baja', variante: 'aviso',
                mensaje: 'No va a poder entrar y se cierran todas sus sesiones. Su historia (tareas, compras, fichajes) se conserva. Podés reactivarla cuando quieras.',
                accion: () => ejecutar(() => api(`/usuarios/${u.id}`, { metodo: 'PUT', cuerpo: { activo: false } }), `${nombre} quedó dado de baja`),
              })} />
          ) : (
            <Boton titulo="Reactivar" icono="play-circle-outline" variante="exito"
              onPress={() => setConfirmar({
                titulo: `¿Reactivar a ${nombre}?`, texto: 'Reactivar', variante: 'exito',
                mensaje: 'Va a poder volver a entrar con su contraseña.',
                accion: () => ejecutar(() => api(`/usuarios/${u.id}`, { metodo: 'PUT', cuerpo: { activo: true } }), `${nombre} está activo de nuevo`),
              })} />
          )
        ) : null}

        {puede('SEG', 'borrar') && !esYo ? (
          <Boton titulo="Eliminar" icono="trash-outline" variante="contornoPeligro"
            onPress={() => setConfirmar({
              titulo: 'Eliminar usuario', texto: 'Eliminar', variante: 'peligro',
              mensaje: `Vas a eliminar definitivamente la cuenta de ${nombre}. No se puede deshacer. Solo se puede si la cuenta no tiene actividad; si la tiene, dala de baja.`,
              accion: async () => {
                try {
                  await api(`/usuarios/${u.id}`, { metodo: 'DELETE' });
                } catch (err) {
                  toast.error(err.message);
                  throw err;
                }
                toast.exito(`La cuenta de ${nombre} fue eliminada`);
                router.back();
              },
            })} />
        ) : null}

        {esYo ? <Texto suave estilo={{ fontSize: 13 }}>Es tu cuenta: no podés cambiarte el rol, darte de baja ni eliminarte.</Texto> : null}
      </Tarjeta>

      <ConfirmDialog visible={Boolean(editando)} titulo="Editar usuario" variante="primario" textoConfirmar="Guardar"
        alConfirmar={guardarEdicion} alCerrar={() => setEditando(null)}>
        {editando ? (
          <>
            <Campo etiqueta="Nombre" value={editando.nombre} onChangeText={(v) => setEditando((e) => ({ ...e, nombre: v }))}
              maxLength={60} error={erroresEdicion.nombre} />
            <Campo etiqueta="Apellido" value={editando.apellido} onChangeText={(v) => setEditando((e) => ({ ...e, apellido: v }))}
              maxLength={60} error={erroresEdicion.apellido} />
            {!esYo ? (
              <>
                <Text style={[estilos.etiqueta, { color: t.texto }]}>Rol</Text>
                <Opciones opciones={OPCIONES_ROL} valor={editando.rol} alCambiar={(rol) => setEditando((e) => ({ ...e, rol }))} />
              </>
            ) : null}
            <Selector etiqueta="Legajo del empleado" ruta="/empleados" consulta={{ estado: 'activo' }} valor={editando.empleado_id}
              textoValor={editando.legajo} opcional placeholder="Sin legajo (no ve módulos)"
              alCambiar={(empleadoId, e) => setEditando((x) => ({ ...x, empleado_id: empleadoId, legajo: e ? `${e.legajo} · ${e.apellido}, ${e.nombre}` : null }))}
              mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.legajo} · ${e.area_nombre}${e.usuario_id && e.usuario_id !== u.id ? ' · ya tiene cuenta' : ''}` })}
              estilo={{ marginBottom: 0 }} />
            {editando.rol !== u.rol ? (
              <Texto suave estilo={{ fontSize: 13, marginTop: espacio.m }}>Al cambiar el rol se cierran sus sesiones para que el cambio rija enseguida.</Texto>
            ) : null}
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(confirmar)} titulo={confirmar?.titulo} mensaje={confirmar?.mensaje}
        textoConfirmar={confirmar?.texto} variante={confirmar?.variante}
        alConfirmar={() => confirmar.accion()} alCerrar={() => setConfirmar(null)} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.l, flexWrap: 'wrap' },
  nombre: { fontSize: 20, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m },
  etiqueta: { fontSize: 15, marginBottom: 6 },
});
