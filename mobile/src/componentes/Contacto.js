// Botones para comunicarse con el cliente o el proveedor desde el teléfono: llamar y WhatsApp.
// El número sale de la base (no de algo escaneado ni escrito por terceros) y se reduce a dígitos
// antes de armar el enlace; si no parece un teléfono, no se muestra el botón.
import { Linking, View } from 'react-native';
import { Boton } from './ui';
import { useToast } from '../contexto/toast';
import { espacio } from '../tema';

/** '+54 9 2477 41-2233' → '5492477412233'. Null si no tiene entre 8 y 15 dígitos. */
export function soloDigitos(telefono) {
  const d = String(telefono ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export default function Contacto({ telefono, mensaje }) {
  const toast = useToast();
  const numero = soloDigitos(telefono);
  if (!numero) return null;

  async function abrir(url) {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('No se pudo abrir la aplicación en este dispositivo.');
    }
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
      <Boton titulo="Llamar" icono="call-outline" chico variante="secundario" onPress={() => abrir(`tel:+${numero}`)} estilo={{ marginBottom: 0 }} />
      <Boton titulo="WhatsApp" icono="logo-whatsapp" chico variante="exito" estilo={{ marginBottom: 0 }}
        onPress={() => abrir(`https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`)} />
    </View>
  );
}
