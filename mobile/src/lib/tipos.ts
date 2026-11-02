// Tipos que se comparten entre pantallas.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

/** Nombre de un ícono de Ionicons (el conjunto que usa toda la app). */
export type NombreIcono = ComponentProps<typeof Ionicons>['name'];

/** Errores de un formulario: campo → mensaje. */
export type ErroresFormulario = Record<string, string>;

/** Una acción del menú de un módulo (Nuevo legajo, Aprobar licencias…). */
export type AccionModulo = {
  titulo: string;
  icono: NombreIcono;
  ruta: (usuario?: any) => string;
  /** Si no está, la ven todos los que entran al módulo. */
  visible?: (ctx: { usuario: any; puede: (modulo: string, accion: string) => boolean; permisos?: any }) => boolean;
  /** Texto corto para los accesos rápidos de Buscar. */
  rapido?: string;
};
