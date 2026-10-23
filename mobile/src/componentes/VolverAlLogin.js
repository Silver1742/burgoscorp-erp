import { Link } from 'expo-router';
import { Boton } from './ui';
import { espacio } from '../tema';

/** Enlace "Volver a iniciar sesión" al pie de las pantallas sin sesión. */
export default function VolverAlLogin({ alPresionar }) {
  if (alPresionar) {
    return <Boton titulo="Volver a iniciar sesión" variante="texto" icono="arrow-back" chico onPress={alPresionar} estilo={{ alignSelf: 'center', marginTop: espacio.l }} />;
  }
  return (
    <Link href="/login" asChild>
      <Boton titulo="Volver a iniciar sesión" variante="texto" icono="arrow-back" chico estilo={{ alignSelf: 'center', marginTop: espacio.l }} />
    </Link>
  );
}
