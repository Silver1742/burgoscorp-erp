import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Pantalla, Titulo, Campo, Boton, Aviso, Texto } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { esEmail } from '../../lib/validacion';
import { espacio } from '../../tema';
import Logo from '../../componentes/Logo';
import SelectorTema from '../../componentes/SelectorTema';

export default function Login() {
  const { login } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const refPassword = useRef(null);

  async function enviar() {
    const e = {};
    if (!esEmail(email)) e.email = 'Ingresá un email válido';
    if (!password) e.password = 'Ingresá tu contraseña';
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await login(email.trim(), password);
      // La navegación cambia sola: el layout raíz reacciona al estado de la sesión.
    } catch (err) {
      setErrorGeneral(err.message);
      setErrores(err.porCampo ?? {});
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla bordes={['top', 'bottom']} anchoMax={440}>
      <View style={estilos.selector}>
        <SelectorTema compacto />
      </View>
      <View style={estilos.cabecera}>
        <Logo />
        <Texto suave estilo={{ marginTop: espacio.xs }}>Sistema de gestión · taller industrial</Texto>
      </View>

      <Titulo sub="Ingresá con tu cuenta de la empresa">Iniciar sesión</Titulo>
      <Aviso>{errorGeneral}</Aviso>

      <Campo
        etiqueta="Email"
        value={email}
        onChangeText={setEmail}
        error={errores.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => refPassword.current?.focus()}
        maxLength={254}
      />
      <Campo
        ref={refPassword}
        etiqueta="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errores.password}
        secureTextEntry={!verPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={enviar}
        maxLength={200}
      />
      <Boton
        titulo={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        variante="texto"
        icono={verPassword ? 'eye-off-outline' : 'eye-outline'}
        onPress={() => setVerPassword((v) => !v)}
        estilo={estilos.mostrar}
      />

      <Boton titulo="Ingresar" onPress={enviar} cargando={enviando} icono="log-in-outline" />

      <View style={estilos.enlaces}>
        <Link href="/olvide" asChild><Boton titulo="Olvidé mi contraseña" variante="texto" /></Link>
        <Link href="/registro" asChild><Boton titulo="Crear una cuenta" variante="secundario" /></Link>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  selector: { alignItems: 'flex-end' },
  cabecera: { alignItems: 'center', marginTop: espacio.s, marginBottom: espacio.xl },
  mostrar: { alignSelf: 'flex-end', minHeight: 32, marginTop: -espacio.s, paddingHorizontal: 0 },
  enlaces: { marginTop: espacio.s },
});
