// Datos de prueba: empleados, usuarios de cada rol, clientes, proveedores y stock inicial.
// Requiere haber ejecutado antes db/schema.sql y db/seed.sql.
//
//   npm run seed
//
// Contraseña de todas las cuentas de prueba: variable SEED_PASSWORD o, si no está,
// la de desarrollo documentada en docs/guia-instalacion.md. No usar en producción.
import bcrypt from 'bcryptjs';
import env from '../src/config/env.js';
import { pool, query, queryOne, transaccion } from '../src/config/db.js';
import { siguienteNumero } from '../src/utils/secuencias.js';

if (env.esProduccion && !process.argv.includes('--forzar')) {
  console.error('No se cargan datos de prueba en producción (usá --forzar si realmente querés hacerlo).');
  process.exit(1);
}

const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';

// legajo, nombre, apellido, área, puesto, rol (null = sin usuario), habilidades [codigo, nivel, vence?], costo/hora
const EMPLEADOS = [
  ['L0001', 'Ricardo', 'Ferreyra', 'DIR', 'Gerente general', 'GERENCIA', [], 25000],
  ['L0002', 'Natalia', 'Quiroga', 'ADM', 'Jefe de administración', 'JEFE', [], 16000],
  ['L0003', 'Pablo', 'Sosa', 'ADM', 'Administrativo contable', 'EMPLEADO', [], 11000],
  ['L0004', 'Carolina', 'Méndez', 'RRHH', 'Jefe de RRHH', 'JEFE', [], 16000],
  ['L0005', 'Lucía', 'Benítez', 'RRHH', 'Técnico en seguridad e higiene', 'EMPLEADO', [['TRABAJO_ALTURA', 'avanzado', '2027-06-30']], 12000],
  ['L0006', 'Diego', 'Acosta', 'COM', 'Jefe comercial', 'JEFE', [], 17000],
  ['L0007', 'Florencia', 'Ríos', 'COM', 'Ejecutivo de cuentas', 'EMPLEADO', [], 11500],
  ['L0008', 'Sebastián', 'Molina', 'ING', 'Jefe de ingeniería', 'JEFE', [['DISENO_CAD', 'avanzado'], ['ING_INVERSA', 'avanzado'], ['PROG_CAM', 'intermedio']], 19000],
  ['L0009', 'Valentina', 'Castro', 'ING', 'Diseñador CAD', 'EMPLEADO', [['DISENO_CAD', 'avanzado'], ['ING_INVERSA', 'intermedio']], 14000],
  ['L0010', 'Tomás', 'Herrera', 'ING', 'Programador CAM', 'EMPLEADO', [['PROG_CAM', 'avanzado'], ['DISENO_CAD', 'intermedio']], 14500],
  ['L0011', 'Jorge', 'Domínguez', 'MEC', 'Jefe de mecanizado', 'JEFE', [['TORNERIA', 'avanzado'], ['TORNO_CNC', 'avanzado'], ['FRESADO_CNC', 'avanzado']], 18000],
  ['L0012', 'Ramón', 'Giménez', 'MEC', 'Tornero', 'EMPLEADO', [['TORNERIA', 'avanzado'], ['TORNO_CNC', 'intermedio']], 13000],
  ['L0013', 'Matías', 'Peralta', 'MEC', 'Operador CNC', 'EMPLEADO', [['FRESADO_CNC', 'avanzado'], ['TORNO_CNC', 'intermedio']], 13500],
  ['L0014', 'Gustavo', 'Luna', 'MEC', 'Operador de corte y plegado', 'EMPLEADO', [['CORTE_PLASMA', 'avanzado'], ['PLEGADO', 'avanzado']], 12000],
  ['L0015', 'Hernán', 'Vega', 'MEC', 'Tornero', null, [['TORNERIA', 'intermedio']], 11500],
  ['L0016', 'Marcelo', 'Ibáñez', 'SOL', 'Jefe de soldadura y herrería', 'JEFE', [['SOLDADURA_MIG', 'avanzado', '2027-03-31'], ['SOLDADURA_TIG', 'avanzado', '2027-03-31'], ['HERRERIA', 'avanzado']], 18000],
  ['L0017', 'Claudio', 'Ortiz', 'SOL', 'Soldador MIG', 'EMPLEADO', [['SOLDADURA_MIG', 'avanzado', '2027-01-31'], ['HERRERIA', 'intermedio'], ['TRABAJO_ALTURA', 'intermedio', '2026-12-15']], 13500],
  ['L0018', 'Walter', 'Medina', 'SOL', 'Soldador MIG', 'EMPLEADO', [['SOLDADURA_MIG', 'intermedio', '2026-10-01']], 12500], // certificación vencida
  ['L0019', 'Néstor', 'Romero', 'SOL', 'Herrero', 'EMPLEADO', [['HERRERIA', 'avanzado'], ['CORTE_PLASMA', 'basico']], 12500],
  ['L0020', 'Federico', 'Suárez', 'SOL', 'Pintor industrial', null, [['PINTURA', 'avanzado']], 11000],
  ['L0021', 'Camila', 'Navarro', 'I3D', 'Jefe de impresión 3D', 'JEFE', [['IMP3D_FDM', 'avanzado'], ['IMP3D_RESINA', 'avanzado'], ['DISENO_CAD', 'intermedio']], 16000],
  ['L0022', 'Julián', 'Cabrera', 'I3D', 'Operador de impresión 3D', 'EMPLEADO', [['IMP3D_FDM', 'avanzado'], ['IMP3D_RESINA', 'intermedio']], 11500],
  ['L0023', 'Agustina', 'Morales', 'I3D', 'Maquetista', 'EMPLEADO', [['MAQUETISMO', 'avanzado'], ['IMP3D_FDM', 'intermedio'], ['PINTURA', 'basico']], 11500],
  ['L0024', 'Silvia', 'Aguirre', 'CAL', 'Jefe de calidad', 'JEFE', [['METROLOGIA', 'avanzado']], 16500],
  ['L0025', 'Leandro', 'Paz', 'CAL', 'Inspector de calidad', 'EMPLEADO', [['METROLOGIA', 'avanzado']], 12500],
  ['L0026', 'Oscar', 'Figueroa', 'MAN', 'Jefe de mantenimiento', 'JEFE', [['MANT_MECANICO', 'avanzado'], ['MANT_ELECTRICO', 'avanzado', '2027-08-31']], 17000],
  ['L0027', 'Daniel', 'Correa', 'MAN', 'Técnico de mantenimiento', 'EMPLEADO', [['MANT_MECANICO', 'avanzado'], ['MANT_ELECTRICO', 'intermedio', '2027-02-28']], 13000],
  ['L0028', 'Mariana', 'Ledesma', 'ABA', 'Jefe de abastecimiento', 'JEFE', [['AUTOELEVADOR', 'intermedio', '2027-05-31']], 16000],
  ['L0029', 'Gabriel', 'Ponce', 'ABA', 'Comprador', 'EMPLEADO', [], 11500],
  ['L0030', 'Rubén', 'Arias', 'ABA', 'Pañolero / depósito', 'EMPLEADO', [['AUTOELEVADOR', 'avanzado', '2027-04-30']], 10500],
];

