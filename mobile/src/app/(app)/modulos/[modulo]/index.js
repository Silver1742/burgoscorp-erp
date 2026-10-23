// Pantalla de un módulo: acciones propias (ej. "Pedir licencia") y consultas de sus recursos.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Vacio, Insignia } from '../../../../componentes/ui';
import { useSesion, usePuede } from '../../../../contexto/sesion';
import { buscarModulo } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const ALCANCE = { todo: 'Toda la empresa', area: 'Tu área', propio: 'Solo lo tuyo' };

function Fila({ icono, titulo, sub, onPress, ultima }) {
  const t = useTema();
  return (
    <FilaLista onPress={onPress} ultima={ultima}>
      {icono ? <Ionicons name={icono} size={20} color={t.primario} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.texto, fontSize: 15, fontWeight: '500' }}>{titulo}</Text>
      </View>
      {sub ? <Insignia texto={sub} /> : null}
      <Ionicons name="chevron-forward" size={18} color={t.textoTenue} />
    </FilaLista>
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
      ) : (
        <>
          <EncabezadoPagina titulo={modulo.titulo} sub={modulo.descripcion} icono={modulo.icono.replace('-outline', '')} />
          {!modulo.recursos.length && !acciones.length ? (
            <Tarjeta><Vacio icono="time-outline" titulo="Módulo en preparación" texto="Se habilita en la próxima versión." /></Tarjeta>
          ) : null}
          {acciones.length ? (
            <Tarjeta titulo="Acciones" icono="flash-outline" sinRelleno>
              {acciones.map((a, i) => (
                <Fila key={a.titulo} icono={a.icono} titulo={a.titulo} ultima={i === acciones.length - 1} onPress={() => router.push(a.ruta(usuario))} />
              ))}
            </Tarjeta>
          ) : null}
          {modulo.recursos.length ? (
            <Tarjeta titulo="Consultas" icono="list-outline" sinRelleno>
              {modulo.recursos.map((r, i) => (
                <Fila key={r.ruta} titulo={r.titulo} sub={ALCANCE[permisos[modulo.codigo]?.alcance]} ultima={i === modulo.recursos.length - 1}
                  onPress={() => router.push(`/modulos/${modulo.codigo}/${r.ruta}`)} />
              ))}
            </Tarjeta>
          ) : null}
          <View style={{ height: espacio.l }} />
        </>
      )}
    </Pantalla>
  );
}
