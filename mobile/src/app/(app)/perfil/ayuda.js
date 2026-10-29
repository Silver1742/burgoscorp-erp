// Ayuda: la guía rápida de uso. Primero los temas del rol de quien la abre; el resto, plegado.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, Boton } from '../../../componentes/ui';
import { useSesion } from '../../../contexto/sesion';
import { TEMAS_AYUDA } from '../../../ayuda';
import { ROLES } from '../../../modulos';
import { espacio, useTema } from '../../../tema';

function Tema({ tema, abierto, alTocar }) {
  const t = useTema();
  return (
    <Tarjeta sinRelleno>
      <Pressable onPress={alTocar} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
        style={({ pressed }) => [estilos.cabecera, pressed && { backgroundColor: t.superficieSec }]}>
        <Ionicons name={tema.icono} size={22} color={t.primario} />
        <Text style={[estilos.titulo, { color: t.texto }]}>{tema.titulo}</Text>
        <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={t.textoTenue} />
      </Pressable>
      {abierto ? (
        <View style={estilos.pasos}>
          {tema.pasos.map((p, i) => (
            <View key={p} style={estilos.paso}>
              <View style={[estilos.numero, { backgroundColor: t.primario }]}><Text style={estilos.numeroTexto}>{i + 1}</Text></View>
              <Text style={{ color: t.texto, flex: 1, fontSize: 15, lineHeight: 22 }}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}

export default function Ayuda() {
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(null);
  const [verTodo, setVerTodo] = useState(false);
  const mios = TEMAS_AYUDA.filter((x) => !x.roles.length || x.roles.includes(usuario.rol));
  const otros = TEMAS_AYUDA.filter((x) => !mios.includes(x));
  const alternar = (id) => setAbierto((a) => (a === id ? null : id));

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Ayuda" icono="help-circle" sub={`Guía rápida para ${ROLES[usuario.rol]}. Tocá un tema para ver los pasos.`} />
      {mios.map((x) => <Tema key={x.id} tema={x} abierto={abierto === x.id} alTocar={() => alternar(x.id)} />)}
      {otros.length ? (
        verTodo
          ? otros.map((x) => <Tema key={x.id} tema={x} abierto={abierto === x.id} alTocar={() => alternar(x.id)} />)
          : <Boton titulo="Ver los temas de otros roles" variante="secundario" icono="chevron-down" onPress={() => setVerTodo(true)} />
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: espacio.l, minHeight: 56 },
  titulo: { flex: 1, fontSize: 16, fontWeight: '600' },
  pasos: { paddingHorizontal: espacio.l, paddingBottom: espacio.l, gap: espacio.m },
  paso: { flexDirection: 'row', gap: espacio.m, alignItems: 'flex-start' },
  numero: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numeroTexto: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
