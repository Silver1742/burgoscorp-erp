// Segundo paso del login: código de la app autenticadora, por email o de respaldo.
import { useState } from 'react';
import AuthLayout from '../componentes/AuthLayout';
import VolverAlLogin from '../componentes/VolverAlLogin';
import { Campo, Boton, Opciones } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';

const METODOS = {
  totp: {
    titulo: 'Código de la app autenticadora',
    ayuda: 'Abrí Google Authenticator (o la app que uses) y escribí el código de 6 dígitos de BurgosCorp ERP.',
    teclado: 'number-pad', largo: 6,
  },
  email: {
    titulo: 'Código enviado por email',
    ayuda: 'Revisá tu correo. El código vence en 10 minutos.',
    teclado: 'number-pad', largo: 6,
  },
  respaldo: {
    titulo: 'Código de respaldo',
    ayuda: 'Uno de los 10 códigos que guardaste al activar la verificación (formato XXXX-XXXX). Cada uno sirve una sola vez.',
    teclado: 'default', largo: 9,
  },
};

const OPCIONES = [
  { valor: 'totp', titulo: 'App', icono: 'phone-portrait-outline' },
  { valor: 'email', titulo: 'Email', icono: 'mail-outline' },
  { valor: 'respaldo', titulo: 'Respaldo', icono: 'key-outline' },
];

export default function DosPasos() {
  const { completar2fa, enviarCodigo2faPorEmail, cancelar2fa } = useSesion();
  const toast = useToast();
  const [metodo, setMetodo] = useState('totp');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const m = METODOS[metodo];

  async function verificar() {
    const limpio = codigo.trim();
    if (limpio.length < 6) {
      setError('Ingresá el código completo');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await completar2fa(metodo, limpio);
    } catch (err) {
      if (err.status === 401) {
        toast.aviso('El tiempo para verificar venció. Volvé a iniciar sesión.');
        cancelar2fa();
      } else {
        setError(err.porCampo?.codigo ?? null);
        toast.error(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cambiar(nuevo) {
    setMetodo(nuevo);
    setCodigo('');
    setError(null);
    if (nuevo !== 'email') return;
    try {
      await enviarCodigo2faPorEmail();
      toast.info('Te enviamos un código a tu email.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AuthLayout titulo="Verificación en dos pasos" sub="Tu cuenta tiene la verificación en dos pasos activada.">
      <Opciones opciones={OPCIONES} valor={metodo} alCambiar={cambiar} />
      <Campo
        etiqueta={m.titulo} ayuda={m.ayuda} error={error}
        value={codigo} onChangeText={setCodigo} keyboardType={m.teclado} autoCapitalize="characters" maxLength={m.largo}
        autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verificar} autoFocus
      />
      <Boton titulo="Verificar" onPress={verificar} cargando={enviando} textoCargando="Verificando…" icono="shield-checkmark-outline" />
      <VolverAlLogin alPresionar={cancelar2fa} />
    </AuthLayout>
  );
}
