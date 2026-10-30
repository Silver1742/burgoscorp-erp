// "Ingresar con Google / GitHub / Discord". Le pregunta a la API qué proveedores están
// configurados: un botón aparece solo si su red tiene los datos cargados en el servidor.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSesion } from '../contexto/sesion';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { iniciarIngreso } from '../lib/social';
import { espacio, radio, useTema } from '../tema';

const REDES = [
  { id: 'google', nombre: 'Google', icono: 'logo-google', color: '#ea4335' },
  { id: 'github', nombre: 'GitHub', icono: 'logo-github', color: '#24292f' },
  { id: 'discord', nombre: 'Discord', icono: 'logo-discord', color: '#5865f2' },
];

export default function BotonesSociales({ texto = 'Ingresar con' }) {
  const t = useTema();
  const toast = useToast();
  const { loginSocial } = useSesion();
  const [proveedores, setProveedores] = useState(null);
  const [enCurso, setEnCurso] = useState(null);

  useEffect(() => {
    api('/auth/social/proveedores', { conToken: false }).then(setProveedores).catch(() => setProveedores(null));
  }, []);

  const disponibles = REDES.filter((r) => proveedores?.[r.id] && proveedores.redirectUri);
  if (!disponibles.length) return null;

  async function ingresar(red) {
    setEnCurso(red.id);
    try {
      const r = await iniciarIngreso(red.id, proveedores);
      if (r) await loginSocial(r.proveedor, r.datos); // en la web la página se va y vuelve por /oauth
    } catch (err) {
      if (err.status === 423 || ['CUENTA_PENDIENTE', 'CUENTA_RECHAZADA'].includes(err.codigo)) toast.aviso(err.message, { duracion: 7000 });
      else toast.error(err.message);
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <View style={{ marginTop: espacio.l }}>
      <View style={estilos.separador}>
        <View style={[estilos.linea, { backgroundColor: t.borde }]} />
        <Text style={{ color: t.textoSuave, fontSize: 13 }}>o</Text>
        <View style={[estilos.linea, { backgroundColor: t.borde }]} />
      </View>
      {disponibles.map((red) => (
        <Pressable key={red.id} onPress={() => !enCurso && ingresar(red)} accessibilityRole="button"
          accessibilityLabel={`${texto} ${red.nombre}`}
          style={({ pressed }) => [estilos.boton, { borderColor: t.borde, backgroundColor: pressed ? t.superficieSec : t.superficie, opacity: enCurso && enCurso !== red.id ? 0.5 : 1 }]}>
          {enCurso === red.id
            ? <ActivityIndicator color={red.color} />
            : <Ionicons name={red.icono} size={20} color={t.modo === 'oscuro' && red.id === 'github' ? '#ffffff' : red.color} />}
          <Text style={{ color: t.texto, fontSize: 15, fontWeight: '500' }}>{texto} {red.nombre}</Text>
        </Pressable>
      ))}
      <Text style={{ color: t.textoSuave, fontSize: 12, textAlign: 'center', marginTop: espacio.xs }}>
        Si es la primera vez, tu cuenta queda pendiente hasta que la habilite un administrador.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  separador: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginBottom: espacio.m },
  linea: { flex: 1, height: 1 },
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s, minHeight: 44, borderWidth: 1, borderRadius: radio.m, marginBottom: espacio.s },
});
