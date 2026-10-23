import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, Texto, Boton, Etiqueta } from '../../../componentes/ui';
import { useSesion } from '../../../contexto/sesion';
import { ROLES } from '../../../modulos';
import SelectorTema from '../../../componentes/SelectorTema';
import { espacio, useTema } from '../../../tema';

/** Confirmación que funciona en el celular (Alert) y en el navegador (confirm). */
function confirmar(titulo, mensaje, accion) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${titulo}\n\n${mensaje}`)) accion();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: accion },
  ]);
}

function Fila({ icono, etiqueta, valor }) {
  const t = useTema();
  return (
    <View style={estilos.fila}>
      <Ionicons name={icono} size={20} color={t.textoSuave} style={{ width: 28 }} />
      <Texto suave estilo={{ width: 90 }}>{etiqueta}</Texto>
      <Texto estilo={{ flex: 1 }} numberOfLines={2}>{valor}</Texto>
    </View>
  );
}

export default function Perfil() {
  const { usuario, logout } = useSesion();
  const router = useRouter();
  const t = useTema();
  const [saliendo, setSaliendo] = useState(false);

  async function salir(todas) {
    setSaliendo(true);
    await logout({ todas });
  }

  return (
    <Pantalla>
      <Tarjeta>
        <Texto estilo={estilos.nombre}>{usuario.nombre} {usuario.apellido}</Texto>
        <View style={{ flexDirection: 'row', gap: espacio.s, marginVertical: espacio.s }}>
          <Etiqueta texto={ROLES[usuario.rol]} color={t.acento} />
          {usuario.dosPasosActivo ? <Etiqueta texto="2FA activa" color={t.exito} /> : null}
        </View>
        <Fila icono="mail-outline" etiqueta="Email" valor={usuario.email} />
        <Fila icono="business-outline" etiqueta="Área" valor={usuario.area?.nombre ?? 'Sin asignar'} />
      </Tarjeta>

      <Texto estilo={estilos.seccion}>Seguridad</Texto>
      <Tarjeta onPress={() => router.push('/perfil/dos-pasos')}>
        <View style={estilos.fila}>
          <Ionicons name="shield-checkmark-outline" size={22} color={t.primario} style={{ width: 28 }} />
          <View style={{ flex: 1 }}>
            <Texto estilo={{ fontWeight: '600' }}>Verificación en dos pasos</Texto>
            <Texto suave estilo={{ fontSize: 13 }}>{usuario.dosPasosActivo ? 'Activada' : 'Desactivada: recomendamos activarla'}</Texto>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.textoSuave} />
        </View>
      </Tarjeta>

      <Texto estilo={estilos.seccion}>Apariencia</Texto>
      <SelectorTema />

      <View style={{ marginTop: espacio.xl }}>
        <Boton titulo="Cerrar sesión" variante="secundario" icono="log-out-outline" cargando={saliendo}
          onPress={() => salir(false)} />
        <Boton titulo="Cerrar sesión en todos los dispositivos" variante="peligro" deshabilitado={saliendo}
          onPress={() => confirmar('Cerrar todas las sesiones', 'Vas a tener que volver a ingresar en todos tus dispositivos.', () => salir(true))} />
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  nombre: { fontSize: 20, fontWeight: '700' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: espacio.xs },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espacio.l, marginBottom: espacio.s },
});
