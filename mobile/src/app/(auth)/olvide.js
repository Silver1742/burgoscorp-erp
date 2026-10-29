import { useState } from 'react';
import { useRouter } from 'expo-router';
import AuthLayout from '../../componentes/AuthLayout';
import VolverAlLogin from '../../componentes/VolverAlLogin';
import { Campo, Boton } from '../../componentes/ui';
import { useToast } from '../../contexto/toast';
import { api } from '../../lib/api';
import { esEmail } from '../../lib/validacion';

export default function Olvide() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!esEmail(email)) {
      setError('Ingresá un email válido');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await api('/auth/password/olvide', { metodo: 'POST', cuerpo: { email: email.trim() }, conToken: false });
      toast.info(r.mensaje);
      router.push({ pathname: '/restablecer', params: { email: email.trim() } });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo="Recuperar contraseña" sub="Te mandamos un código de 6 dígitos para que definas una contraseña nueva.">
      <Campo etiqueta="Email de tu cuenta" value={email} onChangeText={setEmail} error={error}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} onSubmitEditing={enviar} />
      <Boton titulo="Enviar código" onPress={enviar} cargando={enviando} textoCargando="Enviando…" icono="mail-outline" />
      {/* Si el administrador ya le mandó un código por email (cuenta nueva), va directo a usarlo */}
      <Boton titulo="Ya tengo un código" variante="secundario" icono="keypad-outline"
        onPress={() => router.push({ pathname: '/restablecer', params: email.trim() ? { email: email.trim() } : {} })} />
      <VolverAlLogin />
    </AuthLayout>
  );
}
