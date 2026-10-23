// Inicio: saludo, rol y accesos rápidos con datos reales de la API.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, Texto, Titulo, Etiqueta, Aviso } from '../../componentes/ui';
import { useSesion } from '../../contexto/sesion';
import { api } from '../../lib/api';
import { MODULOS, ROLES } from '../../modulos';
import { espacio, useTema, usePantalla } from '../../tema';

const DESCRIPCION_ROL = {
  ADMIN: 'Tenés acceso completo, incluida la administración de usuarios.',
  GERENCIA: 'Podés consultar todos los módulos de la empresa.',
  JEFE: 'Gestionás los módulos de tu área y las tareas de tu equipo.',
  EMPLEADO: 'Acá vas a ver tus tareas, fichaje y solicitudes.',
};

export default function Inicio() {
  const { usuario, permisos } = useSesion();
  const router = useRouter();
  const t = useTema();
  const { columnas } = usePantalla();
  const [resumen, setResumen] = useState([]);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  // Hasta 4 recursos visibles para el rol, con su total de registros.
  const accesos = MODULOS.filter((m) => permisos[m.codigo]?.ver)
    .flatMap((m) => m.recursos.slice(0, 1).map((r) => ({ modulo: m, recurso: r })))
    .slice(0, 4);
  const claveAccesos = accesos.map((a) => a.recurso.ruta).join(',');

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const datos = await Promise.all(accesos.map(async (a) => {
        const r = await api(`/${a.recurso.ruta}`, { consulta: { limite: 1 } });
        return { ...a, total: r.meta.total };
      }));
      setResumen(datos);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveAccesos]);

  useEffect(() => { cargar(); }, [cargar]);

  async function recargar() {
    setRecargando(true);
    await cargar();
    setRecargando(false);
  }

  const anchoTarjeta = `${100 / Math.min(columnas, 2)}%`;

  return (
    <ScrollView
      style={{ backgroundColor: t.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={recargar} />}
    >
      <View style={estilos.centrado}>
        <Titulo sub={DESCRIPCION_ROL[usuario.rol]}>Hola, {usuario.nombre}</Titulo>
        <View style={estilos.fila}>
          <Etiqueta texto={ROLES[usuario.rol]} color={t.acento} />
          {usuario.area ? <Etiqueta texto={usuario.area.nombre} /> : null}
        </View>

        {!usuario.area && usuario.rol === 'EMPLEADO' ? (
          <Aviso tipo="aviso">Tu cuenta todavía no está vinculada a un legajo. Pedile a RRHH o a un administrador que te asigne tu área.</Aviso>
        ) : null}
        {!usuario.dosPasosActivo ? (
          <Tarjeta onPress={() => router.push('/perfil/dos-pasos', { withAnchor: true })} estilo={estilos.sugerencia}>
            <View style={estilos.fila}>
              <Ionicons name="shield-checkmark-outline" size={22} color={t.primario} />
              <Texto estilo={{ marginLeft: espacio.s, flex: 1 }}>Protegé tu cuenta activando la verificación en dos pasos.</Texto>
              <Ionicons name="chevron-forward" size={20} color={t.textoSuave} />
            </View>
          </Tarjeta>
        ) : null}

        <Aviso onReintentar={cargar}>{error}</Aviso>

        <Texto estilo={estilos.seccion}>Accesos rápidos</Texto>
        <View style={estilos.grilla}>
          {resumen.map(({ modulo, recurso, total }) => (
            <View key={recurso.ruta} style={{ width: anchoTarjeta, padding: espacio.xs }}>
              <Tarjeta onPress={() => router.push(`/modulos/${modulo.codigo}/${recurso.ruta}`, { withAnchor: true })} estilo={{ marginBottom: 0 }}>
                <Ionicons name={modulo.icono} size={26} color={t.acento} />
                <Texto estilo={estilos.numero}>{total}</Texto>
                <Texto suave>{recurso.titulo}</Texto>
              </Tarjeta>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: espacio.l },
  centrado: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.l, flexWrap: 'wrap' },
  sugerencia: { paddingVertical: espacio.m },
  seccion: { fontSize: 17, fontWeight: '700', marginBottom: espacio.s, marginTop: espacio.s },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs },
  numero: { fontSize: 28, fontWeight: '700', marginTop: espacio.s },
});
