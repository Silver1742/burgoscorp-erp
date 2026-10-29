// Solicitudes de acceso (como en el portal R3): quien se registra queda pendiente hasta que el
// administrador lo habilita con un rol (y el legajo del empleado) o lo rechaza con un motivo.
// En los dos casos a la persona le llega un email.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pantalla, EncabezadoPagina, Tarjeta, Insignia, Boton, Campo, Opciones, EsqueletoLista, ErrorCarga, Vacio } from '../../../../componentes/ui';
import ConfirmDialog from '../../../../componentes/ConfirmDialog';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { ROLES, fechaHoraCorta } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const OPCIONES_ROL = ['EMPLEADO', 'JEFE', 'GERENCIA', 'ADMIN'].map((valor) => ({ valor, titulo: ROLES[valor] }));

export default function SolicitudesAcceso() {
  const t = useTema();
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [habilitando, setHabilitando] = useState(null); // { usuario, rol, empleado_id, legajo }
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
    try {
      await api(`/usuarios/${habilitando.usuario.id}/habilitar`, {
        metodo: 'POST', cuerpo: { rol: habilitando.rol, empleado_id: habilitando.empleado_id ?? undefined },
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
        sub="Nadie entra hasta que lo habilitás. Elegí su rol y, si es empleado, vinculalo a su legajo." />
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
              onPress={() => setHabilitando({ usuario: u, rol: 'EMPLEADO', empleado_id: null, legajo: null })} />
            <Boton titulo="Rechazar" chico variante="contornoPeligro" estilo={{ marginBottom: 0 }} onPress={() => setRechazando(u)} />
          </View>
        </Tarjeta>
      ))}

      <ConfirmDialog visible={Boolean(habilitando)} titulo="Habilitar cuenta" variante="primario" textoConfirmar="Habilitar"
        mensaje={habilitando ? `${habilitando.usuario.nombre} ${habilitando.usuario.apellido} (${habilitando.usuario.email})` : ''}
        alConfirmar={habilitar} alCerrar={() => setHabilitando(null)}>
        {habilitando ? (
          <>
            <Text style={[estilos.etiqueta, { color: t.texto }]}>Rol</Text>
            <Opciones opciones={OPCIONES_ROL} valor={habilitando.rol} alCambiar={(rol) => setHabilitando((h) => ({ ...h, rol }))} />
            <Selector etiqueta="Legajo del empleado" ruta="/empleados" consulta={{ estado: 'activo' }} valor={habilitando.empleado_id}
              textoValor={habilitando.legajo} opcional placeholder="Sin legajo (no ve módulos)"
              ayuda="Sin legajo la persona entra pero no ve ningún módulo."
              alCambiar={(id, e) => setHabilitando((h) => ({ ...h, empleado_id: id, legajo: e ? `${e.legajo} · ${e.apellido}, ${e.nombre}` : null }))}
              mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.legajo} · ${e.area_nombre}${e.usuario_id ? ' · ya tiene cuenta' : ''}` })}
              estilo={{ marginBottom: 0 }} />
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
});
