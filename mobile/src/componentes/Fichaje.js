// Tarjeta de fichaje: muestra si el empleado está dentro y le permite registrar entrada o salida.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tarjeta, Texto, Boton, Aviso } from './ui';
import { api } from '../lib/api';
import { horaCorta } from '../modulos';
import { espacio, useTema } from '../tema';

const duracion = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

export default function Fichaje() {
  const t = useTema();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEstado(await api('/asistencias/hoy'));
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function fichar() {
    setError(null);
    setEnviando(true);
    try {
      setEstado(await api(`/asistencias/${estado.dentro ? 'salida' : 'entrada'}`, { metodo: 'POST' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!estado && !error) return null;

  return (
    <Tarjeta>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: espacio.s }}>
        <Ionicons name="time-outline" size={22} color={estado?.dentro ? t.exito : t.textoSuave} />
        <Texto estilo={{ marginLeft: espacio.s, fontWeight: '700', flex: 1 }}>
          {estado?.dentro ? `Trabajando desde las ${horaCorta(estado.desde)}` : 'Fuera de turno'}
        </Texto>
      </View>
      {estado ? <Texto suave estilo={{ marginBottom: espacio.m }}>Hoy: {duracion(estado.minutosHoy)}</Texto> : null}
      <Aviso>{error}</Aviso>
      {estado ? (
        <Boton
          titulo={estado.dentro ? 'Registrar salida' : 'Registrar entrada'}
          variante={estado.dentro ? 'secundario' : 'primario'}
          icono={estado.dentro ? 'exit-outline' : 'enter-outline'}
          onPress={fichar}
          cargando={enviando}
          estilo={{ marginBottom: 0 }}
        />
      ) : null}
    </Tarjeta>
  );
}
