import { useState } from 'react';
import { View } from 'react-native';
import AuthLayout from '../../componentes/AuthLayout';
import VolverAlLogin from '../../componentes/VolverAlLogin';
import { Campo, CampoContrasena, ChecklistContrasena, Boton } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { useToast } from '../../contexto/toast';
import { esEmail, errorPassword, esNombre } from '../../lib/validacion';
import { espacio, usePantalla } from '../../tema';

export default function Registro() {
  const { registrar } = useSesion();
  const toast = useToast();
  const { ancho } = usePantalla();
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', password: '', repetir: '' });
  const [errores, setErrores] = useState({});
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
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await registrar({
        nombre: datos.nombre.trim(), apellido: datos.apellido.trim(),
        email: datos.email.trim(), password: datos.password,
      });
      toast.info('Cuenta creada. Te enviamos un código para confirmar tu email.');
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const dosColumnas = ancho >= 420;
  return (
    <AuthLayout titulo="Crear cuenta" sub="Después vas a confirmar tu email. Un administrador te asigna el área y el rol.">
      <View style={{ flexDirection: dosColumnas ? 'row' : 'column', gap: dosColumnas ? espacio.m : 0 }}>
        <Campo etiqueta="Nombre" value={datos.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} autoComplete="given-name" maxLength={60} estilo={{ flex: 1 }} />
        <Campo etiqueta="Apellido" value={datos.apellido} onChangeText={cambiar('apellido')} error={errores.apellido} autoComplete="family-name" maxLength={60} estilo={{ flex: 1 }} />
      </View>
      <Campo etiqueta="Email" value={datos.email} onChangeText={cambiar('email')} error={errores.email}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} />
      <CampoContrasena etiqueta="Contraseña" value={datos.password} onChangeText={cambiar('password')} error={errores.password}
        autoComplete="new-password" textContentType="newPassword" maxLength={72} />
      <ChecklistContrasena valor={datos.password} />
      <CampoContrasena etiqueta="Repetir contraseña" value={datos.repetir} onChangeText={cambiar('repetir')} error={errores.repetir}
        autoComplete="new-password" maxLength={72} onSubmitEditing={enviar} />
      <Boton titulo="Crear cuenta" onPress={enviar} cargando={enviando} textoCargando="Creando cuenta…" icono="person-add-outline" />
      <VolverAlLogin />
    </AuthLayout>
  );
}
