// Recursos de un módulo.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, Texto, Vacio } from '../../../../componentes/ui';
import { useSesion } from '../../../../contexto/sesion';
import { buscarModulo } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

export default function Modulo() {
  const { modulo: codigo } = useLocalSearchParams();
  const { permisos } = useSesion();
  const router = useRouter();
  const t = useTema();
  const modulo = buscarModulo(String(codigo));
  const permitido = modulo && permisos[modulo.codigo]?.ver;

  return (
    <Pantalla>
      <Stack.Screen options={{ title: modulo?.titulo ?? 'Módulo' }} />
      {!permitido ? (
        <Vacio icono="lock-closed-outline" titulo="Sin acceso" texto="Tu rol no tiene acceso a este módulo." />
      ) : !modulo.recursos.length ? (
        <Vacio icono="time-outline" titulo="Módulo en preparación" texto={`${modulo.descripcion}: se habilita en la próxima versión.`} />
      ) : (
        modulo.recursos.map((r) => (
          <Tarjeta key={r.ruta} onPress={() => router.push(`/modulos/${modulo.codigo}/${r.ruta}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Texto estilo={{ flex: 1, fontSize: 16, fontWeight: '600' }}>{r.titulo}</Texto>
              <Ionicons name="chevron-forward" size={20} color={t.textoSuave} />
            </View>
            <Texto suave estilo={{ marginTop: espacio.xs, fontSize: 13 }}>
              {permisos[modulo.codigo]?.alcance === 'todo' ? 'Toda la empresa' : permisos[modulo.codigo]?.alcance === 'area' ? 'Tu área' : 'Solo lo tuyo'}
            </Texto>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
