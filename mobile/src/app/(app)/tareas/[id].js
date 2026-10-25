import { useLocalSearchParams } from 'expo-router';
import DetalleTarea from '../../../componentes/DetalleTarea';

export default function TareaPropia() {
  const { id } = useLocalSearchParams();
  return <DetalleTarea id={String(id)} />;
}
