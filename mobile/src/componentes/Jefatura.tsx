// "Esta área ya tiene jefe": cuando se pone a alguien como jefe de un área que ya tiene uno, la API
// responde 409 JEFE_OCUPADO. Este diálogo pregunta qué hacer con el actual y reintenta:
//   - Destituirlo: pasa a ser empleado de la misma área.
//   - Pasarlo a otra área: queda como jefe de un área que no tenga jefe.
//
//   const { conJefatura, dialogoJefatura } = useJefatura();
//   await conJefatura((jefeActual) => api('/usuarios', { metodo: 'POST', cuerpo: { ...datos, jefe_actual: jefeActual } }));
//   ...
//   {dialogoJefatura}
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ConfirmDialog from './ConfirmDialog';
import { espacio, radio, useTema } from '../tema';

type OpcionProps = {
  activa?: any;
  titulo?: any;
  texto?: any;
  onPress?: (...args: any[]) => any;
  deshabilitada?: any;
};


class Cancelado extends Error {
  codigo: string;

  constructor() { super('No se hizo ningún cambio.'); this.codigo = 'CANCELADO'; }
}

function Opcion({ activa, titulo, texto, onPress, deshabilitada }: OpcionProps) {
  const t = useTema();
  return (
    <Pressable onPress={deshabilitada ? undefined : onPress} accessibilityRole="radio" accessibilityState={{ selected: activa, disabled: deshabilitada }}
      style={[estilos.opcion, { borderColor: activa ? t.primario : t.borde, opacity: deshabilitada ? 0.5 : 1 }]}>
      <Ionicons name={activa ? 'radio-button-on' : 'radio-button-off'} size={20} color={activa ? t.primario : t.textoSuave} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.texto, fontWeight: '600' }}>{titulo}</Text>
        <Text style={{ color: t.textoSuave, fontSize: 13 }}>{texto}</Text>
      </View>
    </Pressable>
  );
}

export function useJefatura() {
  const t = useTema();
  const [pendiente, setPendiente] = useState(null); // { detalle, reintentar, resolver, rechazar }
  const [accion, setAccion] = useState('destituir');
  const [destino, setDestino] = useState(null);

  /** Corre `llamar(undefined)`; si el área ya tiene jefe, pregunta y vuelve a llamar con la decisión. */
  const conJefatura = useCallback((llamar) => llamar(undefined).catch((err) => {
    if (err.codigo !== 'JEFE_OCUPADO') throw err;
    setAccion('destituir');
    setDestino(null);
    return new Promise((resolver, rechazar) => {
      setPendiente({ detalle: err.detalles?.[0] ?? {}, reintentar: llamar, resolver, rechazar });
    });
  }), []);

  const d = pendiente?.detalle ?? {};
  const jefes = (d.jefes ?? []).map((j) => j.nombre).join(', ');
  const libres = d.areas_libres ?? [];

  const dialogoJefatura = (
    <ConfirmDialog
      visible={Boolean(pendiente)}
      titulo={`${d.area?.nombre ?? 'El área'} ya tiene jefe`}
      mensaje={`Un área tiene un solo jefe. ¿Qué hacemos con ${jefes || 'el jefe actual'}?`}
      textoConfirmar="Confirmar" variante="primario"
      deshabilitado={accion === 'mover' && !destino}
      alConfirmar={async () => {
        const r = await pendiente.reintentar(accion === 'mover' ? { accion, area_id: destino } : { accion });
        pendiente.resolver(r);
        setPendiente(null);
      }}
      alCerrar={() => { if (pendiente) { pendiente.rechazar(new Cancelado()); setPendiente(null); } }}>
      <Opcion activa={accion === 'destituir'} onPress={() => setAccion('destituir')}
        titulo="Destituirlo" texto={`${jefes || 'El jefe actual'} sigue en el área como empleado y la persona nueva queda a cargo.`} />
      <Opcion activa={accion === 'mover'} onPress={() => setAccion('mover')} deshabilitada={!libres.length}
        titulo="Pasarlo a otra área" texto={libres.length ? 'Queda como jefe de un área que hoy no tiene jefe.' : 'No hay áreas sin jefe.'} />
      {accion === 'mover' && libres.length ? (
        <View style={estilos.chips}>
          {libres.map((a) => (
            <Pressable key={a.id} onPress={() => setDestino(a.id)} accessibilityRole="radio" accessibilityState={{ selected: destino === a.id }}
              style={[estilos.chip, { borderColor: destino === a.id ? t.primario : t.borde, backgroundColor: destino === a.id ? t.primario : t.superficie }]}>
              <Text style={{ color: destino === a.id ? '#ffffff' : t.texto, fontSize: 13 }}>{a.nombre}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ConfirmDialog>
  );

  return { conJefatura, dialogoJefatura };
}

/** Para los `catch`: cancelar el diálogo no es un error que haya que mostrar en rojo. */
export const esCancelado = (err) => err?.codigo === 'CANCELADO';

const estilos = StyleSheet.create({
  opcion: { flexDirection: 'row', gap: espacio.m, alignItems: 'center', borderWidth: 1, borderRadius: radio.l, padding: espacio.m, marginBottom: espacio.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: espacio.s },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
