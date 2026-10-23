import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pantalla, Titulo, Campo, Boton, Aviso } from '../../componentes/ui';
import { api } from '../../lib/api';
import { esEmail } from '../../lib/validacion';

export default function Olvide() {
  const router = useRouter();
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
      await api('/auth/password/olvide', { metodo: 'POST', cuerpo: { email: email.trim() }, conToken: false });
      router.push({ pathname: '/restablecer', params: { email: email.trim() } });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla anchoMax={440}>
      <Titulo sub="Te mandamos un código de 6 dígitos para que definas una contraseña nueva.">Recuperar contraseña</Titulo>
      <Aviso>{error}</Aviso>
      <Campo etiqueta="Email de tu cuenta" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} onSubmitEditing={enviar} />
      <Boton titulo="Enviar código" onPress={enviar} cargando={enviando} icono="mail-outline" />
    </Pantalla>
  );
}
