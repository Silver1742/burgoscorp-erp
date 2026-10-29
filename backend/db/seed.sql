-- =====================================================================
-- BurgosCorp ERP · Datos base (catálogos)
-- Ejecutar después de schema.sql.
-- Los usuarios, empleados, stock inicial y movimientos de prueba los carga
-- el script de Node (`npm run seed`), porque las contraseñas se hashean con bcrypt.
-- =====================================================================

SET NAMES utf8mb4;
USE burgoscorp_erp;

-- ---------------------------------------------------------------------
-- Roles y módulos
-- ---------------------------------------------------------------------
INSERT INTO roles (codigo, nombre, descripcion) VALUES
  ('ADMIN',    'Administrador', 'Acceso total: usuarios, roles, configuración y auditoría'),
  ('GERENCIA', 'Gerencia',      'Solo lectura de todos los módulos y tableros'),
  ('JEFE',     'Jefe de área',  'Gestiona su área: asigna tareas, aprueba y administra los módulos de su área'),
  ('EMPLEADO', 'Empleado',      'Sus tareas, fichaje, solicitudes y la carga de datos de su área');

INSERT INTO modulos (codigo, nombre) VALUES
  ('SEG',  'Usuarios y seguridad'),
  ('ORG',  'Organización'),
  ('RRHH', 'Recursos humanos'),
  ('VEN',  'Ventas y presupuestos'),
  ('PROD', 'Producción'),
  ('TAR',  'Tareas y proyectos'),
  ('INV',  'Inventario'),
  ('COM',  'Compras'),
  ('MANT', 'Mantenimiento'),
  ('CAL',  'Calidad'),
  ('FIN',  'Finanzas'),
  ('TAB',  'Tablero');

-- ---------------------------------------------------------------------
-- Matriz de permisos
-- columnas: rol, módulo, ver, crear, editar, borrar, aprobar, alcance, requiere_area_duenia
-- ---------------------------------------------------------------------
CREATE TEMPORARY TABLE tmp_permisos (
  rol VARCHAR(20), modulo VARCHAR(10),
  v BOOLEAN, c BOOLEAN, e BOOLEAN, b BOOLEAN, a BOOLEAN,
  alcance VARCHAR(10), duenia VARCHAR(10),
  PRIMARY KEY (rol, modulo) -- MySQL con sql_require_primary_key (Aiven) lo exige
);

