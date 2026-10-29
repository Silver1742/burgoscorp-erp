// Personal: cuánta gente trabaja en BurgosCorp, en qué área, quién está a cargo de cada una y
// quién vino hoy. El administrador, gerencia y RRHH ven toda la empresa; un jefe, su área.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pantalla, EncabezadoPagina, Tarjeta, FilaLista, Insignia, IconoEstadistica, EsqueletoLista, ErrorCarga, Texto, Avatar,
} from '../../../../componentes/ui';
import { usePuede } from '../../../../contexto/sesion';
import { api } from '../../../../lib/api';
import { fechaCorta } from '../../../../modulos';
import { espacio, useTema, usePantalla } from '../../../../tema';

function Numero({ icono, tono, valor, etiqueta }) {
  const t = useTema();
  return (
    <Tarjeta estilo={{ marginBottom: 0, flex: 1 }}>
      <IconoEstadistica icono={icono} tono={tono} />
      <Text style={[estilos.numero, { color: t.texto }]}>{valor}</Text>
      <Text style={{ color: t.textoSuave, fontSize: 13 }}>{etiqueta}</Text>
    </Tarjeta>
  );
}

export default function Personal() {
  const t = useTema();
  const router = useRouter();
  const puede = usePuede();
  const { columnas } = usePantalla();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDatos(await api('/personal/resumen'));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const porFila = columnas >= 3 ? 4 : 2;
  const tot = datos?.totales;

  return (
    <Pantalla anchoMax={1140}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}>
      <EncabezadoPagina titulo="Personal" icono="people"
        sub={datos ? `Cuánta gente trabaja y dónde · hoy ${fechaCorta(datos.fecha)}` : 'Cuánta gente trabaja y dónde'} />
      {error ? <Tarjeta><ErrorCarga error={error} onReintentar={cargar} /></Tarjeta> : null}
      {!datos && !error ? <Tarjeta><EsqueletoLista filas={4} /></Tarjeta> : null}

      {tot ? (
        <View style={estilos.grilla}>
          {[
            { icono: 'people', tono: 'rojo', valor: tot.personal, etiqueta: 'Personas en la empresa' },
            { icono: 'hammer', tono: 'exito', valor: tot.trabajando_ahora, etiqueta: 'Trabajando ahora (ficharon)' },
            { icono: 'calendar', tono: 'gris', valor: tot.vinieron_hoy, etiqueta: 'Vinieron hoy' },
            { icono: 'airplane', tono: 'aviso', valor: tot.en_licencia, etiqueta: 'De licencia' },
          ].map((n) => (
            <View key={n.etiqueta} style={{ width: `${100 / porFila}%`, padding: espacio.xs }}><Numero {...n} /></View>
          ))}
        </View>
      ) : null}

      {datos?.cuentas_sin_area?.length ? (
        <Tarjeta titulo="Cuentas sin área" icono="alert-circle-outline" iconoColor={t.aviso} sinRelleno>
          <Texto suave estilo={{ paddingHorizontal: espacio.l, paddingTop: espacio.m }}>
            Entran pero no ven ningún módulo. Tocá una para asignarle área, puesto y habilidades.
          </Texto>
          {datos.cuentas_sin_area.map((u, i) => (
            <FilaLista key={u.id} ultima={i === datos.cuentas_sin_area.length - 1}
              onPress={puede('SEG', 'ver') ? () => router.push(`/modulos/usuarios/${u.id}`) : undefined}>
              <Avatar nombre={`${u.nombre} ${u.apellido}`} tamano={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.texto, fontWeight: '600' }}>{u.apellido}, {u.nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }}>{u.email}</Text>
              </View>
              {puede('SEG', 'ver') ? <Ionicons name="chevron-forward" size={18} color={t.textoTenue} /> : null}
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}

      {datos ? (
        <Tarjeta titulo="Por área" icono="business-outline" sinRelleno>
          {datos.areas.map((a, i) => (
            <FilaLista key={a.id} ultima={i === datos.areas.length - 1}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.texto, fontWeight: '600', fontSize: 15 }}>{a.nombre}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 13 }} numberOfLines={1}>
                  {a.jefe_nombre ? `Jefe: ${a.jefe_nombre}` : 'Sin jefe asignado'}
                </Text>
                <View style={[estilos.fila, { marginTop: 6 }]}>
                  {a.trabajando_ahora ? <Insignia texto={`${a.trabajando_ahora} trabajando`} tono="exito" /> : null}
                  {a.en_licencia ? <Insignia texto={`${a.en_licencia} de licencia`} tono="aviso" /> : null}
                  {a.sin_cuenta ? <Insignia texto={`${a.sin_cuenta} sin cuenta en la app`} /> : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[estilos.cantidad, { color: t.texto }]}>{a.total}</Text>
                <Text style={{ color: t.textoSuave, fontSize: 12 }}>{a.total === 1 ? 'persona' : 'personas'}</Text>
              </View>
            </FilaLista>
          ))}
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -espacio.xs, marginBottom: espacio.l },
  numero: { fontSize: 28, fontWeight: '600', marginTop: espacio.s },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  cantidad: { fontSize: 22, fontWeight: '700' },
});
