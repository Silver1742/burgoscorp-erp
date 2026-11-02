// Identidad de cada rol: color, nombre del panel e ícono. Se ve en la barra de pestañas (línea de
// color), en el encabezado de Inicio y en las insignias, para que se note enseguida desde qué rol se
// está usando la app.
export const PERFIL_ROL = {
  EMPLEADO: {
    titulo: 'Empleado', panel: 'Mi día', icono: 'person', color: '#2563eb', suave: 'rgba(37,99,235,0.14)',
    lema: 'Tus tareas, tu fichaje y tus pedidos.',
  },
  JEFE: {
    titulo: 'Jefe de área', panel: 'Mi área', icono: 'people', color: '#d97706', suave: 'rgba(217,119,6,0.16)',
    lema: 'Tu equipo, las tareas para asignar y lo que espera tu aprobación.',
  },
  GERENCIA: {
    titulo: 'Gerencia', panel: 'La empresa', icono: 'stats-chart', color: '#7c3aed', suave: 'rgba(124,58,237,0.15)',
    lema: 'Cómo viene la empresa: áreas, personal, producción y ventas.',
  },
  ADMIN: {
    titulo: 'Administrador', panel: 'Administración', icono: 'shield-half', color: '#c8102e', suave: 'rgba(200,16,46,0.14)',
    lema: 'Cuentas, accesos, áreas y la organización de la empresa.',
  },
};

export const perfilRol = (rol) => PERFIL_ROL[rol] ?? PERFIL_ROL.EMPLEADO;
