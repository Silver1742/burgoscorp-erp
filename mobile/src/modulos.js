// Catálogo de módulos del ERP y de los recursos que muestra cada uno.
// La app solo muestra los módulos con permiso "ver" (según /auth/yo); la API valida igual.

const pesos = (n) => (n == null ? '—' : `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`);

const ESTADO_MAQUINA = { operativo: 'Operativa', mantenimiento: 'En mantenimiento', fuera_servicio: 'Fuera de servicio' };
const TIPO_PRODUCTO = {
  materia_prima: 'Materia prima', insumo: 'Insumo', repuesto: 'Repuesto',
  producto_terminado: 'Producto terminado', herramienta: 'Herramienta',
};

export const MODULOS = [
  {
    codigo: 'PROD', titulo: 'Producción', icono: 'construct-outline',
    descripcion: 'Órdenes de trabajo y máquinas',
    recursos: [{
      ruta: 'centros-trabajo', titulo: 'Máquinas y centros de trabajo',
      titular: (r) => r.nombre,
      detalle: (r) => [r.codigo, r.area_nombre, [r.marca, r.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
      chips: (r) => [{ texto: ESTADO_MAQUINA[r.estado], tono: r.estado === 'operativo' ? 'exito' : 'aviso' }],
    }],
  },
  {
    codigo: 'TAR', titulo: 'Tareas y proyectos', icono: 'checkbox-outline',
    descripcion: 'Asignación y seguimiento', recursos: [],
  },
  {
    codigo: 'VEN', titulo: 'Ventas', icono: 'briefcase-outline',
    descripcion: 'Clientes, solicitudes y presupuestos',
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
    recursos: [
      {
        ruta: 'productos', titulo: 'Productos y stock',
        titular: (r) => r.nombre,
        detalle: (r) => `${r.codigo} · ${TIPO_PRODUCTO[r.tipo]} · Stock: ${Number(r.stock_total)} ${r.unidad}`,
        chips: (r) => (Number(r.stock_total) < Number(r.stock_minimo) ? [{ texto: 'Bajo mínimo', tono: 'error' }] : []),
      },
      { ruta: 'depositos', titulo: 'Depósitos', titular: (r) => r.nombre, detalle: (r) => [r.codigo, r.ubicacion].filter(Boolean).join(' · ') },
      { ruta: 'categorias-producto', titulo: 'Categorías', titular: (r) => r.nombre },
    ],
  },
  {
    codigo: 'COM', titulo: 'Compras', icono: 'cart-outline',
    descripcion: 'Proveedores y órdenes de compra',
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
    recursos: [{
      ruta: 'habilidades', titulo: 'Habilidades y certificaciones',
      titular: (r) => r.nombre,
      detalle: (r) => r.codigo,
      chips: (r) => (r.requiere_certificacion ? [{ texto: 'Requiere certificación', tono: 'aviso' }] : []),
    }],
  },
  {
    codigo: 'ORG', titulo: 'Organización', icono: 'git-network-outline',
    descripcion: 'Áreas y puestos',
    recursos: [
      { ruta: 'areas', titulo: 'Áreas', titular: (r) => r.nombre, detalle: (r) => [r.codigo, r.jefe_nombre && `Jefe: ${r.jefe_nombre}`].filter(Boolean).join(' · ') },
      { ruta: 'puestos', titulo: 'Puestos', titular: (r) => r.nombre, detalle: (r) => r.area_nombre },
    ],
  },
  { codigo: 'MANT', titulo: 'Mantenimiento', icono: 'build-outline', descripcion: 'Preventivo y correctivo de máquinas', recursos: [] },
  { codigo: 'CAL', titulo: 'Calidad', icono: 'ribbon-outline', descripcion: 'Inspecciones y mediciones', recursos: [] },
  { codigo: 'FIN', titulo: 'Finanzas', icono: 'cash-outline', descripcion: 'Facturas, cobros y pagos', recursos: [] },
  {
    codigo: 'SEG', titulo: 'Usuarios', icono: 'shield-outline',
    descripcion: 'Cuentas, roles y accesos',
    recursos: [{
      ruta: 'usuarios', titulo: 'Usuarios',
      titular: (r) => `${r.nombre} ${r.apellido}`,
      detalle: (r) => [r.email, r.area_nombre].filter(Boolean).join(' · '),
      chips: (r) => [
        { texto: ROLES[r.rol] ?? r.rol },
        ...(r.dos_pasos ? [{ texto: '2FA', tono: 'exito' }] : []),
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