INSERT INTO tmp_permisos VALUES
  -- Gerencia: ve todo, no modifica nada
  ('GERENCIA','SEG', 0,0,0,0,0,'todo','no'),
  ('GERENCIA','ORG', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','RRHH',1,0,0,0,0,'todo','no'),
  ('GERENCIA','VEN', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','PROD',1,0,0,0,0,'todo','no'),
  ('GERENCIA','TAR', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','INV', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','COM', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','MANT',1,0,0,0,0,'todo','no'),
  ('GERENCIA','CAL', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','FIN', 1,0,0,0,0,'todo','no'),
  ('GERENCIA','TAB', 1,0,0,0,0,'todo','no'),

  -- Jefe de área
  ('JEFE','SEG', 0,0,0,0,0,'propio','no'),
  ('JEFE','ORG', 1,1,1,0,0,'todo',  'escritura'),  -- edita la estructura solo RRHH
  ('JEFE','RRHH',1,1,1,0,1,'area',  'no'),         -- aprueba licencias de su equipo
  ('JEFE','VEN', 1,1,1,1,1,'todo',  'escritura'),  -- todos los jefes consultan clientes; editan Comercial e Ingeniería
  ('JEFE','PROD',1,1,1,1,1,'area',  'escritura'),
  ('JEFE','TAR', 1,1,1,1,1,'area',  'no'),         -- crea y asigna tareas a su equipo
  ('JEFE','INV', 1,1,1,1,1,'todo',  'escritura'),
  ('JEFE','COM', 1,1,1,1,1,'todo',  'escritura'),
  ('JEFE','MANT',1,1,1,0,1,'area',  'no'),         -- cualquier jefe reporta fallas de sus máquinas
  ('JEFE','CAL', 1,1,1,0,1,'todo',  'escritura'),
  ('JEFE','FIN', 1,1,1,1,1,'todo',  'todo'),
  ('JEFE','TAB', 1,0,0,0,0,'area',  'no'),

  -- Empleado
  ('EMPLEADO','SEG', 0,0,0,0,0,'propio','no'),
  ('EMPLEADO','ORG', 1,0,0,0,0,'todo',  'no'),
  ('EMPLEADO','RRHH',1,1,1,0,0,'propio','no'),     -- fichaje, licencias, su legajo
  ('EMPLEADO','VEN', 1,1,1,0,0,'todo',  'todo'),
  ('EMPLEADO','PROD',1,0,0,0,0,'area',  'no'),
  ('EMPLEADO','TAR', 1,0,1,0,0,'propio','no'),     -- avanza sus tareas, carga horas y comentarios
  ('EMPLEADO','INV', 1,1,1,0,0,'todo',  'escritura'),
  ('EMPLEADO','COM', 1,1,1,0,0,'todo',  'todo'),
  ('EMPLEADO','MANT',1,1,1,0,0,'propio','no'),     -- reporta fallas
  ('EMPLEADO','CAL', 1,1,1,0,0,'area',  'escritura'),
  ('EMPLEADO','FIN', 1,1,1,0,0,'todo',  'todo'),
  ('EMPLEADO','TAB', 1,0,0,0,0,'propio','no');

-- Admin: todo en todos los módulos
INSERT INTO permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar,
                          puede_borrar, puede_aprobar, alcance, requiere_area_duenia)
SELECT r.id, m.id, 1, 1, 1, 1, 1, 'todo', 'no'
FROM roles r CROSS JOIN modulos m
WHERE r.codigo = 'ADMIN';

INSERT INTO permisos_rol (rol_id, modulo_id, puede_ver, puede_crear, puede_editar,
                          puede_borrar, puede_aprobar, alcance, requiere_area_duenia)
SELECT r.id, m.id, t.v, t.c, t.e, t.b, t.a, t.alcance, t.duenia
FROM tmp_permisos t
JOIN roles r   ON r.codigo = t.rol
JOIN modulos m ON m.codigo = t.modulo;

DROP TEMPORARY TABLE tmp_permisos;

-- ---------------------------------------------------------------------
-- Áreas, módulos que administran y puestos
-- ---------------------------------------------------------------------
INSERT INTO areas (codigo, nombre, descripcion) VALUES
  ('DIR',  'Dirección',                 'Gerencia general'),
  ('ADM',  'Administración y Finanzas', 'Facturación, cobranzas, pagos y sistemas'),
  ('RRHH', 'Recursos Humanos',          'Personal, asistencia, licencias, seguridad e higiene'),
  ('COM',  'Comercial',                 'Atención de clientes, solicitudes y presupuestos'),
  ('ING',  'Ingeniería y Diseño',       'Diseño CAD, ingeniería inversa, planificación de OT'),
  ('MEC',  'Mecanizado',                'Torneado, fresado CNC, corte y plegado'),
  ('SOL',  'Soldadura y Herrería',      'Soldadura MIG/TIG, herrería, estructuras, servicio en planta'),
  ('I3D',  'Impresión 3D y Prototipos', 'Impresión FDM y resina, prototipos y maquetas'),
  ('CAL',  'Calidad',                   'Control dimensional e inspección final'),
  ('MAN',  'Mantenimiento',             'Mantenimiento preventivo y correctivo de máquinas'),
  ('ABA',  'Abastecimiento',            'Compras, proveedores y depósito');

INSERT INTO area_modulos (area_id, modulo_id)
SELECT a.id, m.id FROM areas a JOIN modulos m ON
     (a.codigo = 'DIR'  AND m.codigo IN ('TAB'))
  OR (a.codigo = 'ADM'  AND m.codigo IN ('FIN'))
  OR (a.codigo = 'RRHH' AND m.codigo IN ('RRHH','ORG'))
  OR (a.codigo = 'COM'  AND m.codigo IN ('VEN'))
  OR (a.codigo = 'ING'  AND m.codigo IN ('VEN','PROD'))
  OR (a.codigo IN ('MEC','SOL','I3D') AND m.codigo IN ('PROD'))
  OR (a.codigo = 'CAL'  AND m.codigo IN ('CAL'))
  OR (a.codigo = 'MAN'  AND m.codigo IN ('MANT'))
  OR (a.codigo = 'ABA'  AND m.codigo IN ('COM','INV'));

INSERT INTO puestos (area_id, nombre)
SELECT a.id, p.nombre FROM areas a JOIN (
            SELECT 'DIR'  AS area, 'Gerente general'           AS nombre
  UNION ALL SELECT 'ADM',  'Jefe de administración'
  UNION ALL SELECT 'ADM',  'Administrativo contable'
  UNION ALL SELECT 'RRHH', 'Jefe de RRHH'
  UNION ALL SELECT 'RRHH', 'Analista de RRHH'
  UNION ALL SELECT 'RRHH', 'Técnico en seguridad e higiene'
  UNION ALL SELECT 'COM',  'Jefe comercial'
  UNION ALL SELECT 'COM',  'Ejecutivo de cuentas'
  UNION ALL SELECT 'ING',  'Jefe de ingeniería'
  UNION ALL SELECT 'ING',  'Diseñador CAD'
  UNION ALL SELECT 'ING',  'Programador CAM'
  UNION ALL SELECT 'MEC',  'Jefe de mecanizado'
  UNION ALL SELECT 'MEC',  'Tornero'
  UNION ALL SELECT 'MEC',  'Operador CNC'
  UNION ALL SELECT 'MEC',  'Operador de corte y plegado'
  UNION ALL SELECT 'SOL',  'Jefe de soldadura y herrería'
  UNION ALL SELECT 'SOL',  'Soldador MIG'
  UNION ALL SELECT 'SOL',  'Herrero'
  UNION ALL SELECT 'SOL',  'Pintor industrial'
  UNION ALL SELECT 'I3D',  'Jefe de impresión 3D'
  UNION ALL SELECT 'I3D',  'Operador de impresión 3D'
  UNION ALL SELECT 'I3D',  'Maquetista'
  UNION ALL SELECT 'CAL',  'Jefe de calidad'
  UNION ALL SELECT 'CAL',  'Inspector de calidad'
  UNION ALL SELECT 'MAN',  'Jefe de mantenimiento'
  UNION ALL SELECT 'MAN',  'Técnico de mantenimiento'
  UNION ALL SELECT 'ABA',  'Jefe de abastecimiento'
  UNION ALL SELECT 'ABA',  'Comprador'
  UNION ALL SELECT 'ABA',  'Pañolero / depósito'
) p ON p.area = a.codigo;

-- ---------------------------------------------------------------------
-- Habilidades
-- ---------------------------------------------------------------------
INSERT INTO habilidades (codigo, nombre, requiere_certificacion) VALUES
  ('DISENO_CAD',     'Diseño CAD 2D/3D',                   0),
  ('ING_INVERSA',    'Ingeniería inversa y relevamiento',  0),
  ('PROG_CAM',       'Programación CAM / CNC',             0),
  ('IMP3D_FDM',      'Impresión 3D FDM',                   0),
  ('IMP3D_RESINA',   'Impresión 3D en resina',             0),
  ('MAQUETISMO',     'Maquetismo y terminación de prototipos', 0),
  ('TORNERIA',       'Tornería convencional',              0),
  ('TORNO_CNC',      'Operación de torno CNC',             0),
  ('FRESADO_CNC',    'Operación de centro de mecanizado CNC', 0),
  ('SOLDADURA_MIG',  'Soldadura MIG/MAG',                  1),
  ('SOLDADURA_TIG',  'Soldadura TIG',                      1),
  ('HERRERIA',       'Herrería y estructuras',             0),
  ('CORTE_PLASMA',   'Corte por plasma CNC',               0),
  ('PLEGADO',        'Plegado de chapa',                   0),
  ('PINTURA',        'Pintura industrial',                 0),
  ('METROLOGIA',     'Metrología e inspección dimensional', 0),
  ('MANT_MECANICO',  'Mantenimiento mecánico',             0),
  ('MANT_ELECTRICO', 'Mantenimiento eléctrico',            1),
  ('AUTOELEVADOR',   'Manejo de autoelevador',             1),
  ('TRABAJO_ALTURA', 'Trabajo en altura',                  1);

-- ---------------------------------------------------------------------
-- Centros de trabajo (máquinas y puestos)
-- ---------------------------------------------------------------------
INSERT INTO centros_trabajo (codigo, nombre, tipo, area_id, habilidad_requerida_id, costo_hora, marca, modelo, ubicacion)
SELECT c.codigo, c.nombre, c.tipo, a.id, h.id, c.costo, c.marca, c.modelo, c.ubicacion
FROM (
            SELECT 'DIS-01' AS codigo, 'Estación de diseño CAD 1' AS nombre, 'diseno' AS tipo, 'ING' AS area, 'DISENO_CAD' AS hab, 18000 AS costo, NULL AS marca, NULL AS modelo, 'Oficina técnica' AS ubicacion
  UNION ALL SELECT 'DIS-02', 'Estación de diseño CAD 2',        'diseno',          'ING', 'DISENO_CAD',    18000, NULL,        NULL,          'Oficina técnica'
  UNION ALL SELECT 'I3D-01', 'Impresora FDM gran formato',      'impresion_3d',    'I3D', 'IMP3D_FDM',     9000,  'Creality',  'K1 Max',      'Sala 3D'
  UNION ALL SELECT 'I3D-02', 'Impresora FDM multimaterial',     'impresion_3d',    'I3D', 'IMP3D_FDM',     9500,  'Prusa',     'MK4 + MMU3',  'Sala 3D'
  UNION ALL SELECT 'I3D-03', 'Impresora de resina',             'impresion_3d',    'I3D', 'IMP3D_RESINA',  11000, 'Elegoo',    'Saturn 4',    'Sala 3D'
  UNION ALL SELECT 'TOR-01', 'Torno paralelo 1500 mm',          'torno',           'MEC', 'TORNERIA',      22000, 'Tornos SR', 'TP-1500',     'Nave 1'
  UNION ALL SELECT 'TOR-02', 'Torno CNC',                       'torno',           'MEC', 'TORNO_CNC',     35000, 'Haas',      'ST-10',       'Nave 1'
  UNION ALL SELECT 'CNC-01', 'Centro de mecanizado vertical',   'cnc',             'MEC', 'FRESADO_CNC',   45000, 'Haas',      'VF-2',        'Nave 1'
  UNION ALL SELECT 'CNC-02', 'Router CNC 1300x2500',            'cnc',             'MEC', 'FRESADO_CNC',   25000, NULL,        'R-1325',      'Nave 1'
  UNION ALL SELECT 'COR-01', 'Mesa de corte por plasma CNC',    'corte',           'MEC', 'CORTE_PLASMA',  28000, 'Hypertherm','Powermax 65', 'Nave 2'
  UNION ALL SELECT 'PLE-01', 'Plegadora hidráulica 3 m',        'plegado',         'MEC', 'PLEGADO',       24000, NULL,        'PH-3100',     'Nave 2'
  UNION ALL SELECT 'SOL-01', 'Soldadora MIG 250 A',             'soldadura_mig',   'SOL', 'SOLDADURA_MIG', 16000, 'Lincoln',   'Power MIG 256','Nave 2'
  UNION ALL SELECT 'SOL-02', 'Soldadora MIG 350 A',             'soldadura_mig',   'SOL', 'SOLDADURA_MIG', 19000, 'ESAB',      'Rebel 350',   'Nave 2'
  UNION ALL SELECT 'SOL-03', 'Soldadora TIG AC/DC',             'soldadura_tig',   'SOL', 'SOLDADURA_TIG', 20000, 'Miller',    'Dynasty 210', 'Nave 2'
  UNION ALL SELECT 'HER-01', 'Banco de herrería',               'herreria',        'SOL', 'HERRERIA',      12000, NULL,        NULL,          'Nave 2'
  UNION ALL SELECT 'TER-01', 'Cabina de pintura',               'terminacion',     'SOL', 'PINTURA',       14000, NULL,        NULL,          'Nave 3'
  UNION ALL SELECT 'MON-01', 'Banco de montaje y ajuste',       'montaje',         'MEC', NULL,            10000, NULL,        NULL,          'Nave 3'
  UNION ALL SELECT 'SRV-01', 'Unidad móvil de servicio en planta','servicio_planta','SOL', 'TRABAJO_ALTURA',30000, 'Renault',   'Kangoo',      'Playón'
) c
JOIN areas a ON a.codigo = c.area
LEFT JOIN habilidades h ON h.codigo = c.hab;

-- ---------------------------------------------------------------------
-- Catálogo de servicios que vende BurgosCorp
-- ---------------------------------------------------------------------
INSERT INTO servicios (codigo, nombre, descripcion, tipo_centro, tercerizado, precio_hora_referencia) VALUES
  ('REPARACION',   'Reparación de piezas y equipos',  'Diagnóstico, recuperación y reparación de piezas industriales', NULL, 0, 28000),
  ('DISENO_CAD',   'Diseño CAD',                      'Diseño 2D/3D y planos de fabricación',                      'diseno',          0, 25000),
  ('ING_INVERSA',  'Ingeniería inversa',              'Relevamiento y redibujo de piezas rotas o discontinuadas',  'diseno',          0, 30000),
  ('PROTOTIPO',    'Prototipado rápido',              'Prototipos funcionales en impresión 3D',                    'impresion_3d',    0, 15000),
  ('MAQUETA',      'Maquetas',                        'Maquetas a escala y piezas de exhibición',                  'impresion_3d',    0, 15000),
  ('IMPRESION_3D', 'Impresión 3D por pieza',          'Impresión FDM o resina de piezas a pedido',                 'impresion_3d',    0, 12000),
  ('TORNEADO',     'Torneado',                        'Torneado convencional y CNC',                               'torno',           0, 32000),
  ('FRESADO_CNC',  'Fresado / mecanizado CNC',        'Mecanizado en centro vertical y router CNC',                'cnc',             0, 50000),
  ('SOLDADURA_MIG','Soldadura MIG/MAG y TIG',         'Soldadura de acero, inoxidable y aluminio',                 'soldadura_mig',   0, 24000),
  ('HERRERIA',     'Herrería y estructuras',          'Estructuras metálicas, rejas, soportes, bastidores',        'herreria',        0, 20000),
  ('CORTE_PLASMA', 'Corte por plasma CNC',            'Corte de chapa hasta 16 mm',                                'corte',           0, 32000),
  ('CORTE_LASER',  'Corte láser',                     'Corte láser de chapa fina (tercerizado)',                   NULL,              1, NULL),
  ('PLEGADO',      'Plegado de chapa',                'Plegado hasta 3 m de largo',                                'plegado',         0, 28000),
  ('PINTURA',      'Pintura industrial',              'Pintura epoxi y esmalte sintético',                         'terminacion',     0, 18000),
  ('GALVANIZADO',  'Galvanizado en caliente',         'Tratamiento tercerizado',                                   NULL,              1, NULL),
  ('ARENADO',      'Arenado',                         'Limpieza superficial tercerizada',                          NULL,              1, NULL),
  ('SERV_PLANTA',  'Servicio en planta del cliente',  'Reparación, montaje e instalación en el lugar',             'servicio_planta', 0, 38000);

-- ---------------------------------------------------------------------
-- Inventario: categorías, depósitos y productos
-- ---------------------------------------------------------------------
INSERT INTO categorias_producto (nombre) VALUES
  ('Barras y ejes'), ('Chapas'), ('Caños y perfiles'), ('Consumibles de soldadura'),
  ('Filamentos y resinas'), ('Herramientas de corte'), ('Pinturas'), ('Repuestos de máquinas'),
  ('Bulonería');

INSERT INTO depositos (codigo, nombre, ubicacion) VALUES
  ('DEP-MP',  'Depósito de materia prima', 'Nave 2 · fondo'),
  ('DEP-PAN', 'Pañol de insumos y herramientas', 'Nave 1 · entrada'),
  ('DEP-EXP', 'Expedición / productos terminados', 'Nave 3');

INSERT INTO productos (codigo, nombre, categoria_id, tipo, unidad, costo_promedio, stock_minimo)
SELECT p.codigo, p.nombre, c.id, p.tipo, p.unidad, p.costo, p.minimo
FROM (
            SELECT 'MP-1045-25' AS codigo, 'Barra acero SAE 1045 Ø25 mm' AS nombre, 'Barras y ejes' AS cat, 'materia_prima' AS tipo, 'm' AS unidad, 9800 AS costo, 12 AS minimo
  UNION ALL SELECT 'MP-1045-50', 'Barra acero SAE 1045 Ø50 mm',          'Barras y ejes',            'materia_prima', 'm',     38000, 6
  UNION ALL SELECT 'MP-INOX-20', 'Barra acero inoxidable 304 Ø20 mm',    'Barras y ejes',            'materia_prima', 'm',     21000, 6
  UNION ALL SELECT 'MP-AL-6061', 'Barra aluminio 6061 Ø40 mm',           'Barras y ejes',            'materia_prima', 'm',     26000, 4
  UNION ALL SELECT 'MP-BRONCE',  'Buje bronce SAE 64 Ø60 mm',            'Barras y ejes',            'materia_prima', 'm',     95000, 2
  UNION ALL SELECT 'MP-CH-16',   'Chapa laminada en frío 1,6 mm',        'Chapas',                   'materia_prima', 'm2',    24000, 10
  UNION ALL SELECT 'MP-CH-32',   'Chapa laminada en caliente 3,2 mm',    'Chapas',                   'materia_prima', 'm2',    41000, 10
  UNION ALL SELECT 'MP-CH-64',   'Chapa laminada en caliente 6,4 mm',    'Chapas',                   'materia_prima', 'm2',    82000, 4
  UNION ALL SELECT 'MP-CE-40',   'Caño estructural 40x40x2 mm (6 m)',    'Caños y perfiles',         'materia_prima', 'tubo',  32000, 10
  UNION ALL SELECT 'MP-CE-80',   'Caño estructural 80x40x2 mm (6 m)',    'Caños y perfiles',         'materia_prima', 'tubo',  52000, 6
  UNION ALL SELECT 'MP-ANG-38',  'Perfil ángulo 1 1/2" x 3/16" (6 m)',   'Caños y perfiles',         'materia_prima', 'tubo',  36000, 6
  UNION ALL SELECT 'MP-PLA-38',  'Planchuela 1 1/2" x 1/4" (6 m)',       'Caños y perfiles',         'materia_prima', 'tubo',  29000, 6
  UNION ALL SELECT 'IN-MIG-08',  'Alambre MIG ER70S-6 0,8 mm',           'Consumibles de soldadura', 'insumo',        'kg',    5200,  30
  UNION ALL SELECT 'IN-MIG-10',  'Alambre MIG ER70S-6 1,0 mm',           'Consumibles de soldadura', 'insumo',        'kg',    5000,  30
  UNION ALL SELECT 'IN-GAS-MIX', 'Gas mezcla Ar/CO2 (recarga)',          'Consumibles de soldadura', 'insumo',        'un',    48000, 2
  UNION ALL SELECT 'IN-TOB-15',  'Tobera para torcha MIG 15AK',          'Consumibles de soldadura', 'insumo',        'un',    3500,  10
  UNION ALL SELECT 'IN-PLA-NEG', 'Filamento PLA negro 1,75 mm 1 kg',     'Filamentos y resinas',     'insumo',        'rollo', 19000, 6
  UNION ALL SELECT 'IN-PETG-BL', 'Filamento PETG blanco 1,75 mm 1 kg',   'Filamentos y resinas',     'insumo',        'rollo', 22000, 4
  UNION ALL SELECT 'IN-ABS-GR',  'Filamento ABS gris 1,75 mm 1 kg',      'Filamentos y resinas',     'insumo',        'rollo', 21000, 4
  UNION ALL SELECT 'IN-RES-STD', 'Resina estándar gris 1 l',             'Filamentos y resinas',     'insumo',        'l',     42000, 2
  UNION ALL SELECT 'IN-DISC-115','Disco de corte 115 mm',                'Herramientas de corte',    'insumo',        'un',    1800,  40
  UNION ALL SELECT 'HE-INS-CNMG','Inserto de torno CNMG 120408',         'Herramientas de corte',    'herramienta',   'un',    9500,  20
  UNION ALL SELECT 'HE-FRE-10',  'Fresa de metal duro Ø10 mm 4 filos',   'Herramientas de corte',    'herramienta',   'un',    38000, 4
  UNION ALL SELECT 'IN-PINT-EPX','Pintura epoxi gris 4 l',               'Pinturas',                 'insumo',        'l',     16000, 8
  UNION ALL SELECT 'IN-ANTIOX',  'Antióxido convertidor 4 l',            'Pinturas',                 'insumo',        'l',     9000,  8
  UNION ALL SELECT 'RE-BOQ-04',  'Boquilla 0,4 mm para impresora FDM',   'Repuestos de máquinas',    'repuesto',      'un',    6500,  6
  UNION ALL SELECT 'RE-CORR-CNC','Correa de transmisión router CNC',     'Repuestos de máquinas',    'repuesto',      'un',    28000, 2
  UNION ALL SELECT 'RE-ACE-ISO68','Aceite hidráulico ISO 68 20 l',       'Repuestos de máquinas',    'repuesto',      'un',    85000, 1
  UNION ALL SELECT 'BU-M10-30',  'Bulón M10 x 30 zincado (caja x100)',   'Bulonería',                'insumo',        'caja',  14000, 3
) p
JOIN categorias_producto c ON c.nombre = p.cat;

-- ---------------------------------------------------------------------
-- Numeradores del año en curso
-- ---------------------------------------------------------------------
-- Jornada: de 8 a 16 (8 h), 10 minutos de tolerancia, extras al 50 % en días hábiles y al 100 % el fin de semana.
INSERT INTO jornada_laboral (id) VALUES (1);

INSERT INTO secuencias (codigo, anio, ultimo)
SELECT s.codigo, YEAR(CURDATE()), 0 FROM (
            SELECT 'SOL' AS codigo UNION ALL SELECT 'PRE' UNION ALL SELECT 'OT'
  UNION ALL SELECT 'PRY' UNION ALL SELECT 'OC' UNION ALL SELECT 'OM'
) s;
