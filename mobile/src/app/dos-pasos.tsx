// Segundo paso del login: el código de 6 dígitos que se mandó al email al poner la contraseña.
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import AuthLayout from '../componentes/AuthLayout';
import VolverAlLogin from '../componentes/VolverAlLogin';
import { Campo, Boton } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { esCodigo6 } from '../lib/validacion';
import { espacio, useTema } from '../tema';

const ESPERA_REENVIO = 60;

export default function DosPasos() {
  const { pendiente2fa, completar2fa, enviarCodigo2faPorEmail, cancelar2fa } = useSesion();
  const toast = useToast();
  const t = useTema();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  // Segundos hasta poder pedir otro código (la API acepta uno por minuto).
  const [espera, setEspera] = useState(pendiente2fa?.codigoEnviado === false ? 0 : ESPERA_REENVIO);

  useEffect(() => {
    if (pendiente2fa?.codigoEnviado === false) toast.error('No pudimos mandarte el código. Tocá "Reenviar código".');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (espera <= 0) return undefined;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  async function verificar() {
    const limpio = codigo.trim();
    if (!esCodigo6(limpio)) {
      setError('El código tiene 6 dígitos');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await completar2fa(limpio);
    } catch (err) {
      if (err.status === 401) {
        toast.aviso('El tiempo para verificar venció. Volvé a iniciar sesión.');
        cancelar2fa();
      } else {
        setError(err.porCampo?.codigo ?? 'Código incorrecto');
        toast.error(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setReenviando(true);
    try {
      await enviarCodigo2faPorEmail();
      toast.info('Te mandamos un código nuevo. El anterior ya no sirve.');
      setEspera(ESPERA_REENVIO);
      setCodigo('');
      setError(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReenviando(false);
    }
  }

  const destino = pendiente2fa?.email ? <Text style={{ fontWeight: '700' }}>{pendiente2fa.email}</Text> : 'tu email';
  return (
    <AuthLayout titulo="Revisá tu email" sub="Tu cuenta tiene la verificación en dos pasos activada.">
      <Text style={{ color: t.texto, fontSize: 15, marginBottom: espacio.l }}>
        Te mandamos un código de 6 dígitos a {destino}. Escribilo para terminar de entrar.
      </Text>
      <Campo
        etiqueta="Código" ayuda="Vence en 10 minutos. Si no lo ves, revisá Spam." error={error}
        value={codigo} onChangeText={setCodigo} keyboardType="number-pad" maxLength={6}
        autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verificar} autoFocus
      />
      <Boton titulo="Entrar" onPress={verificar} cargando={enviando} textoCargando="Verificando…" icono="shield-checkmark-outline" />
      <Boton titulo={espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'} variante="secundario" icono="refresh"
        onPress={reenviar} cargando={reenviando} deshabilitado={espera > 0} />
      <VolverAlLogin alPresionar={cancelar2fa} />
    </AuthLayout>
  );
}
