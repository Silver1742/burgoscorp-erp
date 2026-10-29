// Solicitudes de acceso (como en el portal R3): quien se registra queda pendiente hasta que el
// administrador lo habilita o lo rechaza con un motivo. Al habilitarlo se elige su rol y dónde va a
// trabajar (área, puesto y habilidades): con eso se le crea el legajo solo. En los dos casos le llega un email.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, EncabezadoPagina, Tarjeta, Insignia, Boton, Campo, Opciones, EsqueletoLista, ErrorCarga, Vacio, Avatar, Dato, Casilla,
} from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Selector from '../../../../componentes/Selector';
import UbicacionLaboral, { UBICACION_VACIA, cuerpoUbicacion } from '../../../../componentes/UbicacionLaboral';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ROLES, fechaCorta, fechaHoraCorta } from '../../../../modulos';
import { espacio, radio, useTema } from '../../../../tema';

const OPCIONES_ROL = ['EMPLEADO', 'JEFE', 'GERENCIA', 'ADMIN'].map((valor) => ({ valor, titulo: ROLES[valor] }));

/** Qué va a poder hacer la persona con cada rol (resumen de la matriz de permisos). */
const ALCANCE_ROL = {
  EMPLEADO: 'Sus tareas, fichaje, licencias y su legajo; carga datos en los módulos de su área.',
  JEFE: 'Gestiona su área: asigna tareas, aprueba licencias, compras y calidad; ve el tablero de su área.',
  GERENCIA: 'Ve todos los módulos y el tablero de la empresa, sin poder modificar nada.',
  ADMIN: 'Acceso total, incluidos usuarios, roles y seguridad. Reservalo para quien administra el sistema.',
};

const METODO = { google: 'Google', github: 'GitHub', facebook: 'Facebook' };

/** Para comparar nombres sin mayúsculas, tildes ni espacios de más. */
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Avisos al vincular la cuenta con un legajo: que sea la misma persona y que el legajo esté libre. */
function controles(usuario, empleado) {
  if (!empleado) return [];
  const avisos = [];
  if (empleado.usuario_id) avisos.push({ tono: 'error', texto: 'Este legajo ya tiene una cuenta. Elegí otro o dejalo sin legajo.' });
  const mismoApellido = normalizar(usuario.apellido) === normalizar(empleado.apellido);
  const mismoNombre = normalizar(usuario.nombre).split(/\s+/)[0] === normalizar(empleado.nombre).split(/\s+/)[0];
  if (!mismoApellido || !mismoNombre) {
    avisos.push({ tono: 'aviso', texto: `El nombre no coincide: pidió acceso como "${usuario.nombre} ${usuario.apellido}" y el legajo es de "${empleado.nombre} ${empleado.apellido}". Revisá que sea la misma persona.` });
  }
  if (empleado.email_laboral && normalizar(empleado.email_laboral) !== normalizar(usuario.email)) {
    avisos.push({ tono: 'aviso', texto: `El email laboral del legajo es ${empleado.email_laboral}, distinto del que usó para pedir acceso.` });
  }
  if (empleado.estado && empleado.estado !== 'activo') {
    avisos.push({ tono: 'aviso', texto: `El legajo está en estado "${empleado.estado}".` });
  }
  return avisos;
}

