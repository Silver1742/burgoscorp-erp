// Confirmación del email con el código de 6 dígitos que se envía al registrarse.
import { useState } from 'react';
import { Pantalla, Titulo, Campo, Boton, Aviso } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { api } from '../lib/api';
import { esCodigo6 } from '../lib/validacion';

export default function VerificarEmail() {
  const { usuario, refrescarPerfil, logout } = useSesion();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function verificar() {
    if (!esCodigo6(codigo)) {
      setError('El código tiene 6 dígitos');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await api('/auth/email/verificar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      await refrescarPerfil(); // el layout raíz pasa solo a la app
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setError(null);
    setInfo(null);
    try {
      const r = await api('/auth/email/enviar', { metodo: 'POST' });
      setInfo(r.mensaje);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Pantalla anchoMax={440}>
      <Titulo sub={`Te enviamos un código de 6 dígitos a ${usuario?.email}. Vence en 10 minutos.`}>Confirmá tu email</Titulo>
      <Aviso tipo="info">{info}</Aviso>
      <Aviso>{error}</Aviso>
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} keyboardType="number-pad" maxLength={6}
        autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verificar} autoFocus />
      <Boton titulo="Confirmar" onPress={verificar} cargando={enviando} icono="checkmark-outline" />
      <Boton titulo="Reenviar código" variante="secundario" onPress={reenviar} />
      <Boton titulo="Cerrar sesión" variante="texto" onPress={() => logout()} />
    </Pantalla>
  );
}
