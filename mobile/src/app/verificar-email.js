// Confirmación del email con un código de 6 dígitos. Se pide solo al abrir la pantalla (la primera vez
// que entra alguien cuya cuenta acaba de habilitar el administrador).
import { useEffect, useRef, useState } from 'react';
import AuthLayout from '../componentes/AuthLayout';
import VolverAlLogin from '../componentes/VolverAlLogin';
import { Campo, Boton } from '../componentes/ui';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { esCodigo6 } from '../lib/validacion';

export default function VerificarEmail() {
  const { usuario, refrescarPerfil, logout } = useSesion();
  const toast = useToast();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    // Si ya se mandó uno hace menos de un minuto la API responde 429: se usa ese.
    api('/auth/email/enviar', { metodo: 'POST' }).catch(() => {});
  }, []);

  async function verificar() {
    if (!esCodigo6(codigo)) {
      setError('El código tiene 6 dígitos');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await api('/auth/email/verificar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      toast.exito('Email confirmado. ¡Bienvenido a BurgosCorp!');
      await refrescarPerfil(); // el layout raíz pasa solo a la app
    } catch (err) {
      setError(err.porCampo?.codigo ?? null);
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    try {
      const r = await api('/auth/email/enviar', { metodo: 'POST' });
      toast.info(r.mensaje);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <AuthLayout titulo="Confirmá tu email" sub={`Te enviamos un código de 6 dígitos a ${usuario?.email}. Vence en 10 minutos.`}>
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} error={error} keyboardType="number-pad" maxLength={6}
        autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={verificar} autoFocus />
      <Boton titulo="Confirmar" onPress={verificar} cargando={enviando} textoCargando="Confirmando…" icono="checkmark-outline" />
      <Boton titulo="Reenviar código" variante="secundario" icono="refresh" onPress={reenviar} />
      <VolverAlLogin alPresionar={() => logout()} />
    </AuthLayout>
  );
}
