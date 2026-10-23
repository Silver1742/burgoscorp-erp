// Pantalla de un módulo: acciones propias (ej. "Pedir licencia") y listados de sus recursos.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, Texto, Vacio } from '../../../../componentes/ui';
import { useSesion, usePuede } from '../../../../contexto/sesion';
import { buscarModulo } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const ALCANCE = { todo: 'Toda la empresa', area: 'Tu área', propio: 'Solo lo tuyo' };

function Fila({ icono, titulo, sub, onPress }) {
  const t = useTema();
  return (
    <Tarjeta onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icono ? <Ionicons name={icono} size={22} color={t.acento} style={{ marginRight: espacio.m }} /> : null}
        <View style={{ flex: 1 }}>
          <Texto estilo={{ fontSize: 16, fontWeight: '600' }}>{titulo}</Texto>
          {sub ? <Texto suave estilo={{ marginTop: espacio.xs, fontSize: 13 }}>{sub}</Texto> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.textoSuave} />
      </View>
    </Tarjeta>
  );
}

export default function Modulo() {
  const { modulo: codigo } = useLocalSearchParams();
  const { usuario, permisos } = useSesion();
  const puede = usePuede();
  const router = useRouter();
  const modulo = buscarModulo(String(codigo));
  const permitido = modulo && permisos[modulo.codigo]?.ver;
  const acciones = (modulo?.acciones ?? []).filter((a) => !a.visible || a.visible({ usuario, puede }));

  return (
    <Pantalla>
      <Stack.Screen options={{ title: modulo?.titulo ?? 'Módulo' }} />
      {!permitido ? (
        <Vacio icono="lock-closed-outline" titulo="Sin acceso" texto="Tu rol no tiene acceso a este módulo." />
      ) : !modulo.recursos.length && !acciones.length ? (
        <Vacio icono="time-outline" titulo="Módulo en preparación" texto={`${modulo.descripcion}: se habilita en la próxima versión.`} />
      ) : (
        <>
          {acciones.map((a) => (
            <Fila key={a.titulo} icono={a.icono} titulo={a.titulo} onPress={() => router.push(a.ruta(usuario))} />
          ))}
          {acciones.length && modulo.recursos.length ? <Texto suave estilo={{ marginVertical: espacio.s }}>Consultas</Texto> : null}
          {modulo.recursos.map((r) => (
            <Fila key={r.ruta} titulo={r.titulo} sub={ALCANCE[permisos[modulo.codigo]?.alcance]}
              onPress={() => router.push(`/modulos/${modulo.codigo}/${r.ruta}`)} />
          ))}
        </>
      )}
    </Pantalla>
  );
}