const CLIENTES = [
  ['Metalúrgica del Plata S.A.', 'RI', 'compras@metalplata.test', 'Avellaneda', 'Buenos Aires', 'Ing. Laura Pérez'],
  ['Agroindustrias San Jorge S.R.L.', 'RI', 'mantenimiento@sanjorge.test', 'Pergamino', 'Buenos Aires', 'Hugo Vidal'],
  ['Envases Patagónicos S.A.', 'RI', 'planta@envasespat.test', 'Neuquén', 'Neuquén', 'Marta Salinas'],
  ['Cervecería Los Andes S.A.', 'RI', 'proyectos@losandes.test', 'Mendoza', 'Mendoza', 'Iván Torres'],
  ['Estudio de Arquitectura Lumen', 'MONOTRIBUTO', 'hola@lumen.test', 'CABA', 'CABA', 'Arq. Sofía Lagos'],
  ['Transportes Ruta 5 S.A.', 'RI', 'taller@ruta5.test', 'Luján', 'Buenos Aires', 'Carlos Maidana'],
  ['Juan Cruz Fernández', 'CF', 'jcfernandez@correo.test', 'Morón', 'Buenos Aires', null],
];

const PROVEEDORES = [
  ['Aceros del Litoral S.A.', 'Aceros y barras', 0],
  ['Chapas y Perfiles Norte S.R.L.', 'Chapas, caños y perfiles', 0],
  ['Gases Industriales Sur S.A.', 'Gases y consumibles de soldadura', 0],
  ['Filamentos Argentinos S.R.L.', 'Filamentos y resinas 3D', 0],
  ['Herramientas Precisión S.A.', 'Herramientas de corte', 0],
  ['Galvanizados Quilmes S.A.', 'Galvanizado en caliente', 1],
  ['Láser Express S.R.L.', 'Corte láser', 1],
];