/** Ficha de quién pide acceso y de su legajo: el que se le va a crear o el existente que se eligió. */
function VistaPrevia({ usuario, empleado, rol, ubicacion }) {
  const t = useTema();
  const avisos = controles(usuario, empleado);
  const redes = usuario.redes ? usuario.redes.split(',').map((r) => METODO[r] ?? r).join(', ') : null;
  return (
    <View>
      <View style={[estilos.ficha, { borderColor: t.borde, backgroundColor: t.superficieSec }]}>
        <View style={estilos.fila}>
          <Avatar nombre={`${usuario.nombre} ${usuario.apellido}`} tamano={44} />
          <View style={{ flex: 1 }}>
            <Text style={[estilos.nombre, { color: t.texto }]}>{usuario.nombre} {usuario.apellido}</Text>
            <Text style={{ color: t.textoSuave }} selectable>{usuario.email}</Text>
          </View>
        </View>
        <View style={[estilos.fila, { marginTop: espacio.s }]}>
          <Insignia texto={usuario.email_verificado ? 'Email verificado' : 'Email a verificar al entrar'}
            tono={usuario.email_verificado ? 'exito' : 'gris'} icono={usuario.email_verificado ? 'checkmark-circle' : 'mail-outline'} />
          <Insignia texto={redes ? `Entró con ${redes}` : 'Email y contraseña'} icono={redes ? 'people-outline' : 'key-outline'} />
        </View>
        <Text style={{ color: t.textoSuave, fontSize: 13, marginTop: espacio.s }}>Pidió acceso el {fechaHoraCorta(usuario.created_at)}</Text>
      </View>

      {!empleado && ubicacion?.area_id ? (
        <View style={[estilos.ficha, { borderColor: t.borde }]}>
          <Text style={[estilos.subtitulo, { color: t.textoSuave }]}>SE LE CREA EL LEGAJO</Text>
          <View style={estilos.datos}>
            <Dato etiqueta="Área">{ubicacion.area_nombre}</Dato>
            <Dato etiqueta="Puesto">{ubicacion.puesto_nombre ?? '—'}</Dato>
            <Dato etiqueta="Habilidades">{ubicacion.habilidades.length ? ubicacion.habilidades.map((h) => h.nombre).join(', ') : 'Ninguna todavía'}</Dato>
          </View>
        </View>
      ) : null}

      {empleado ? (
        <View style={[estilos.ficha, { borderColor: t.borde }]}>
          <Text style={[estilos.subtitulo, { color: t.textoSuave }]}>LEGAJO QUE SE VINCULA</Text>
          <View style={estilos.datos}>
            <Dato etiqueta="Legajo">{empleado.legajo}</Dato>
            <Dato etiqueta="Empleado">{`${empleado.apellido}, ${empleado.nombre}`}</Dato>
            <Dato etiqueta="Área">{empleado.area_nombre}</Dato>
            <Dato etiqueta="Puesto">{empleado.puesto_nombre ?? '—'}</Dato>
            <Dato etiqueta="Ingreso">{fechaCorta(empleado.fecha_ingreso)}</Dato>
          </View>
        </View>
      ) : null}

      {avisos.map((a) => (
        <View key={a.texto} style={[estilos.aviso, { borderColor: a.tono === 'error' ? t.error : t.aviso }]}>
          <Ionicons name={a.tono === 'error' ? 'close-circle' : 'warning'} size={18} color={a.tono === 'error' ? t.error : t.aviso} />
          <Text style={{ color: t.texto, flex: 1, fontSize: 14 }}>{a.texto}</Text>
        </View>
      ))}

      <Text style={{ color: t.textoSuave, fontSize: 13, marginBottom: espacio.m }}>
        Con el rol <Text style={{ fontWeight: '700', color: t.texto }}>{ROLES[rol]}</Text>: {ALCANCE_ROL[rol]}
      </Text>
    </View>
  );
}

