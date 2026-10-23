// Tarjeta de fichaje: muestra si el empleado está dentro y le permite registrar entrada o salida.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Tarjeta, Boton, Insignia, Esqueleto } from './ui';
import { useToast } from '../contexto/toast';
import { api } from '../lib/api';
import { horaCorta } from '../modulos';
import { espacio, useTema } from '../tema';

const duracion = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

export default function Fichaje() {
  const t = useTema();
  const toast = useToast();
  const [estado, setEstado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEstado(await api('/asistencias/hoy'));
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);
  useEffect(() => { cargar(); }, [cargar]);

  async function fichar() {
    setEnviando(true);
    try {
      const entrando = !estado.dentro;
      const nuevo = await api(`/asistencias/${entrando ? 'entrada' : 'salida'}`, { metodo: 'POST' });
      setEstado(nuevo);
      toast.exito(entrando ? `Entrada registrada a las ${horaCorta(nuevo.desde)}` : 'Salida registrada. ¡Buen descanso!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Fichaje" icono="time-outline"
      derecha={estado ? <Insignia texto={estado.dentro ? 'En turno' : 'Fuera de turno'} tono={estado.dentro ? 'exito' : 'gris'} /> : null}>
      {!estado ? (
        <><Esqueleto ancho="60%" /><Esqueleto ancho="100%" alto={44} estilo={{ marginTop: 12 }} /></>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: espacio.m }}>
            <Text style={{ color: t.textoSuave }}>{estado.dentro ? `Desde las ${horaCorta(estado.desde)}` : 'Hoy'}</Text>
            <Text style={{ color: t.texto, fontWeight: '600' }}>{duracion(estado.minutosHoy)}</Text>
          </View>
          <Boton
            titulo={estado.dentro ? 'Registrar salida' : 'Registrar entrada'}
            variante={estado.dentro ? 'oscuro' : 'primario'}
            icono={estado.dentro ? 'exit-outline' : 'enter-outline'}
            onPress={fichar}
            cargando={enviando}
            textoCargando="Registrando…"
            estilo={{ marginBottom: 0 }}
          />
        </>
      )}
    </Tarjeta>
  );
}
