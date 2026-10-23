import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthLayout from '../../componentes/AuthLayout';
import VolverAlLogin from '../../componentes/VolverAlLogin';
import { Campo, CampoContrasena, ChecklistContrasena, Boton } from '../../componentes/ui';
import { useToast } from '../../contexto/toast';
import { api } from '../../lib/api';
import { esEmail, esCodigo6, errorPassword } from '../../lib/validacion';

export default function Restablecer() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const e = {};
    if (!esEmail(email)) e.email = 'Ingresá un email válido';
    if (!esCodigo6(codigo)) e.codigo = 'El código tiene 6 dígitos';
    const ep = errorPassword(nueva);
    if (ep) e.nueva = ep;
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const r = await api('/auth/password/restablecer', {
        metodo: 'POST', cuerpo: { email: email.trim(), codigo: codigo.trim(), nueva }, conToken: false,
      });
      toast.exito(r.mensaje);
      router.dismissTo('/login');
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo="Nueva contraseña" sub="Si el email está registrado, te llegó un código. Vence en 10 minutos.">
      <Campo etiqueta="Email" value={email} onChangeText={setEmail} error={errores.email}
        keyboardType="email-address" autoCapitalize="none" maxLength={254} />
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} error={errores.codigo}
        keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
      <CampoContrasena etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} error={errores.nueva}
        autoComplete="new-password" maxLength={72} />
      <ChecklistContrasena valor={nueva} />
      <Boton titulo="Guardar contraseña" onPress={enviar} cargando={enviando} textoCargando="Guardando…" icono="key-outline" />
      <VolverAlLogin />
    </AuthLayout>
  );
}
