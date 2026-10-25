// Detalle de un legajo: datos, habilidades (con certificaciones vencidas) y, si es el propio,
// edición de los datos de contacto. La API decide qué legajos se pueden ver.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, Tarjeta, FilaLista, Insignia, Avatar, Campo, Boton, Esqueleto, ErrorCarga, Vacio,
} from '../../../../../componentes/ui';
import { useSesion } from '../../../../../contexto/sesion';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';
import { fechaCorta } from '../../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../../tema';

const NIVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
const ESTADO = { activo: ['Activo', 'exito'], licencia: ['De licencia', 'aviso'], baja: ['Baja', 'gris'] };

function Dato({ icono, etiqueta, valor, ultima }) {
  const t = useTema();
  return (
    <FilaLista ultima={ultima}>
      <Ionicons name={icono} size={18} color={t.textoSuave} />
      <Text style={{ color: t.textoSuave, width: 110 }}>{etiqueta}</Text>
      <Text style={{ color: t.texto, flex: 1 }}>{valor || '—'}</Text>
    </FilaLista>
  );
}

export default function Legajo() {
  const { id } = useLocalSearchParams();
  const { usuario } = useSesion();
  const toast = useToast();
  const t = useTema();
  const { columnas } = usePantalla();
  const [emp, setEmp] = useState(null);
  const [habilidades, setHabilidades] = useState([]);
  const [error, setError] = useState(null);
  const [contacto, setContacto] = useState({ telefono: '', direccion: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
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
    setErrores({});
    try {
      const e = await api(`/empleados/${id}`, { metodo: 'PUT', cuerpo: { telefono: contacto.telefono.trim() || null, direccion: contacto.direccion.trim() || null } });
      setEmp((prev) => ({ ...prev, ...e }));
      toast.exito('Datos de contacto actualizados.');
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (error) return <Pantalla><Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta></Pantalla>;
  if (!emp) {
    return (
      <Pantalla>
        <Tarjeta><View style={{ flexDirection: 'row', gap: espacio.m, alignItems: 'center' }}><Esqueleto ancho={64} alto={64} estilo={{ borderRadius: 32 }} /><View style={{ flex: 1, gap: 8 }}><Esqueleto ancho="60%" alto={18} /><Esqueleto ancho="40%" /></View></View></Tarjeta>
        <Tarjeta><Esqueleto /><Esqueleto estilo={{ marginTop: 10 }} /><Esqueleto ancho="70%" estilo={{ marginTop: 10 }} /></Tarjeta>
      </Pantalla>
    );
  }

  const [estadoTexto, estadoTono] = ESTADO[emp.estado] ?? ESTADO.activo;
  const nombre = `${emp.nombre} ${emp.apellido}`;
  const dosColumnas = columnas >= 3;
  // flex: 1 solo lado a lado: apiladas en el celular, dentro del scroll se repartirían la altura
  // de la pantalla en vez de crecer con su contenido (la de abajo tapaba a la de arriba).
  const columna = dosColumnas ? { flex: 1 } : null;

  return (
    <Pantalla anchoMax={1140}>
      <Stack.Screen options={{ title: esPropio ? 'Mi legajo' : `Legajo ${emp.legajo}` }} />

      <Tarjeta acentoArriba>
        <View style={estilos.cabecera}>
          <Avatar nombre={nombre} tamano={64} />
          <View style={{ flex: 1 }}>
            <Text style={[estilos.nombre, { color: t.texto }]}>{nombre}</Text>
            <Text style={{ color: t.textoSuave }}>{emp.puesto_nombre ?? 'Sin puesto'} · {emp.area_nombre}</Text>
            <View style={estilos.insignias}>
              <Insignia texto={emp.legajo} icono="id-card-outline" />
              <Insignia texto={estadoTexto} tono={estadoTono} />
            </View>
          </View>
        </View>
      </Tarjeta>

      <View style={[{ gap: espacio.m }, dosColumnas && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={columna}>
          <Tarjeta titulo="Datos del legajo" icono="person-outline" sinRelleno>
            <Dato icono="person-outline" etiqueta="Supervisor" valor={emp.supervisor_nombre} />
            <Dato icono="calendar-outline" etiqueta="Ingreso" valor={fechaCorta(emp.fecha_ingreso)} />
            <Dato icono="card-outline" etiqueta="DNI" valor={emp.dni} />
            <Dato icono="mail-outline" etiqueta="Email laboral" valor={emp.email_laboral} />
            <Dato icono="call-outline" etiqueta="Teléfono" valor={emp.telefono} ultima />
          </Tarjeta>

          {esPropio ? (
            <Tarjeta titulo="Mis datos de contacto" icono="create-outline">
              <Campo etiqueta="Teléfono" value={contacto.telefono} onChangeText={(v) => setContacto((c) => ({ ...c, telefono: v }))}
                error={errores.telefono} keyboardType="phone-pad" maxLength={30} />
              <Campo etiqueta="Dirección" value={contacto.direccion} onChangeText={(v) => setContacto((c) => ({ ...c, direccion: v }))}
                error={errores.direccion} maxLength={150} ayuda="Para cambiar puesto o área, hablá con RRHH." />
              <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} textoCargando="Guardando…" icono="save-outline" estilo={{ marginBottom: 0, alignSelf: 'flex-start' }} />
            </Tarjeta>
          ) : null}
        </View>

        <View style={columna}>
          <Tarjeta titulo="Habilidades y certificaciones" icono="construct-outline" sinRelleno
            derecha={<Insignia texto={String(habilidades.length)} />}>
            {habilidades.length === 0 ? <Vacio icono="construct-outline" titulo="Sin habilidades cargadas" /> : null}
            {habilidades.map((h, i) => (
              <FilaLista key={h.habilidad_id} ultima={i === habilidades.length - 1}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.texto, fontWeight: '600' }}>{h.nombre}</Text>
                  {h.requiere_certificacion ? (
                    <Text style={{ color: h.vencida ? t.error : t.textoSuave, fontSize: 13 }}>
                      Certificación {h.vencida ? 'vencida el' : 'hasta el'} {fechaCorta(h.certificado_vence)}
                    </Text>
                  ) : null}
                </View>
                {h.vencida ? <Insignia texto="Vencida" tono="error" /> : null}
                <Insignia texto={NIVEL[h.nivel]} tono={h.nivel === 'avanzado' ? 'negro' : 'gris'} />
              </FilaLista>
            ))}
          </Tarjeta>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  nombre: { fontSize: 22, fontWeight: '600' },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs, marginTop: espacio.s },
});
