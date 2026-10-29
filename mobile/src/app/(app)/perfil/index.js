// Perfil (como ProfilePage de R3): datos de la cuenta, seguridad, apariencia y sesión.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, FilaLista, Avatar, InsigniaRol, Insignia, Boton } from '../../../componentes/ui';
import ConfirmDialog from '../../../componentes/ConfirmDialog';
import SelectorTema from '../../../componentes/SelectorTema';
import { useSesion } from '../../../contexto/sesion';
import { useToast } from '../../../contexto/toast';
import { espacio, useTema } from '../../../tema';

function Opcion({ icono, titulo, sub, derecha, onPress, ultima }) {
  const t = useTema();
  return (
    <FilaLista onPress={onPress} ultima={ultima}>
      <Ionicons name={icono} size={20} color={t.primario} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.texto, fontWeight: '500' }}>{titulo}</Text>
        {sub ? <Text style={{ color: t.textoSuave, fontSize: 13 }}>{sub}</Text> : null}
      </View>
      {derecha}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={t.textoTenue} /> : null}
    </FilaLista>
  );
}

export default function Perfil() {
  const { usuario, logout } = useSesion();
  const toast = useToast();
  const router = useRouter();
  const t = useTema();
  const [saliendo, setSaliendo] = useState(false);
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const nombre = `${usuario.nombre} ${usuario.apellido}`;

  return (
    <Pantalla>
      <Tarjeta acentoArriba>
        <View style={estilos.cabecera}>
          <Avatar nombre={nombre} tamano={64} />
          <View style={{ flex: 1 }}>
            <Text style={[estilos.nombre, { color: t.texto }]}>{nombre}</Text>
            <Text style={{ color: t.textoSuave }}>{usuario.email}</Text>
            <View style={estilos.insignias}>
              <InsigniaRol rol={usuario.rol} />
              {usuario.rol === 'ADMIN' ? null
                : usuario.area ? <Insignia texto={usuario.area.nombre} icono="business-outline" /> : <Insignia texto="Sin área asignada" tono="aviso" />}
            </View>
          </View>
        </View>
      </Tarjeta>

      <Tarjeta titulo="Seguridad" icono="shield-checkmark-outline" sinRelleno>
        <Opcion icono="key-outline" titulo="Verificación en dos pasos"
          sub={usuario.dosPasosActivo ? 'App autenticadora, email o códigos de respaldo' : 'Recomendamos activarla'}
          derecha={<Insignia texto={usuario.dosPasosActivo ? 'Activada' : 'Desactivada'} tono={usuario.dosPasosActivo ? 'exito' : 'gris'} />}
          onPress={() => router.push('/perfil/dos-pasos')} />
        <Opcion icono="notifications-outline" titulo="Avisos" sub="Licencias, aprobaciones y tareas" onPress={() => router.push('/perfil/notificaciones')} ultima />
      </Tarjeta>

      <Tarjeta titulo="Ayuda" icono="help-circle-outline" sinRelleno>
        <Opcion icono="book-outline" titulo="Guía rápida de uso" sub="Paso a paso de lo que podés hacer con tu rol"
          onPress={() => router.push('/perfil/ayuda')} ultima />
      </Tarjeta>

      <Tarjeta titulo="Apariencia" icono="color-palette-outline">
        <Text style={{ color: t.textoSuave, marginBottom: espacio.m }}>Elegí el modo de color de la app. Se recuerda en este dispositivo.</Text>
        <SelectorTema />
      </Tarjeta>

      <Tarjeta titulo="Sesión" icono="log-out-outline">
        <Boton titulo="Cerrar sesión" variante="oscuro" icono="log-out-outline" cargando={saliendo} textoCargando="Cerrando…"
          onPress={async () => { setSaliendo(true); await logout(); }} />
        <Boton titulo="Cerrar sesión en todos los dispositivos" variante="contornoPeligro" icono="phone-portrait-outline"
          deshabilitado={saliendo} onPress={() => setConfirmarTodas(true)} estilo={{ marginBottom: 0 }} />
      </Tarjeta>

      <ConfirmDialog
        visible={confirmarTodas}
        titulo="Cerrar todas las sesiones"
        mensaje="Se cerrará tu sesión en todos los celulares y navegadores, incluido este. ¿Continuar?"
        textoConfirmar="Cerrar todas"
        variante="aviso"
        alCerrar={() => setConfirmarTodas(false)}
        alConfirmar={async () => {
          toast.exito('Se cerraron todas tus sesiones.');
          await logout({ todas: true });
        }}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  nombre: { fontSize: 22, fontWeight: '600' },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs, marginTop: espacio.s },
});
