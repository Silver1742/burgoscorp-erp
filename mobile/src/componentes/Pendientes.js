// Bandeja de pendientes de Inicio (como las solicitudes del Dashboard de R3): todo lo que espera una
// decisión de quien entra, en un solo lugar y con la acción ahí mismo. Licencias se aprueban desde la
// fila; el resto abre la ficha justa (la tarea, la compra, las solicitudes de acceso).
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Boton, Esqueleto, Insignia, Tarjeta } from './ui';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { espacio, radio, useTema } from '../tema';
import { useCargar } from '../lib/cambios';

const ICONO = { acceso: 'person-add', licencia: 'airplane', asignar: 'people', revisar: 'eye', compra: 'cart' };
const DESTINO = {
  acceso: () => '/modulos/usuarios/solicitudes',
  licencia: () => '/modulos/rrhh/aprobaciones',
  asignar: (i) => `/modulos/tareas/${i.id}`,
  revisar: (i) => `/modulos/tareas/${i.id}`,
  compra: (i) => `/modulos/compras/${i.id}`,
};
const ACCION = { acceso: 'Habilitar', asignar: 'Asignar', revisar: 'Revisar', compra: 'Ver' };
// La lista completa de cada tipo.
const TODOS = { acceso: '/modulos/usuarios/solicitudes', licencia: '/modulos/rrhh/aprobaciones', asignar: '/modulos/tareas', revisar: '/modulos/tareas', compra: '/modulos/compras' };

export default function Pendientes({ color }) {
  const t = useTema();
  const router = useRouter();
  const toast = useToast();
  const [grupos, setGrupos] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    try { setGrupos(await api('/pendientes')); } catch { setGrupos([]); }
  }, []);
  useCargar(cargar);

  async function aprobarLicencia(i) {
    setOcupado(i.id);
    try {
      await api(`/licencias/${i.id}/aprobar`, { metodo: 'POST', cuerpo: {} });
      toast.exito(`Licencia de ${i.titulo} aprobada.`);
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOcupado(null);
    }
  }

  if (grupos === null) return <Tarjeta titulo="Pendientes" icono="file-tray-full-outline"><Esqueleto ancho="60%" /></Tarjeta>;
  const total = grupos.reduce((n, g) => n + g.total, 0);
  return (
    <Tarjeta titulo="Pendientes" icono="file-tray-full-outline" derecha={total ? <Insignia texto={`${total}`} tono="rojo" /> : null}>
      {!total ? (
        <View style={estilos.linea}>
          <Ionicons name="checkmark-done-circle" size={22} color={t.exito} />
          <Text style={{ color: t.textoSuave }}>Nada espera tu decisión. Todo al día.</Text>
        </View>
      ) : grupos.map((g) => (
        <View key={g.tipo} style={{ marginBottom: espacio.m }}>
          <View style={[estilos.linea, { marginBottom: 6 }]}>
            <Ionicons name={ICONO[g.tipo]} size={16} color={color} />
            <Text style={{ color: t.texto, fontWeight: '700' }}>{g.titulo}</Text>
            <Insignia texto={String(g.total)} tono="gris" />
          </View>
          {g.items.map((i) => (
            <View key={`${g.tipo}${i.id}`} style={[estilos.fila, { borderColor: t.borde, backgroundColor: t.superficie }]}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push(DESTINO[g.tipo](i), { withAnchor: true })} accessibilityRole="button">
                <Text style={{ color: t.texto, fontWeight: '600' }} numberOfLines={1}>{i.titulo}</Text>
                {i.sub ? <Text style={{ color: t.textoSuave, fontSize: 12 }} numberOfLines={1}>{i.sub}</Text> : null}
              </Pressable>
              {g.tipo === 'licencia' ? (
                <>
                  <Boton titulo="Aprobar" chico variante="exito" onPress={() => aprobarLicencia(i)} cargando={ocupado === i.id} estilo={{ marginBottom: 0 }} />
                  <Boton titulo="Ver" chico variante="secundario" onPress={() => router.push(DESTINO.licencia(i), { withAnchor: true })} estilo={{ marginBottom: 0 }} />
                </>
              ) : (
                <Boton titulo={ACCION[g.tipo]} chico variante="secundario" onPress={() => router.push(DESTINO[g.tipo](i), { withAnchor: true })} estilo={{ marginBottom: 0 }} />
              )}
            </View>
          ))}
          {g.total > g.items.length ? (
            <Pressable onPress={() => router.push(TODOS[g.tipo], { withAnchor: true })} accessibilityRole="link">
              <Text style={{ color, fontSize: 13 }}>y {g.total - g.items.length} más…</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  linea: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, borderWidth: 1, borderRadius: radio.l, padding: espacio.s, paddingLeft: espacio.m, marginBottom: 6 },
});