export default function SolicitudesAcceso() {
  const t = useTema();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  // { usuario, rol, ubicacion, existente (vincular un legajo que ya cargó RRHH), empleado_id, legajo, empleado, errorArea }
  const [habilitando, setHabilitando] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState('');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setLista((await api('/usuarios', { consulta: { estado_cuenta: 'pendiente', limite: 100 } })).data);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function habilitar() {
    const h = habilitando;
    if (!h.existente && h.rol !== 'ADMIN' && !h.ubicacion.area_id) {
      setHabilitando({ ...h, errorArea: 'Elegí el área donde va a trabajar' });
      throw new Error('falta el área');
    }
    try {
      await api(`/usuarios/${h.usuario.id}/habilitar`, {
        metodo: 'POST',
        cuerpo: {
          rol: h.rol,
          ...(h.rol === 'ADMIN' ? {} : h.existente ? { empleado_id: h.empleado_id ?? undefined } : cuerpoUbicacion(h.ubicacion)),
        },
      });
      toast.exito(`${habilitando.usuario.nombre} ya puede entrar. Le avisamos por email.`);
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  async function rechazar() {
    try {
      await api(`/usuarios/${rechazando.id}/rechazar`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() || undefined } });
      toast.exito('Solicitud rechazada. Le avisamos por email.');
      setMotivo('');
      cargar();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Solicitudes de acceso" icono="person-add"
        sub="Nadie entra hasta que lo habilitás. Elegí su rol y dónde va a trabajar: el legajo se crea solo." />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
      {!lista && !error ? <Tarjeta><EsqueletoLista filas={2} /></Tarjeta> : null}
      {lista?.length === 0 ? <Tarjeta><Vacio icono="checkmark-done-outline" titulo="No hay solicitudes pendientes" /></Tarjeta> : null}
      {lista?.map((u) => (
        <Tarjeta key={u.id}>
          <View style={estilos.fila}>
            <Text style={[estilos.nombre, { color: t.texto }]}>{u.apellido}, {u.nombre}</Text>
            <Insignia texto="Pendiente" tono="aviso" icono="hourglass-outline" />
          </View>
          <Text style={{ color: t.textoSuave }}>{u.email}</Text>
          <Text style={{ color: t.textoSuave, fontSize: 13 }}>
            Pidió acceso el {fechaHoraCorta(u.created_at)}{u.redes ? ` · con ${u.redes}` : ''}
          </Text>
          <View style={[estilos.fila, { marginTop: espacio.m }]}>
            <Boton titulo="Habilitar" icono="checkmark" chico variante="exito" estilo={{ marginBottom: 0 }}
              onPress={() => setHabilitando({ usuario: u, rol: 'EMPLEADO', ubicacion: UBICACION_VACIA, existente: false, empleado_id: null, legajo: null, empleado: null })} />
            <Boton titulo="Rechazar" chico variante="contornoPeligro" estilo={{ marginBottom: 0 }} onPress={() => setRechazando(u)} />
          </View>
        </Tarjeta>
      ))}

      <ConfirmDialog visible={Boolean(habilitando)} titulo="Habilitar cuenta" variante="primario" textoConfirmar="Habilitar"
        deshabilitado={Boolean(habilitando?.existente && habilitando?.empleado?.usuario_id)}
        alConfirmar={habilitar} alCerrar={() => setHabilitando(null)}>
        {habilitando ? (
          <>
            <VistaPrevia usuario={habilitando.usuario} empleado={habilitando.existente && habilitando.rol !== 'ADMIN' ? habilitando.empleado : null}
              rol={habilitando.rol} ubicacion={habilitando.rol === 'ADMIN' ? null : habilitando.ubicacion} />
            <Text style={[estilos.etiqueta, { color: t.texto }]}>Rol</Text>
            <Opciones opciones={OPCIONES_ROL} valor={habilitando.rol} alCambiar={(rol) => setHabilitando((h) => ({ ...h, rol }))} />
            {habilitando.rol === 'ADMIN' ? (
              <Text style={{ color: t.textoSuave, fontSize: 13, marginBottom: espacio.m }}>
                El administrador del sistema no pertenece a un área ni lleva legajo: ve y administra todo.
              </Text>
            ) : (
              <>
                {habilitando.existente ? (
                  <Selector etiqueta="Legajo que cargó RRHH" ruta="/empleados" consulta={{ estado: 'activo' }} valor={habilitando.empleado_id}
                    textoValor={habilitando.legajo} placeholder="Elegí el legajo"
                    alCambiar={(id, e) => setHabilitando((h) => ({
                      ...h, empleado_id: id, empleado: e ?? null, legajo: e ? `${e.legajo} · ${e.apellido}, ${e.nombre}` : null,
                    }))}
                    mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.legajo} · ${e.area_nombre}${e.usuario_id ? ' · ya tiene cuenta' : ''}` })} />
                ) : (
                  <UbicacionLaboral valor={habilitando.ubicacion} error={habilitando.errorArea}
                    alCambiar={(ubicacion) => setHabilitando((h) => ({ ...h, ubicacion, errorArea: null }))} />
                )}
                <Casilla marcada={habilitando.existente} etiqueta="RRHH ya le cargó el legajo (vincular ese en vez de crear uno)"
                  alCambiar={(existente) => setHabilitando((h) => ({ ...h, existente }))} />
              </>
            )}
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={Boolean(rechazando)} titulo="Rechazar solicitud" textoConfirmar="Rechazar"
        mensaje={rechazando ? `${rechazando.nombre} ${rechazando.apellido} no va a poder entrar. Le llega un email con el motivo.` : ''}
        alConfirmar={rechazar} alCerrar={() => { setRechazando(null); setMotivo(''); }}>
        <Campo etiqueta="Motivo (opcional)" value={motivo} onChangeText={setMotivo} maxLength={255} multiline estilo={{ marginBottom: 0 }} />
      </ConfirmDialog>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  nombre: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  etiqueta: { fontSize: 15, marginBottom: 6 },
  ficha: { borderWidth: 1, borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.m },
  subtitulo: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginBottom: espacio.s },
  datos: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.m },
  aviso: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start', borderWidth: 1, borderLeftWidth: 4, borderRadius: radio.m, padding: espacio.s, marginBottom: espacio.m },
});
