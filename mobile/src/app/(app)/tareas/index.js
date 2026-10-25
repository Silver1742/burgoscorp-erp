// Mis tareas: lo que tengo asignado, con Iniciar / Pausar a mano.
import ListaTareas from '../../../componentes/ListaTareas';

const FILTROS = [
  { valor: 'abiertas', titulo: 'Para hacer', consulta: { abiertas: 1 } },
  { valor: 'revision', titulo: 'En revisión', consulta: { estado: 'en_revision' } },
  { valor: 'aprobadas', titulo: 'Aprobadas', consulta: { estado: 'aprobada' } },
];

export default function MisTareas() {
  return (
    <ListaTareas mias titulo="Mis tareas" icono="checkbox" sub="Las operaciones que tenés asignadas. Lo urgente y lo que vence antes, primero."
      filtros={FILTROS} rutaDetalle={(id) => `/tareas/${id}`} />
  );
}
