// Activar / desactivar la verificación en dos pasos por email.
// Activar: se pide un código al email y se escribe. Desde ahí, cada ingreso con la contraseña manda
// un código nuevo al email. Desactivar pide la contraseña y otro código.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, CampoContrasena, Boton, Insignia } from '../../../componentes/ui';
import ConfirmDialog from '../../../componentes/ConfirmDialog';
import { useSesion } from '../../../contexto/sesion';
import { useToast } from '../../../contexto/toast';
import { api } from '../../../lib/api';
import { esCodigo6 } from '../../../lib/validacion';
import { espacio, useTema } from '../../../tema';

const ESPERA_REENVIO = 60;

function Paso({ numero, texto }) {
  const t = useTema();
  return (
    <View style={estilos.paso}>
      <View style={[estilos.numero, { backgroundColor: t.primario }]}><Text style={estilos.numeroTexto}>{numero}</Text></View>
      <Text style={{ color: t.texto, flex: 1 }}>{texto}</Text>
    </View>
  );
}

export default function ConfigurarDosPasos() {
  const { usuario, refrescarPerfil } = useSesion();
  const toast = useToast();
  const t = useTema();
  const activa = usuario.dosPasosActivo;
  const [enviadoA, setEnviadoA] = useState(null); // email (enmascarado) al que se mandó el código
  const [espera, setEspera] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [errorPassword, setErrorPassword] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  function limpiar() {
    setEnviadoA(null);
    setCodigo('');
    setPassword('');
    setError(null);
    setErrorPassword(null);
  }

  async function pedirCodigo() {
    setEnviando(true);
    try {
      const r = await api('/auth/2fa/codigo', { metodo: 'POST' });
      setEnviadoA(r.email);
      setEspera(ESPERA_REENVIO);
      setCodigo('');
      setError(null);
      toast.info(`Te mandamos un código a ${r.email}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function mostrarErrores(err) {
    setError(err.porCampo?.codigo ?? null);
    setErrorPassword(err.porCampo?.password ?? null);
    toast.error(err.message);
  }

  async function activar() {
    if (!esCodigo6(codigo)) { setError('El código tiene 6 dígitos'); return; }
    setEnviando(true);
    try {
      await api('/auth/2fa/activar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      limpiar();
      toast.exito('Listo: desde ahora, cada vez que ingreses te vamos a pedir un código que llega a tu email.');
      await refrescarPerfil();
    } catch (err) {
      mostrarErrores(err);
    } finally {
      setEnviando(false);
    }
  }

  function pedirConfirmacion() {
    let ok = true;
    if (!esCodigo6(codigo)) { setError('El código tiene 6 dígitos'); ok = false; }
    if (usuario.tienePassword && !password) { setErrorPassword('Ingresá tu contraseña'); ok = false; }
    if (ok) setConfirmarDesactivar(true);
  }

  async function desactivar() {
    try {
      await api('/auth/2fa/desactivar', {
        metodo: 'POST', cuerpo: { codigo: codigo.trim(), password: usuario.tienePassword ? password : undefined },
      });
      limpiar();
      toast.exito('La verificación en dos pasos quedó desactivada.');
      await refrescarPerfil();
    } catch (err) {
      mostrarErrores(err);
      throw err;
    }
  }

  const botonPedir = (
    <Boton titulo={enviadoA ? (espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código') : 'Mandarme el código'}
      variante={enviadoA ? 'secundario' : 'primario'} icono={enviadoA ? 'refresh' : 'mail-outline'}
      onPress={pedirCodigo} cargando={enviando && !codigo} deshabilitado={espera > 0} estilo={{ alignSelf: 'flex-start' }} />
  );

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Verificación en dos pasos" icono="shield-checkmark"
        acciones={<Insignia texto={activa ? 'Activada' : 'Desactivada'} tono={activa ? 'exito' : 'gris'} />}
        sub={activa
          ? 'Cada vez que ingresás con tu contraseña te mandamos un código a tu email para terminar de entrar.'
          : 'Protegé tu cuenta: aunque alguien sepa tu contraseña, no va a poder entrar sin el código que te llega al email.'} />

      {!activa ? (
        <Tarjeta titulo="Cómo funciona" icono="information-circle-outline">
          <Paso numero="1" texto={`Te mandamos un código a ${usuario.email}.`} />
          <Paso numero="2" texto="Lo escribís acá y queda activada." />
          <Paso numero="3" texto="Desde ahí, cada vez que ingreses con tu contraseña te llega un código nuevo para terminar de entrar." />
        </Tarjeta>
      ) : null}

      <Tarjeta titulo={activa ? 'Desactivar' : 'Activar'} icono={activa ? 'lock-open-outline' : 'mail-outline'}>
        {enviadoA ? (
          <View style={[estilos.enviado, { backgroundColor: t.superficieSec }]}>
            <Ionicons name="mail-open-outline" size={18} color={t.primario} />
            <Text style={{ color: t.texto, flex: 1 }}>Te mandamos el código a <Text style={{ fontWeight: '700' }}>{enviadoA}</Text>. Vence en 10 minutos.</Text>
          </View>
        ) : (
          <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>
            {activa ? 'Para desactivarla te pedimos un código que te mandamos al email y tu contraseña.' : 'Tocá el botón y revisá tu email.'}
          </Text>
        )}
        {botonPedir}

        {enviadoA ? (
          <View style={{ marginTop: espacio.l }}>
            <Campo etiqueta="Código del email" value={codigo} onChangeText={setCodigo} error={error} keyboardType="number-pad" maxLength={6}
              autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={activa ? pedirConfirmacion : activar} autoFocus />
            {activa && usuario.tienePassword ? (
              <CampoContrasena etiqueta="Tu contraseña" value={password} onChangeText={setPassword} error={errorPassword} maxLength={200} />
            ) : null}
            <View style={estilos.botones}>
              <Boton titulo="Cancelar" variante="secundario" chico onPress={limpiar} />
              {activa ? (
                <Boton titulo="Desactivar" variante="contornoPeligro" icono="close-circle-outline" chico onPress={pedirConfirmacion} />
              ) : (
                <Boton titulo="Activar" icono="shield-checkmark-outline" chico onPress={activar} cargando={enviando && Boolean(codigo)} textoCargando="Activando…" />
              )}
            </View>
          </View>
        ) : null}
      </Tarjeta>

      <ConfirmDialog
        visible={confirmarDesactivar}
        titulo="Desactivar verificación en dos pasos"
        mensaje="Tu cuenta va a quedar protegida solo con la contraseña. ¿Querés desactivarla?"
        textoConfirmar="Desactivar"
        alConfirmar={desactivar}
        alCerrar={() => setConfirmarDesactivar(false)}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  paso: { flexDirection: 'row', gap: espacio.m, alignItems: 'center', marginBottom: espacio.m },
  numero: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numeroTexto: { color: '#ffffff', fontWeight: '700' },
  enviado: { flexDirection: 'row', gap: espacio.s, alignItems: 'center', padding: espacio.m, borderRadius: 6, marginBottom: espacio.m },
  botones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espacio.s },
});
