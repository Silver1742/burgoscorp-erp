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
