// Ayudas compartidas por las pantallas de Usuarios.

/** Estado de una cuenta como lo ve el administrador (mismos nombres que en R3). */
export function estadoUsuario(u) {
  if (u.estado_cuenta === 'pendiente') return { texto: 'Pendiente', tono: 'aviso', icono: 'hourglass-outline' };
  if (u.estado_cuenta === 'rechazada') return { texto: 'Rechazada', tono: 'error', icono: 'close-circle-outline' };
  if (!u.activo) return { texto: 'De baja', tono: 'gris', icono: 'pause-circle-outline' };
  return { texto: 'Activo', tono: 'exito', icono: 'checkmark-circle-outline' };
}

/** "hace 5 min", "hace 3 h", "hace 2 d" o la fecha si pasó más de un mes. */
export function haceCuanto(fecha) {
  if (!fecha) return '—';
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d <= 30) return `hace ${d} d`;
  return `el ${new Date(fecha).toLocaleDateString('es-AR')}`;
}

/** Cómo entra la persona: con contraseña o con una red social. */
export function metodoIngreso(redes) {
  if (!redes) return 'Email y contraseña';
  const nombres = { google: 'Google', github: 'GitHub', facebook: 'Facebook' };
  return redes.split(',').map((r) => nombres[r] ?? r).join(', ');
}
