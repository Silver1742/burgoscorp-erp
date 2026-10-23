// Segundo paso del login: código de la app autenticadora, por email o de respaldo.
import { useState } from 'react';
import { View } from 'react-native';
import { Pantalla, Titulo, Campo, Boton, Aviso, Separador } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { espacio } from '../tema';

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

export default function DosPasos() {
  const { completar2fa, enviarCodigo2faPorEmail, cancelar2fa } = useSesion();
  const [metodo, setMetodo] = useState('totp');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
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
      setError(err.status === 401 ? 'El tiempo para verificar venció. Volvé a iniciar sesión.' : err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function pedirEmail() {
    setError(null);
    setEnviando(true);
    try {
      await enviarCodigo2faPorEmail();
      setMetodo('email');
      setCodigo('');
      setInfo('Te enviamos un código a tu email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function cambiar(nuevo) {
    setMetodo(nuevo);
    setCodigo('');
    setError(null);
    setInfo(null);
  }

  return (
    <Pantalla anchoMax={440}>
      <Titulo sub="Tu cuenta tiene la verificación en dos pasos activada.">Un paso más</Titulo>
      <Aviso tipo="info">{info}</Aviso>
      <Aviso>{error}</Aviso>

      <Campo
        etiqueta={m.titulo}
        ayuda={m.ayuda}
        value={codigo}
        onChangeText={setCodigo}
        keyboardType={m.teclado}
        autoCapitalize="characters"
        maxLength={m.largo}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={verificar}
        autoFocus
      />
      <Boton titulo="Verificar" onPress={verificar} cargando={enviando} icono="shield-checkmark-outline" />

      <Separador texto="¿No tenés el código?" />
      <View style={{ gap: espacio.xs }}>
        {metodo !== 'totp' && <Boton titulo="Usar la app autenticadora" variante="secundario" onPress={() => cambiar('totp')} />}
        {metodo !== 'email' && <Boton titulo="Recibir un código por email" variante="secundario" onPress={pedirEmail} deshabilitado={enviando} />}
        {metodo !== 'respaldo' && <Boton titulo="Usar un código de respaldo" variante="secundario" onPress={() => cambiar('respaldo')} />}
        <Boton titulo="Cancelar" variante="texto" onPress={cancelar2fa} />
      </View>
    </Pantalla>
  );
}
