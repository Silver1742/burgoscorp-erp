// Nombres para mostrar de los campos de la API. Se usan para que un error de validación diga
// dónde está ("Revisá Vence: Fecha inválida") en vez de un "Datos inválidos" genérico.

const ETIQUETAS = {
  titulo: 'Título', descripcion: 'Descripción', nombre: 'Nombre', apellido: 'Apellido', email: 'Email',
  email_laboral: 'Email laboral', password: 'Contraseña', actual: 'Contraseña actual', nueva: 'Contraseña nueva',
  telefono: 'Teléfono', direccion: 'Dirección', localidad: 'Localidad', provincia: 'Provincia', dni: 'DNI',
  cuit: 'CUIT', cuil: 'CUIL', razon_social: 'Razón social', condicion_iva: 'Condición frente al IVA', contacto: 'Contacto',
  rol: 'Rol', area_id: 'Área', area_ids: 'Áreas', puesto_id: 'Puesto', empleado_id: 'Persona', supervisor_id: 'Supervisor',
  jefe_empleado_id: 'Jefe', responsable_id: 'Responsable', habilidades: 'Habilidades', habilidad_requerida_id: 'Habilidad requerida',
  nivel: 'Nivel', certificado_vence: 'Vencimiento del certificado', centro_trabajo_id: 'Máquina', prioridad: 'Prioridad',
  fecha: 'Fecha', fecha_limite: 'Vence', fecha_desde: 'Desde', fecha_hasta: 'Hasta', desde: 'Desde', hasta: 'Hasta',
  fecha_ingreso: 'Fecha de ingreso', fecha_egreso: 'Fecha de egreso', fecha_nacimiento: 'Fecha de nacimiento',
  fecha_entrega: 'Fecha de entrega', fecha_entrega_esperada: 'Entrega esperada', fecha_entrega_plan: 'Entrega planificada',
  fecha_inicio_plan: 'Inicio planificado', fecha_requerida: 'Fecha requerida', fecha_vencimiento: 'Vencimiento',
  proxima_fecha: 'Próxima fecha', horas_estimadas: 'Horas estimadas', checklist: 'Lista de control', cliente_id: 'Cliente',
  proveedor_id: 'Proveedor', producto_id: 'Producto', deposito_id: 'Depósito', desde_deposito_id: 'Depósito de origen',
  hacia_deposito_id: 'Depósito de destino', orden_trabajo_id: 'Orden de trabajo', orden_compra_id: 'Orden de compra',
  cantidad: 'Cantidad', cantidad_inspeccionada: 'Cantidad inspeccionada', cantidad_rechazada: 'Cantidad rechazada',
  precio_unitario: 'Precio unitario', precio_venta: 'Precio de venta', precio_hora_referencia: 'Precio por hora',
  costo: 'Costo', costo_hora: 'Costo por hora', monto: 'Monto', iva_alicuota: 'IVA', items: 'Ítems', mediciones: 'Mediciones',
  valor_medido: 'Valor medido', valor_nominal: 'Valor nominal', tolerancia_mas: 'Tolerancia +', tolerancia_menos: 'Tolerancia −',
  caracteristica: 'Característica', resultado: 'Resultado', motivo: 'Motivo', observacion: 'Observación',
  observaciones: 'Observaciones', comentario: 'Comentario', texto: 'Texto', solucion: 'Solución', tipo: 'Tipo',
  categoria_id: 'Categoría', unidad: 'Unidad', stock_minimo: 'Stock mínimo', codigo: 'Código', marca: 'Marca',
  modelo: 'Modelo', nro_serie: 'N.º de serie', ubicacion: 'Ubicación', frecuencia_dias: 'Cada cuántos días',
  validez_dias: 'Validez (días)', plazo_entrega_dias: 'Plazo de entrega (días)', remito: 'Remito', numero: 'Número',
  punto_venta: 'Punto de venta', letra: 'Letra', medio: 'Medio de pago', referencia: 'Referencia', rubro: 'Rubro',
  hora_entrada: 'Hora de entrada', tolerancia_min: 'Tolerancia', horas_diarias: 'Horas por día',
  recargo_extra_habil: 'Recargo día hábil', recargo_extra_finde: 'Recargo fin de semana', codigo_2fa: 'Código', code: 'Código',
};

// Listas con elementos numerados: "items.0.cantidad" → "Ítem 1 · Cantidad".
const ELEMENTO = { items: 'Ítem', mediciones: 'Medición', habilidades: 'Habilidad', checklist: 'Paso', area_ids: 'Área' };

const humanizar = (c) => {
  const s = c.replace(/_id$/, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "body.items.0.cantidad" → "Ítem 1 · Cantidad". */
export function etiquetaCampo(ruta) {
  const partes = String(ruta).replace(/^(body|query|params)\./, '').split('.');
  const nombres = [];
  for (let i = 0; i < partes.length; i += 1) {
    const p = partes[i];
    if (/^\d+$/.test(p)) continue;
    if (/^\d+$/.test(partes[i + 1] ?? '') && ELEMENTO[p]) nombres.push(`${ELEMENTO[p]} ${Number(partes[i + 1]) + 1}`);
    else nombres.push(ETIQUETAS[p] ?? humanizar(p));
  }
  return nombres.join(' · ') || 'Datos';
}

/** Mensaje para el aviso: el primer error con su campo y cuántos más hay. */
export function describirErrores(detalles) {
  const lista = (detalles ?? []).filter((d) => d?.mensaje);
  if (!lista.length) return null;
  const [d] = lista;
  const primero = d.campo ? `${etiquetaCampo(d.campo)}: ${d.mensaje}` : d.mensaje;
  const resto = lista.length - 1;
  return `Revisá ${primero}${resto ? ` (y ${resto} ${resto === 1 ? 'dato más' : 'datos más'})` : ''}`;
}
