// Tareas del área (jefe): primero lo que espera su revisión.
import { useRouter } from 'expo-router';
import ListaTareas from '../../../../componentes/ListaTareas';
import { Boton } from '../../../../componentes/ui';
import { usePuede } from '../../../../contexto/sesion';

const FILTROS = [
  { valor: 'revision', titulo: 'Para revisar', consulta: { estado: 'en_revision' } },
  { valor: 'sin_asignar', titulo: 'Para asignar', consulta: { sin_asignar: 1 } },
  { valor: 'abiertas', titulo: 'Abiertas', consulta: { abiertas: 1 } },
  { valor: 'curso', titulo: 'En curso', consulta: { estado: 'en_curso' } },
  { valor: 'todas', titulo: 'Todas', consulta: {} },
];

export default function TareasDelArea() {
  const router = useRouter();
  const puede = usePuede();
  return (
    <ListaTareas titulo="Tareas del área" icono="people" sub="Asigná, seguí y aprobá el trabajo de tu equipo."
      filtros={FILTROS} rutaDetalle={(id) => `/modulos/tareas/${id}`}
      acciones={puede('TAR', 'crear') ? <Boton titulo="Nueva" icono="add" chico onPress={() => router.push('/modulos/tareas/nueva')} /> : null} />
  );
}
