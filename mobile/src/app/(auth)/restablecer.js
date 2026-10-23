import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pantalla, Titulo, Campo, Boton, Aviso } from '../../componentes/ui';
import { api } from '../../lib/api';
import { esEmail, esCodigo6, errorPassword } from '../../lib/validacion';

export default function Restablecer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const e = {};
    if (!esEmail(email)) e.email = 'Ingresá un email válido';
    if (!esCodigo6(codigo)) e.codigo = 'El código tiene 6 dígitos';
    const ep = errorPassword(nueva);
    if (ep) e.nueva = ep;
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      const r = await api('/auth/password/restablecer', {
        metodo: 'POST', cuerpo: { email: email.trim(), codigo: codigo.trim(), nueva }, conToken: false,
      });
      setMensaje(r.mensaje);
      setTimeout(() => router.dismissTo('/login'), 1500);
    } catch (err) {
      setErrorGeneral(err.message);
      setErrores(err.porCampo ?? {});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla anchoMax={440}>
      <Titulo sub="Si el email está registrado, te llegó un código. Vence en 10 minutos.">Nueva contraseña</Titulo>
      <Aviso tipo="exito">{mensaje}</Aviso>
      <Aviso>{errorGeneral}</Aviso>
      <Campo etiqueta="Email" value={email} onChangeText={setEmail} error={errores.email}
        keyboardType="email-address" autoCapitalize="none" maxLength={254} />
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} error={errores.codigo}
        keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
      <Campo etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} error={errores.nueva}
        secureTextEntry autoComplete="new-password" maxLength={72} ayuda="Mínimo 10 caracteres, con letras y números" />
      <Boton titulo="Guardar contraseña" onPress={enviar} cargando={enviando} deshabilitado={Boolean(mensaje)} icono="key-outline" />
    </Pantalla>
  );
}