/** CUIT válido (con dígito verificador) a partir de un prefijo y un número. */
function cuitValido(prefijo, numero) {
  const base = `${prefijo}${String(numero).padStart(8, '0')}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return `${base.slice(0, 2)}-${base.slice(2)}-${dv}`;
}

function emailDe(nombre, apellido) {
  const limpio = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return `${limpio(nombre)}.${limpio(apellido)}@burgoscorp.test`;
}

async function idPor(tabla, columna, valor) {
  const fila = await queryOne(`SELECT id FROM ${tabla} WHERE ${columna} = ?`, [valor]);
  if (!fila) throw new Error(`No existe ${tabla}.${columna} = ${valor}. ¿Corriste db/seed.sql?`);
  return fila.id;
}

const dias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.now() + n * 86400000);

/** Órdenes de trabajo de ejemplo. Las operaciones toman el área de su máquina. */
async function cargarProduccion(conn, ejecutar) {
  const [[{ id: jefeMec }]] = await conn.execute("SELECT u.id FROM usuarios u WHERE u.email = 'jorge.dominguez@burgoscorp.test'");
  const uno = async (sql, p) => (await conn.execute(sql, p))[0][0];
  const idCliente = async (r) => (await uno('SELECT id FROM clientes WHERE razon_social = ?', [r])).id;
  const idArea = async (c) => (await uno('SELECT id FROM areas WHERE codigo = ?', [c])).id;
  const idEmp = async (l) => (await uno('SELECT id FROM empleados WHERE legajo = ?', [l])).id;
  const maquina = async (c) => uno('SELECT id, area_id, habilidad_requerida_id FROM centros_trabajo WHERE codigo = ?', [c]);

  // Una máquina en mantenimiento, para mostrar que no se le asignan operaciones.
  await ejecutar("UPDATE centros_trabajo SET estado = 'mantenimiento' WHERE codigo = 'CNC-02'");

  const ORDENES = [
    {
      cliente: 'Agroindustrias San Jorge S.R.L.', area: 'MEC', responsable: 'L0011', tipo: 'reparacion', prioridad: 'alta',
      titulo: 'Reparación de eje de cosechadora', descripcion: 'Eje de transmisión con desgaste en el asiento de rodamientos. Recuperar o fabricar nuevo según plano.',
      inicio: 0, entrega: 7,
      operaciones: [
        { titulo: 'Relevamiento y plano del eje', maquina: 'DIS-01', horas: 3, asignado: 'L0009', estado: 'aprobada', checklist: ['Medir diámetros', 'Dibujar plano 2D'] },
        { titulo: 'Torneado del eje en SAE 1045', maquina: 'TOR-01', horas: 6, asignado: 'L0012', checklist: ['Cilindrado', 'Roscado M30', 'Control de medidas'] },
        { titulo: 'Fresado de chavetero', maquina: 'CNC-02', horas: 1.5 },
      ],
    },
    {
      cliente: 'Cervecería Los Andes S.A.', area: 'SOL', responsable: 'L0016', tipo: 'fabricacion', prioridad: 'urgente',
      titulo: 'Estructura soporte para tanques fermentadores', descripcion: 'Bastidor en caño estructural 80x40 para 3 tanques de 2000 l, con pintura epoxi.',
      inicio: 1, entrega: 10,
      operaciones: [
        { titulo: 'Corte de perfiles por plasma', maquina: 'COR-01', horas: 4, asignado: 'L0014' },
        { titulo: 'Soldadura MIG del bastidor', maquina: 'SOL-01', horas: 12, asignado: 'L0017', checklist: ['Punteado', 'Cordones completos', 'Limpieza de escoria'] },
        { titulo: 'Pintura epoxi', maquina: 'TER-01', horas: 5 },
      ],
    },
    {
      cliente: 'Estudio de Arquitectura Lumen', area: 'I3D', responsable: 'L0021', tipo: 'prototipo', prioridad: 'media',
      titulo: 'Prototipo de carcasa para sensor', descripcion: 'Dos iteraciones en PETG para prueba de encastre.',
      inicio: 0, entrega: 4,
      operaciones: [
        { titulo: 'Diseño CAD de la carcasa', maquina: 'DIS-02', horas: 4, asignado: 'L0009' },
        { titulo: 'Impresión 3D en PETG', maquina: 'I3D-02', horas: 8, asignado: 'L0022' },
      ],
    },
  ];

  for (const o of ORDENES) {
    const numero = await siguienteNumero(conn, 'OT');
    const [r] = await conn.execute(
      `INSERT INTO ordenes_trabajo (numero, cliente_id, titulo, descripcion, tipo_trabajo, prioridad, fecha_inicio_plan,
         fecha_entrega_plan, area_id, responsable_id, creado_por, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, await idCliente(o.cliente), o.titulo, o.descripcion, o.tipo, o.prioridad, dias(o.inicio), dias(o.entrega),
        await idArea(o.area), await idEmp(o.responsable), jefeMec,
        o.operaciones.some((op) => op.estado) ? 'en_proceso' : 'planificada'],
    );
    for (const [i, op] of o.operaciones.entries()) {
      const m = await maquina(op.maquina);
      const [t] = await conn.execute(
        `INSERT INTO tareas (titulo, area_id, orden_trabajo_id, secuencia, centro_trabajo_id, habilidad_requerida_id,
           prioridad, fecha_limite, horas_estimadas, horas_reales, estado, creado_por, iniciada_at, completada_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [op.titulo, m.area_id, r.insertId, (i + 1) * 10, m.id, m.habilidad_requerida_id, o.prioridad, enDias(o.entrega - 1),
          op.horas, op.estado === 'aprobada' ? op.horas : 0, op.estado ?? 'pendiente', jefeMec,
          op.estado ? enDias(-1) : null, op.estado ? enDias(-1) : null],
      );
      await conn.execute('INSERT INTO tarea_historial (tarea_id, usuario_id, estado_nuevo) VALUES (?, ?, ?)', [t.insertId, jefeMec, 'pendiente']);
      for (const [j, texto] of (op.checklist ?? []).entries()) {
        await conn.execute('INSERT INTO tarea_checklist (tarea_id, texto, orden, hecho) VALUES (?, ?, ?, ?)', [t.insertId, texto, j, op.estado === 'aprobada']);
      }
      if (op.asignado) {
        await conn.execute('INSERT INTO tarea_asignaciones (tarea_id, empleado_id, asignado_por) VALUES (?, ?, ?)', [t.insertId, await idEmp(op.asignado), jefeMec]);
      }
    }
  }
}

/** Reservas de material de las OT, una orden de compra en curso, planes preventivos y una máquina parada. */
async function cargarAbastecimiento(conn) {
  const uno = async (sql, p) => (await conn.execute(sql, p))[0][0];
  const usuario = async (email) => (await uno('SELECT id, empleado_id FROM usuarios WHERE email = ?', [email]));
  const producto = async (c) => uno('SELECT id, nombre, costo_promedio FROM productos WHERE codigo = ?', [c]);
  const ot = async (titulo) => (await uno('SELECT id FROM ordenes_trabajo WHERE titulo = ?', [titulo])).id;
  const maquina = async (c) => (await uno('SELECT id FROM centros_trabajo WHERE codigo = ?', [c])).id;
  const jorge = await usuario('jorge.dominguez@burgoscorp.test');
  const marcelo = await usuario('marcelo.ibanez@burgoscorp.test');
  const gabriel = await usuario('gabriel.ponce@burgoscorp.test');
  const matias = await usuario('matias.peralta@burgoscorp.test');
  const daniel = await usuario('daniel.correa@burgoscorp.test');

  // Material reservado para las OT (el eje de la cosechadora y la estructura de la cervecería).
  const RESERVAS = [
    ['Reparación de eje de cosechadora', 'MP-1045-50', 1.2, jorge],
    ['Estructura soporte para tanques fermentadores', 'MP-CE-80', 6, marcelo],
    ['Estructura soporte para tanques fermentadores', 'IN-MIG-10', 8, marcelo],
    ['Estructura soporte para tanques fermentadores', 'IN-PINT-EPX', 12, marcelo],
  ];
  for (const [titulo, codigo, cantidad, u] of RESERVAS) {
    await conn.execute('INSERT INTO reservas_material (orden_trabajo_id, producto_id, cantidad, creado_por) VALUES (?, ?, ?, ?)',
      [await ot(titulo), (await producto(codigo)).id, cantidad, u.id]);
  }

  // Una compra para reponer lo que está bajo el mínimo, esperando la aprobación de la jefa de Abastecimiento.
  const proveedor = (await uno("SELECT id FROM proveedores WHERE razon_social = 'Aceros del Litoral S.A.'")).id;
  const items = [['MP-1045-25', 30, 9600], ['MP-1045-50', 6, 37500]];
  let subtotal = 0;
  const numero = await siguienteNumero(conn, 'OC');
  const [oc] = await conn.execute(
    `INSERT INTO ordenes_compra (numero, proveedor_id, fecha, fecha_entrega_esperada, estado, solicitado_por, observaciones)
     VALUES (?, ?, ?, ?, 'pendiente_aprobacion', ?, 'Reposición de barras bajo el mínimo')`, [numero, proveedor, dias(0), dias(5), gabriel.id]);
  for (const [codigo, cantidad, precio] of items) {
    const p = await producto(codigo);
    subtotal += cantidad * precio;
    await conn.execute(
      'INSERT INTO orden_compra_items (orden_compra_id, producto_id, descripcion, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
      [oc.insertId, p.id, p.nombre, cantidad, precio, cantidad * precio]);
  }
  await conn.execute('UPDATE ordenes_compra SET subtotal = ?, iva_monto = ?, total = ? WHERE id = ?',
    [subtotal, subtotal * 0.21, subtotal * 1.21, oc.insertId]);

  // Planes preventivos (uno vencido para que aparezca el aviso).
  const PLANES = [
    ['CNC-01', 'Lubricación de guías y husillo', 30, -2],
    ['TOR-01', 'Cambio de aceite de la caja', 180, 20],
    ['I3D-01', 'Limpieza y cambio de boquilla', 15, 3],
    ['PLE-01', 'Revisión del circuito hidráulico', 90, 40],
    ['SOL-01', 'Limpieza de torcha y rodillos de arrastre', 30, 10],
  ];
  for (const [codigo, nombre, frecuencia, proxima] of PLANES) {
    await conn.execute('INSERT INTO planes_mantenimiento (centro_trabajo_id, nombre, frecuencia_dias, proxima_fecha) VALUES (?, ?, ?, ?)',
      [await maquina(codigo), nombre, frecuencia, dias(proxima)]);
  }

  // El router CNC está parado: falla reportada por el operador, esperando el repuesto.
  await conn.execute(
    `INSERT INTO ordenes_mantenimiento (numero, centro_trabajo_id, tipo, descripcion, prioridad, estado, detiene_maquina, reportado_por, responsable_id)
     VALUES (?, ?, 'correctivo', 'Se cortó la correa de transmisión: el eje Y no avanza.', 'alta', 'esperando_repuesto', 1, ?, ?)`,
    [await siguienteNumero(conn, 'OM'), await maquina('CNC-02'), matias.id, daniel.empleado_id]);
}

async function main() {
  if (await queryOne("SELECT id FROM usuarios WHERE email = 'admin@burgoscorp.test'")) {
    console.log('Los datos de prueba ya estaban cargados. Para empezar de cero, volvé a correr schema.sql y seed.sql.');
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 12);

  await transaccion(async (conn) => {
    const ejecutar = (sql, params) => conn.execute(sql, params).then(([r]) => r);

    // Administrador sin legajo
    const { insertId: adminId } = await ejecutar(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, email_verificado_at)
       VALUES ('admin@burgoscorp.test', ?, 'Administrador', 'Sistema', (SELECT id FROM roles WHERE codigo = 'ADMIN'), UTC_TIMESTAMP())`,
      [hash],
    );

    const idsEmpleados = {};
    const jefes = {};
    let dni = 28100200;
    for (const [legajo, nombre, apellido, area, puesto, rol, habilidades, costo] of EMPLEADOS) {
      dni += 137311;
      const areaId = await idPor('areas', 'codigo', area);
      const puestoId = (await queryOne('SELECT id FROM puestos WHERE area_id = ? AND nombre = ?', [areaId, puesto]))?.id ?? null;
      const r = await ejecutar(
        `INSERT INTO empleados (legajo, nombre, apellido, dni, cuil, email_laboral, area_id, puesto_id,
                                fecha_ingreso, costo_hora)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [legajo, nombre, apellido, String(dni), cuitValido('20', dni), emailDe(nombre, apellido), areaId, puestoId,
          `20${String(15 + (dni % 10)).padStart(2, '0')}-0${1 + (dni % 9)}-15`, costo],
      );
      idsEmpleados[legajo] = r.insertId;
      if (rol === 'JEFE' || rol === 'GERENCIA') jefes[area] = r.insertId;

      for (const [codigo, nivel, vence = null] of habilidades) {
        await ejecutar(
          'INSERT INTO empleado_habilidades (empleado_id, habilidad_id, nivel, certificado_vence) VALUES (?, ?, ?, ?)',
          [r.insertId, await idPor('habilidades', 'codigo', codigo), nivel, vence],
        );
      }

      if (rol) {
        await ejecutar(
          `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, empleado_id, email_verificado_at)
           VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, UTC_TIMESTAMP())`,
          [emailDe(nombre, apellido), hash, nombre, apellido, rol, r.insertId],
        );
      }
    }

    // Jefes de cada área y supervisor directo de cada empleado
    for (const [area, jefeId] of Object.entries(jefes)) {
      await ejecutar('UPDATE areas SET jefe_empleado_id = ? WHERE codigo = ?', [jefeId, area]);
      await ejecutar(
        'UPDATE empleados SET supervisor_id = ? WHERE area_id = (SELECT id FROM areas WHERE codigo = ?) AND id <> ?',
        [jefeId, area, jefeId],
      );
    }
    // Los jefes reportan al gerente general
    await ejecutar(
      `UPDATE empleados SET supervisor_id = ? WHERE id IN (SELECT jefe_empleado_id FROM areas WHERE codigo <> 'DIR') `,
      [jefes.DIR],
    );

    let n = 30500100;
    for (const [razon, iva, mail, localidad, provincia, contacto] of CLIENTES) {
      n += 7919;
      await ejecutar(
        `INSERT INTO clientes (razon_social, cuit, condicion_iva, email, localidad, provincia, contacto)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [razon, iva === 'CF' ? null : cuitValido(iva === 'RI' ? '30' : '27', n), iva, mail, localidad, provincia, contacto],
      );
    }
    for (const [razon, rubro, tercerizado] of PROVEEDORES) {
      n += 6151;
      await ejecutar(
        'INSERT INTO proveedores (razon_social, cuit, condicion_iva, rubro, tercerizado) VALUES (?, ?, \'RI\', ?, ?)',
        [razon, cuitValido('30', n), rubro, tercerizado],
      );
    }

    // Stock inicial: cada ingreso queda como movimiento de ajuste para que haya trazabilidad.
    const productos = await query('SELECT id, codigo, tipo, stock_minimo, costo_promedio FROM productos');
    const depositos = Object.fromEntries((await query('SELECT id, codigo FROM depositos')).map((d) => [d.codigo, d.id]));
    for (const [i, p] of productos.entries()) {
      const deposito = p.tipo === 'materia_prima' ? depositos['DEP-MP'] : depositos['DEP-PAN'];
      // Algunos productos quedan por debajo del mínimo para que aparezcan las alertas.
      const cantidad = i % 6 === 0 ? Math.max(1, Math.floor(p.stock_minimo / 2)) : Math.ceil(p.stock_minimo * 2.5);
      await ejecutar('INSERT INTO stock (producto_id, deposito_id, cantidad) VALUES (?, ?, ?)', [p.id, deposito, cantidad]);
      await ejecutar(
        `INSERT INTO movimientos_stock (producto_id, deposito_id, tipo, cantidad, costo_unitario, ref_tipo, usuario_id, observacion)
         VALUES (?, ?, 'ajuste_positivo', ?, ?, 'ajuste', ?, 'Inventario inicial')`,
        [p.id, deposito, cantidad, p.costo_promedio, adminId],
      );
    }

    // Producción: tres órdenes de trabajo con operaciones, máquinas y personas asignadas.
    await cargarProduccion(conn, ejecutar);

    // Abastecimiento y Mantenimiento: reservas, una compra en curso, planes preventivos y una falla.
    await cargarAbastecimiento(conn);
  });

  const usuarios = await query(`
    SELECT u.email, r.codigo AS rol, a.codigo AS area FROM usuarios u
    JOIN roles r ON r.id = u.rol_id LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN areas a ON a.id = e.area_id
    ORDER BY FIELD(r.codigo, 'ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO'), a.codigo`);
  console.log(`Datos de prueba cargados: ${EMPLEADOS.length} empleados, ${usuarios.length} usuarios, ${CLIENTES.length} clientes, ${PROVEEDORES.length} proveedores.`);
  console.table(usuarios);
  console.log(process.env.SEED_PASSWORD
    ? 'Contraseña de las cuentas: la definida en SEED_PASSWORD.'
    : 'Contraseña de las cuentas: la de desarrollo (ver docs/guia-instalacion.md).');
}

main()
  .catch((err) => {
    console.error('Error cargando datos de prueba:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
