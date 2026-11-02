// Integrantes de un área (desde la pestaña Áreas o desde Personal).
import { useLocalSearchParams } from 'expo-router';
import IntegrantesArea from '../../../../../componentes/IntegrantesArea';

export default function Area() {
  const { id } = useLocalSearchParams();
  return <IntegrantesArea areaId={Number(id)} />;
}
