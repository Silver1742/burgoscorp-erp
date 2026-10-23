// Mis tareas: se completa cuando se conecte el módulo de Producción y Tareas.
import { Pantalla, Vacio } from '../../componentes/ui';

export default function MisTareas() {
  return (
    <Pantalla scroll={false}>
      <Vacio
        icono="checkbox-outline"
        titulo="Todavía no hay tareas asignadas"
        texto="Cuando tu jefe te asigne una operación de una orden de trabajo, la vas a ver acá."
      />
    </Pantalla>
  );
}
