// Login (como LoginPage de R3): validación por campo, "Recordar mi email", botón que pasa a
// "Verificando credenciales…" y, si son válidas, el escudo se sella y aparece "Acceso verificado".
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AuthLayout from '../../componentes/AuthLayout';
import { Campo, CampoContrasena, Boton, Casilla } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { useToast } from '../../contexto/toast';
import { leerPreferencia, guardarPreferencia } from '../../lib/preferencias';
import { esEmail } from '../../lib/validacion';
import { espacio, useTema } from '../../tema';

const DURACION_SELLO_MS = 750;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const { login } = useSesion();
  const toast = useToast();
  const t = useTema();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [sellado, setSellado] = useState(false);
  const refPassword = useRef(null);

  // Solo el email (dato no sensible) y solo si el usuario lo pidió. Nunca la contraseña.
  useEffect(() => {
    leerPreferencia('email-recordado').then((v) => {
      if (v) { setEmail(v); setRecordar(true); }
    });
  }, []);

  async function enviar() {
    const e = {};
    if (!esEmail(email)) e.email = 'Ingresá un email válido';
    if (!password) e.password = 'Ingresá tu contraseña';
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true);
    try {
      await login(email.trim(), password, {
        antesDeEntrar: async () => {
          await guardarPreferencia('email-recordado', recordar ? email.trim() : '');
          setSellado(true);
          await esperar(DURACION_SELLO_MS);
        },
      });
    } catch (err) {
      setSellado(false);
      setPassword('');
      setErrores(err.porCampo ?? {});
      // Bloqueo por intentos o cuenta todavía no habilitada por el administrador: aviso, no error.
      if (err.status === 423 || ['CUENTA_PENDIENTE', 'CUENTA_RECHAZADA'].includes(err.codigo)) toast.aviso(err.message, { duracion: 7000 });
      else toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo="Iniciar sesión" sub="Ingresá con tu cuenta corporativa de BurgosCorp." sellado={sellado}>
      <Campo
        etiqueta="Email" value={email} onChangeText={setEmail} error={errores.email}
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username"
        returnKeyType="next" onSubmitEditing={() => refPassword.current?.focus()} maxLength={254}
      />
      <CampoContrasena
        ref={refPassword} etiqueta="Contraseña" value={password} onChangeText={setPassword} error={errores.password}
        autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={enviar} maxLength={200}
      />
      <View style={estilos.filaOpciones}>
        <Casilla marcada={recordar} alCambiar={setRecordar} etiqueta="Recordar mi email" />
        <Link href="/olvide" asChild><Boton titulo="¿Olvidaste tu contraseña?" variante="texto" chico estilo={estilos.enlace} /></Link>
      </View>

      {sellado ? (
        <View style={[estilos.verificado, { backgroundColor: t.exito }]} accessibilityRole="text" accessibilityLiveRegion="polite">
          <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
          <Text style={estilos.verificadoTexto}>Acceso verificado</Text>
        </View>
      ) : (
        <Boton titulo="Ingresar" onPress={enviar} cargando={enviando} textoCargando="Verificando credenciales…" />
      )}

      <View style={estilos.pie}>
        <Text style={{ color: t.textoSuave, fontSize: 14 }}>¿Sos nuevo en BurgosCorp? </Text>
        <Link href="/registro" asChild><Boton titulo="Pedí acceso" variante="texto" chico estilo={estilos.enlacePie} /></Link>
      </View>
    </AuthLayout>
  );
}

const estilos = StyleSheet.create({
  filaOpciones: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: espacio.s },
  enlace: { borderWidth: 0, minHeight: 0, paddingVertical: 0, marginBottom: espacio.l },
  // En la fila del pie, sin margen abajo: si no, queda más alto que el texto de al lado.
  enlacePie: { borderWidth: 0, minHeight: 0, paddingVertical: 0, marginBottom: 0 },
  verificado: { minHeight: 44, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: espacio.m },
  verificadoTexto: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  pie: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: espacio.xl },
});
