// Catálogo de módulos del ERP y de los recursos que muestra cada uno.
// La app solo muestra los módulos con permiso "ver" (según /auth/yo); la API valida igual.

const pesos = (n) => (n == null ? '—' : `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`);

/** 'AAAA-MM-DD' → '23/10/2026' */
export const fechaCorta = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—');
/** Fecha y hora ISO (UTC) → hora local '08:05' */
export const horaCorta = (f) => (f ? new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');

export const diasHabiles = (n) => `${n} ${Number(n) === 1 ? 'día hábil' : 'días hábiles'}`;

export const TIPO_LICENCIA = {
  vacaciones: 'Vacaciones', enfermedad: 'Enfermedad', estudio: 'Examen / estudio', personal: 'Trámite personal', otro: 'Otro',
};
export const ESTADO_LICENCIA = {
  pendiente: { texto: 'Pendiente del jefe', tono: 'aviso' },
  aprobada_jefe: { texto: 'Pendiente de RRHH', tono: 'aviso' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'error' },
  cancelada: { texto: 'Cancelada' },
};

export const PRIORIDAD = {
  urgente: { texto: 'Urgente', tono: 'error' },
  alta: { texto: 'Alta', tono: 'rojo' },
  media: { texto: 'Media', tono: 'gris' },
  baja: { texto: 'Baja', tono: 'gris' },
};
export const TIPO_TRABAJO = {
  reparacion: 'Reparación', fabricacion: 'Fabricación', mecanizado: 'Mecanizado',
  prototipo: 'Prototipo', diseno: 'Diseño', servicio_planta: 'Servicio en planta',
};
export const ESTADO_OT = {
  planificada: { texto: 'Planificada', tono: 'gris' },
  en_proceso: { texto: 'En proceso', tono: 'negro' },
  pausada: { texto: 'Pausada', tono: 'aviso' },
  control_calidad: { texto: 'Control de calidad', tono: 'rojo' },
  terminada: { texto: 'Terminada', tono: 'exito' },
  entregada: { texto: 'Entregada', tono: 'exito' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};
// Transiciones que el jefe puede hacer a mano (las demás son automáticas o del flujo de tareas).
export const TRANSICIONES_OT = {
  planificada: ['pausada', 'cancelada'],
  en_proceso: ['pausada', 'control_calidad', 'cancelada'],
  pausada: ['en_proceso', 'cancelada'],
  control_calidad: ['en_proceso', 'cancelada'], // la aprueba Calidad con una inspección
  terminada: ['entregada', 'control_calidad'],
  entregada: [],
  cancelada: [],
};
export const ESTADO_TAREA = {
  pendiente: { texto: 'Pendiente', tono: 'gris' },
  en_curso: { texto: 'En curso', tono: 'negro' },
  pausada: { texto: 'Pausada', tono: 'aviso' },
  en_revision: { texto: 'En revisión', tono: 'rojo' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Para rehacer', tono: 'error' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};

/** ISO → '24/10 18:30' en hora local */
export const fechaHoraCorta = (f) => (f ? new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
export const horas = (h) => `${Number(h ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`;

export const ESTADO_MAQUINA = { operativo: 'Operativa', mantenimiento: 'En mantenimiento', fuera_servicio: 'Fuera de servicio' };
export const TIPO_PRODUCTO = {
  materia_prima: 'Materia prima', insumo: 'Insumo', repuesto: 'Repuesto',
  producto_terminado: 'Producto terminado', herramienta: 'Herramienta',
};

export const pesosAr = pesos;
/** 12.5 → '12,5' (cantidades de stock con hasta 3 decimales) */
export const cantidad = (n, unidad) => `${Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })}${unidad ? ` ${unidad}` : ''}`;

export const TIPO_MOVIMIENTO = {
  ingreso_compra: { texto: 'Ingreso por compra', signo: '+' },
  consumo_ot: { texto: 'Consumo en OT', signo: '−' },
  consumo_mantenimiento: { texto: 'Repuesto de mantenimiento', signo: '−' },
  ajuste_positivo: { texto: 'Ajuste (+)', signo: '+' },
  ajuste_negativo: { texto: 'Ajuste (−)', signo: '−' },
  transferencia_salida: { texto: 'Transferencia (sale)', signo: '−' },
  transferencia_entrada: { texto: 'Transferencia (entra)', signo: '+' },
  devolucion: { texto: 'Devolución', signo: '+' },
};
export const ESTADO_OC = {
  borrador: { texto: 'Borrador', tono: 'gris' },
  pendiente_aprobacion: { texto: 'Para aprobar', tono: 'aviso' },
  aprobada: { texto: 'Aprobada', tono: 'negro' },
  enviada: { texto: 'Enviada al proveedor', tono: 'negro' },
  recibida_parcial: { texto: 'Recibida en parte', tono: 'rojo' },
  recibida: { texto: 'Recibida', tono: 'exito' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};
export const ESTADO_OM = {
  abierta: { texto: 'Abierta', tono: 'error' },
  en_curso: { texto: 'En reparación', tono: 'negro' },
  esperando_repuesto: { texto: 'Esperando repuesto', tono: 'aviso' },
  cerrada: { texto: 'Reparada', tono: 'exito' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};

export const ESTADO_SOLICITUD = {
  nueva: { texto: 'Nueva', tono: 'rojo' },
  en_analisis: { texto: 'En análisis', tono: 'aviso' },
  presupuestada: { texto: 'Presupuestada', tono: 'negro' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'error' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
};
export const ESTADO_PRESUPUESTO = {
  borrador: { texto: 'Borrador', tono: 'gris' },
  enviado: { texto: 'Enviado al cliente', tono: 'aviso' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'error' },
  vencido: { texto: 'Vencido', tono: 'gris' },
};
export const TIPO_ITEM = { maquina: 'Máquina', mano_obra: 'Mano de obra', material: 'Material', tercerizado: 'Tercerizado', otro: 'Otro' };
export const RESULTADO_INSPECCION = {
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  aprobada_con_obs: { texto: 'Aprobada con observaciones', tono: 'aviso' },
  rechazada: { texto: 'No conforme', tono: 'error' },
};
export const ESTADO_COMPROBANTE = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  parcial: { texto: 'Pago parcial', tono: 'rojo' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'gris' },
};
export const TIPO_COMPROBANTE = {
  factura_venta: 'Factura de venta', nota_credito_venta: 'Nota de crédito', factura_compra: 'Factura de proveedor', nota_credito_compra: 'Nota de crédito de proveedor',
};

export const MODULOS = [
  {
    codigo: 'PROD', titulo: 'Producción', icono: 'construct-outline',
    descripcion: 'Órdenes de trabajo y máquinas',
    acciones: [
      { titulo: 'Órdenes de trabajo', icono: 'clipboard-outline', ruta: () => '/modulos/produccion' },
      { titulo: 'Nueva orden de trabajo', icono: 'add-circle-outline', ruta: () => '/modulos/produccion/nueva', visible: ({ puede }) => puede('PROD', 'crear') },
    ],
    recursos: [{
      ruta: 'centros-trabajo', titulo: 'Máquinas y centros de trabajo',
      titular: (r) => r.nombre,
      detalle: (r) => [r.codigo, r.area_nombre, [r.marca, r.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
      chips: (r) => [{ texto: ESTADO_MAQUINA[r.estado], tono: r.estado === 'operativo' ? 'exito' : 'aviso' }],
      abrir: (r) => `/modulos/mantenimiento/maquina/${r.id}`,
    }],
  },
  {
    codigo: 'TAR', titulo: 'Tareas', icono: 'checkbox-outline',
    descripcion: 'Asignación y seguimiento',
    acciones: [
      { titulo: 'Mis tareas', icono: 'person-outline', ruta: () => '/tareas', visible: ({ usuario }) => Boolean(usuario.empleadoId) },
      { titulo: 'Tareas del área', icono: 'people-outline', ruta: () => '/modulos/tareas', visible: ({ puede }) => puede('TAR', 'aprobar') },
      { titulo: 'Nueva tarea', icono: 'add-circle-outline', ruta: () => '/modulos/tareas/nueva', visible: ({ puede }) => puede('TAR', 'crear') },
    ],
    recursos: [],
  },
  {
    codigo: 'VEN', titulo: 'Ventas', icono: 'briefcase-outline',
    descripcion: 'Clientes, solicitudes y presupuestos',
    acciones: [
      { titulo: 'Nueva solicitud (con foto)', icono: 'add-circle-outline', ruta: () => '/modulos/ventas/nueva', visible: ({ puede }) => puede('VEN', 'crear') },
      { titulo: 'Solicitudes y presupuestos', icono: 'briefcase-outline', ruta: () => '/modulos/ventas' },
    ],
    recursos: [
      {
        ruta: 'clientes', titulo: 'Clientes',
        titular: (r) => r.razon_social,
        detalle: (r) => [r.cuit, r.localidad, r.contacto].filter(Boolean).join(' · '),
        chips: (r) => [{ texto: r.condicion_iva }, ...(r.activo ? [] : [{ texto: 'Inactivo', tono: 'aviso' }])],
      },
      {
        ruta: 'servicios', titulo: 'Catálogo de servicios',
        titular: (r) => r.nombre,
        detalle: (r) => r.descripcion,
        chips: (r) => [r.tercerizado ? { texto: 'Tercerizado', tono: 'aviso' } : { texto: `${pesos(r.precio_hora_referencia)}/h` }],
      },
    ],
  },
  {
    codigo: 'INV', titulo: 'Inventario', icono: 'cube-outline',
    descripcion: 'Materiales, insumos y stock',
    acciones: [
      { titulo: 'Stock: disponible y reservado', icono: 'cube-outline', ruta: () => '/modulos/inventario' },
      { titulo: 'Escanear un material', icono: 'qr-code-outline', ruta: () => '/modulos/escanear' },
    ],
    recursos: [
      {
        ruta: 'productos', titulo: 'Productos y stock',
        titular: (r) => r.nombre,
        detalle: (r) => `${r.codigo} · ${TIPO_PRODUCTO[r.tipo]} · Stock: ${Number(r.stock_total)} ${r.unidad}`,
        chips: (r) => (Number(r.stock_total) < Number(r.stock_minimo) ? [{ texto: 'Bajo mínimo', tono: 'error' }] : []),
        abrir: (r) => `/modulos/inventario/${r.id}`,
      },
      { ruta: 'depositos', titulo: 'Depósitos', titular: (r) => r.nombre, detalle: (r) => [r.codigo, r.ubicacion].filter(Boolean).join(' · ') },
      { ruta: 'categorias-producto', titulo: 'Categorías', titular: (r) => r.nombre },
    ],
  },
  {
    codigo: 'COM', titulo: 'Compras', icono: 'cart-outline',
    descripcion: 'Proveedores y órdenes de compra',
    acciones: [
      { titulo: 'Órdenes de compra', icono: 'cart-outline', ruta: () => '/modulos/compras' },
      { titulo: 'Nueva orden de compra', icono: 'add-circle-outline', ruta: () => '/modulos/compras/nueva', visible: ({ puede }) => puede('COM', 'crear') },
      { titulo: 'Recibir mercadería (escanear)', icono: 'qr-code-outline', ruta: () => '/modulos/escanear', visible: ({ puede }) => puede('COM', 'editar') },
    ],
    recursos: [{
      ruta: 'proveedores', titulo: 'Proveedores',
      titular: (r) => r.razon_social,
      detalle: (r) => [r.cuit, r.rubro].filter(Boolean).join(' · '),
      chips: (r) => (r.tercerizado ? [{ texto: 'Servicio tercerizado', tono: 'aviso' }] : []),
    }],
  },
  {
    codigo: 'RRHH', titulo: 'Recursos humanos', icono: 'people-outline',
    descripcion: 'Legajos, habilidades, asistencia y licencias',
    // Accesos a pantallas propias del módulo (además de los listados).
    acciones: [
      { titulo: 'Mi legajo', icono: 'id-card-outline', ruta: (u) => `/modulos/rrhh/legajo/${u.empleadoId}`, visible: ({ usuario }) => Boolean(usuario.empleadoId) },
      { titulo: 'Mis licencias y vacaciones', icono: 'airplane-outline', ruta: () => '/modulos/rrhh/licencias', visible: ({ usuario }) => Boolean(usuario.empleadoId) },
      { titulo: 'Aprobar licencias', icono: 'checkmark-done-outline', ruta: () => '/modulos/rrhh/aprobaciones', visible: ({ puede }) => puede('RRHH', 'aprobar') },
    ],
    recursos: [
      {
        ruta: 'empleados', titulo: 'Legajos',
        titular: (r) => `${r.apellido}, ${r.nombre}`,
        detalle: (r) => [r.legajo, r.puesto_nombre ?? r.area_nombre].filter(Boolean).join(' · '),
        chips: (r) => [{ texto: r.area_nombre }, ...(r.estado !== 'activo' ? [{ texto: r.estado === 'baja' ? 'Baja' : 'De licencia', tono: 'aviso' }] : [])],
        abrir: (r) => `/modulos/rrhh/legajo/${r.id}`,
      },
      {
        ruta: 'licencias', titulo: 'Licencias', sinBusqueda: true,
        titular: (r) => `${r.apellido}, ${r.nombre} · ${TIPO_LICENCIA[r.tipo]}`,
        detalle: (r) => `Del ${fechaCorta(r.fecha_desde)} al ${fechaCorta(r.fecha_hasta)} · ${diasHabiles(r.dias)}`,
        chips: (r) => [ESTADO_LICENCIA[r.estado]],
      },
      {
        ruta: 'asistencias', titulo: 'Fichajes', sinBusqueda: true,
        titular: (r) => `${r.apellido}, ${r.nombre}`,
        detalle: (r) => `${fechaCorta(r.fecha)} · ${horaCorta(r.entrada_at)} a ${r.salida_at ? horaCorta(r.salida_at) : '—'} · ${Number(r.horas).toFixed(1)} h`,
        chips: (r) => [...(r.salida_at ? [] : [{ texto: 'Sin salida', tono: 'aviso' }]), ...(r.origen === 'manual' ? [{ texto: 'Corregido' }] : [])],
      },
      {
        ruta: 'habilidades', titulo: 'Habilidades y certificaciones',
        titular: (r) => r.nombre,
        detalle: (r) => r.codigo,
        chips: (r) => (r.requiere_certificacion ? [{ texto: 'Requiere certificación', tono: 'aviso' }] : []),
      },
      {
        ruta: 'epp-entregas', titulo: 'Elementos de protección (EPP)',
        titular: (r) => r.elemento,
        detalle: (r) => `${r.empleado_nombre} · entregado ${fechaCorta(r.fecha_entrega)}${r.talle ? ` · talle ${r.talle}` : ''}`,
        chips: (r) => (r.vencido ? [{ texto: 'Vencido', tono: 'error' }] : []),
      },
    ],
  },
  {
    codigo: 'ORG', titulo: 'Organización', icono: 'git-network-outline',
    descripcion: 'Áreas y puestos',
    acciones: [{ titulo: 'Organigrama', icono: 'git-network-outline', ruta: () => '/modulos/rrhh/organigrama' }],
    recursos: [
      { ruta: 'areas', titulo: 'Áreas', titular: (r) => r.nombre, detalle: (r) => [r.codigo, r.jefe_nombre && `Jefe: ${r.jefe_nombre}`].filter(Boolean).join(' · ') },
      { ruta: 'puestos', titulo: 'Puestos', titular: (r) => r.nombre, detalle: (r) => r.area_nombre },
    ],
  },
  {
    codigo: 'MANT', titulo: 'Mantenimiento', icono: 'build-outline',
    descripcion: 'Fallas de máquinas y preventivos',
    acciones: [
      { titulo: 'Reportar una falla', icono: 'warning-outline', ruta: () => '/modulos/mantenimiento/nueva', visible: ({ puede }) => puede('MANT', 'crear') },
      { titulo: 'Escanear una máquina', icono: 'qr-code-outline', ruta: () => '/modulos/escanear' },
      { titulo: 'Órdenes de mantenimiento', icono: 'build-outline', ruta: () => '/modulos/mantenimiento' },
    ],
    recursos: [{
      ruta: 'planes-mantenimiento', titulo: 'Planes preventivos', sinBusqueda: true,
      titular: (r) => r.nombre,
      detalle: (r) => `${r.centro_codigo} ${r.centro_nombre} · cada ${r.frecuencia_dias} días · próximo ${fechaCorta(r.proxima_fecha)}`,
      chips: (r) => (r.proxima_fecha && r.proxima_fecha <= new Date().toISOString().slice(0, 10) ? [{ texto: 'Vencido', tono: 'error' }] : []),
      abrir: (r) => `/modulos/mantenimiento/maquina/${r.centro_trabajo_id}`,
    }],
  },
  {
    codigo: 'CAL', titulo: 'Calidad', icono: 'ribbon-outline',
    descripcion: 'Inspecciones y no conformidades',
    acciones: [{ titulo: 'Para inspeccionar e inspecciones', icono: 'ribbon-outline', ruta: () => '/modulos/calidad' }],
    recursos: [],
  },
  {
    codigo: 'FIN', titulo: 'Finanzas', icono: 'cash-outline',
    descripcion: 'Facturas, cobros y pagos',
    acciones: [{ titulo: 'Facturas, cobros y pagos', icono: 'cash-outline', ruta: () => '/modulos/finanzas' }],
    recursos: [],
  },
  {
    codigo: 'TAB', titulo: 'Tablero', icono: 'stats-chart-outline',
    descripcion: 'Los números del día',
    acciones: [{ titulo: 'Ver tablero', icono: 'stats-chart-outline', ruta: () => '/modulos/tablero' }],
    recursos: [],
  },
  {
    codigo: 'SEG', titulo: 'Usuarios', icono: 'shield-outline',
    descripcion: 'Cuentas, roles y accesos',
    acciones: [{ titulo: 'Solicitudes de acceso', icono: 'person-add-outline', ruta: () => '/modulos/usuarios/solicitudes', visible: ({ puede }) => puede('SEG', 'aprobar') }],
    recursos: [{
      ruta: 'usuarios', titulo: 'Usuarios',
      titular: (r) => `${r.nombre} ${r.apellido}`,
      detalle: (r) => [r.email, r.area_nombre].filter(Boolean).join(' · '),
      chips: (r) => [
        { texto: ROLES[r.rol] ?? r.rol },
        ...(r.dos_pasos ? [{ texto: '2FA', tono: 'exito' }] : []),
        ...(r.estado_cuenta === 'pendiente' ? [{ texto: 'Pendiente', tono: 'aviso' }] : []),
        ...(r.estado_cuenta === 'rechazada' ? [{ texto: 'Rechazada', tono: 'error' }] : []),
        ...(r.activo ? [] : [{ texto: 'Inactivo', tono: 'error' }]),
      ],
    }],
  },
];

export const ROLES = { ADMIN: 'Administrador', GERENCIA: 'Gerencia', JEFE: 'Jefe de área', EMPLEADO: 'Empleado' };

export function buscarModulo(codigo) {
  return MODULOS.find((m) => m.codigo === codigo);
}

export function buscarRecurso(ruta) {
  for (const m of MODULOS) {
    const r = m.recursos.find((x) => x.ruta === ruta);
    if (r) return { modulo: m, recurso: r };
  }
  return null;
}
