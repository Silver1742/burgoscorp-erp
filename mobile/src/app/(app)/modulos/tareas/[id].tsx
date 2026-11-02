// Detalle de una tarea abierta desde el módulo Tareas (el contenido está en componentes/DetalleTarea).
import { useLocalSearchParams } from 'expo-router';
import DetalleTarea from '../../../../componentes/DetalleTarea';

export default function TareaDelModulo() {
  const { id } = useLocalSearchParams();
  return <DetalleTarea id={String(id)} />;
}
