// Detalle de una tarea abierta desde "Mis tareas" (mismo componente que en el módulo Tareas).
import { useLocalSearchParams } from 'expo-router';
import DetalleTarea from '../../../componentes/DetalleTarea';

export default function TareaPropia() {
  const { id } = useLocalSearchParams();
  return <DetalleTarea id={String(id)} />;
}
