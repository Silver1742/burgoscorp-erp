// Detalle de un legajo: datos, habilidades (con certificaciones vencidas) y, si es el propio,
// edición de los datos de contacto. La API decide qué legajos se pueden ver.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pantalla, Tarjeta, Texto, Etiqueta, Aviso, Cargando, Campo, Boton } from '../../../../../componentes/ui';
import { useSesion } from '../../../../../contexto/sesion';
import { api } from '../../../../../lib/api';
import { fechaCorta } from '../../../../../modulos';
import { espacio, useTema } from '../../../../../tema';

const NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

function Dato({ icono, etiqueta, valor }) {
  const t = useTema();
  return (
    <View style={estilos.dato}>
      <Ionicons name={icono} size={18} color={t.textoSuave} style={{ width: 26 }} />
      <Texto suave estilo={{ width: 110 }}>{etiqueta}</Texto>
      <Texto estilo={{ flex: 1 }}>{valor || '—'}</Texto>
    </View>
  );
}

export default function Legajo() {
  const { id } = useLocalSearchParams();
  const { usuario } = useSesion();
  const t = useTema();
  const [emp, setEmp] = useState(null);
  const [habilidades, setHabilidades] = useState([]);
  const [error, setError] = useState(null);
  const [contacto, setContacto] = useState({ telefono: '', direccion: '' });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const esPropio = Number(id) === usuario.empleadoId;

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [e, h] = await Promise.all([api(`/empleados/${id}`), api(`/empleados/${id}/habilidades`)]);
      setEmp(e);
      setHabilidades(h);
      setContacto({ telefono: e.telefono ?? '', direccion: e.direccion ?? '' });
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      const e = await api(`/empleados/${id}`, { metodo: 'PUT', cuerpo: { telefono: contacto.telefono.trim() || null, direccion: contacto.direccion.trim() || null } });
      setEmp((prev) => ({ ...prev, ...e }));
      setMensaje('Datos de contacto actualizados');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!emp) return <Pantalla>{error ? <Aviso onReintentar={cargar}>{error}</Aviso> : <Cargando />}</Pantalla>;

  return (
    <Pantalla>
      <Stack.Screen options={{ title: esPropio ? 'Mi legajo' : `Legajo ${emp.legajo}` }} />
      <Tarjeta>
        <Texto estilo={estilos.nombre}>{emp.nombre} {emp.apellido}</Texto>
        <View style={{ flexDirection: 'row', gap: espacio.s, marginVertical: espacio.s, flexWrap: 'wrap' }}>
          <Etiqueta texto={emp.legajo} />
          <Etiqueta texto={emp.area_nombre} color={t.acento} />
          {emp.estado !== 'activo' ? <Etiqueta texto={emp.estado === 'baja' ? 'Baja' : 'De licencia'} color={t.aviso} /> : null}
        </View>
        <Dato icono="briefcase-outline" etiqueta="Puesto" valor={emp.puesto_nombre} />
        <Dato icono="person-outline" etiqueta="Supervisor" valor={emp.supervisor_nombre} />
        <Dato icono="calendar-outline" etiqueta="Ingreso" valor={fechaCorta(emp.fecha_ingreso)} />
        <Dato icono="card-outline" etiqueta="DNI" valor={emp.dni} />
        <Dato icono="mail-outline" etiqueta="Email laboral" valor={emp.email_laboral} />
      </Tarjeta>

      <Texto estilo={estilos.seccion}>Habilidades y certificaciones</Texto>
      {habilidades.length === 0 ? <Texto suave>Sin habilidades cargadas.</Texto> : null}
      {habilidades.map((h) => (
        <Tarjeta key={h.habilidad_id} estilo={{ paddingVertical: espacio.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Texto estilo={{ flex: 1, fontWeight: '600' }}>{h.nombre}</Texto>
            <Etiqueta texto={NIVEL[h.nivel]} />
          </View>
          {h.requiere_certificacion ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: espacio.xs, gap: espacio.s }}>
              <Texto suave estilo={{ fontSize: 13 }}>Certificación hasta {fechaCorta(h.certificado_vence)}</Texto>
              {h.vencida ? <Etiqueta texto="Vencida" color={t.error} /> : null}
            </View>
          ) : null}
        </Tarjeta>
      ))}

      {esPropio ? (
        <>
          <Texto estilo={estilos.seccion}>Mis datos de contacto</Texto>
          <Aviso tipo="exito">{mensaje}</Aviso>
          <Aviso>{error}</Aviso>
          <Campo etiqueta="Teléfono" value={contacto.telefono} onChangeText={(v) => setContacto((c) => ({ ...c, telefono: v }))}
            keyboardType="phone-pad" maxLength={30} />
          <Campo etiqueta="Dirección" value={contacto.direccion} onChangeText={(v) => setContacto((c) => ({ ...c, direccion: v }))}
            maxLength={150} />
          <Boton titulo="Guardar" onPress={guardar} cargando={guardando} icono="save-outline" />
          <Texto suave estilo={{ fontSize: 13 }}>Para cambiar otros datos (puesto, área), hablá con RRHH.</Texto>
        </>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  nombre: { fontSize: 20, fontWeight: '700' },
  dato: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  seccion: { fontSize: 17, fontWeight: '700', marginTop: espacio.l, marginBottom: espacio.s },
});
