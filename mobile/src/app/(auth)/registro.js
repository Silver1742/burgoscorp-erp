import { useState } from 'react';
import { Pantalla, Titulo, Campo, Boton, Aviso } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { esEmail, errorPassword, esNombre } from '../../lib/validacion';

export default function Registro() {
  const { registrar } = useSesion();
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '', repetir: '' });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  async function enviar() {
    const e = {};
    if (!esNombre(datos.nombre)) e.nombre = 'Ingresá tu nombre (solo letras)';
    if (!esNombre(datos.apellido)) e.apellido = 'Ingresá tu apellido (solo letras)';
    if (!esEmail(datos.email)) e.email = 'Ingresá un email válido';
    const ep = errorPassword(datos.password);
    if (ep) e.password = ep;
    if (datos.repetir !== datos.password) e.repetir = 'Las contraseñas no coinciden';
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await registrar({
        nombre: datos.nombre.trim(), apellido: datos.apellido.trim(),
        email: datos.email.trim(), password: datos.password,
      });
    } catch (err) {
      setErrorGeneral(err.message);
      setErrores(err.porCampo ?? {});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla anchoMax={440}>
      <Titulo sub="Después de registrarte te vamos a mandar un código para confirmar tu email. Un administrador te asigna el área y el rol.">
        Crear cuenta
      </Titulo>
      <Aviso>{errorGeneral}</Aviso>
      <Campo etiqueta="Nombre" value={datos.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} autoComplete="given-name" maxLength={60} />
      <Campo etiqueta="Apellido" value={datos.apellido} onChangeText={cambiar('apellido')} error={errores.apellido} autoComplete="family-name" maxLength={60} />
      <Campo etiqueta="Email" value={datos.email} onChangeText={cambiar('email')} error={errores.email}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} />
      <Campo etiqueta="Contraseña" value={datos.password} onChangeText={cambiar('password')} error={errores.password}
        secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={72}
        ayuda="Mínimo 10 caracteres, con letras y números" />
      <Campo etiqueta="Repetir contraseña" value={datos.repetir} onChangeText={cambiar('repetir')} error={errores.repetir}
        secureTextEntry autoComplete="new-password" maxLength={72} onSubmitEditing={enviar} />
      <Boton titulo="Crear cuenta" onPress={enviar} cargando={enviando} icono="person-add-outline" />
    </Pantalla>
  );
}
