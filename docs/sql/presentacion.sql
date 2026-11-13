-- =====================================================================
-- BurgosCorp ERP · Consultas para mostrar la base y cargar un usuario a mano
-- Se corre en MySQL Workbench (o cualquier cliente MySQL) conectado a la base
-- del sistema: en Aiven es `defaultdb`; en la compu, `burgoscorp_erp`.
-- Cada bloque se ejecuta por separado: seleccionalo y Ctrl+Shift+Enter
-- (o el rayo ⚡ de Workbench).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) MOSTRAR LA BASE
-- ---------------------------------------------------------------------

-- Todas las tablas, con cuántas filas tiene cada una (aproximado).
SELECT TABLE_NAME AS tabla, TABLE_ROWS AS filas_aprox
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Usuarios con su rol, su legajo y su área. La contraseña NO se ve: se guarda
-- cifrada con bcrypt (columna password_hash), nunca en texto.
SELECT u.id, u.email, u.nombre, u.apellido, r.nombre AS rol, u.estado_cuenta,
       e.legajo, a.nombre AS area, u.ultimo_login_at
FROM usuarios u
JOIN roles r            ON r.id = u.rol_id
LEFT JOIN empleados e   ON e.id = u.empleado_id
LEFT JOIN areas a       ON a.id = e.area_id
ORDER BY u.id;

-- Áreas, su jefe y cuánta gente tiene cada una.
SELECT a.codigo, a.nombre AS area, CONCAT(j.nombre, ' ', j.apellido) AS jefe,
       (SELECT COUNT(*) FROM empleados e WHERE e.area_id = a.id AND e.estado <> 'baja') AS personas
FROM areas a
LEFT JOIN empleados j ON j.id = a.jefe_empleado_id
WHERE a.activo = 1
ORDER BY a.nombre;

-- Qué puede hacer cada rol en cada módulo (la matriz de permisos).
SELECT r.codigo AS rol, m.codigo AS modulo, p.puede_ver AS ver, p.puede_crear AS crear,
       p.puede_editar AS editar, p.puede_aprobar AS aprobar, p.alcance
FROM permisos_rol p
JOIN roles r   ON r.id = p.rol_id
JOIN modulos m ON m.id = p.modulo_id
ORDER BY r.id, m.codigo;

-- El recorrido de un pedido: órdenes de trabajo con su cliente y sus tareas.
SELECT o.numero, o.titulo, o.estado, c.razon_social AS cliente,
       (SELECT COUNT(*) FROM tareas t WHERE t.orden_trabajo_id = o.id) AS tareas
FROM ordenes_trabajo o
LEFT JOIN clientes c ON c.id = o.cliente_id
ORDER BY o.id DESC
LIMIT 20;

-- Auditoría: quién hizo qué y cuándo (últimos 30 movimientos).
SELECT a.created_at, a.accion, a.entidad, a.entidad_id, CONCAT(u.nombre, ' ', u.apellido) AS usuario
FROM auditoria a
LEFT JOIN usuarios u ON u.id = a.usuario_id
ORDER BY a.id DESC
LIMIT 30;


-- ---------------------------------------------------------------------
-- 2) CARGAR UN USUARIO A MANO · forma simple (recomendada)
--    Entra como "solicitud de acceso": aparece en la app, en Inicio → Pendientes
--    y en Personas → Solicitudes. El administrador lo habilita desde ahí (elige
--    rol y área: el legajo se crea solo) y con el botón "Clave" le llega un
--    código por email para crear su contraseña.
--    Cambiá el email, el nombre y el apellido antes de ejecutarlo.
-- ---------------------------------------------------------------------

INSERT INTO usuarios (email, nombre, apellido, rol_id, estado_cuenta, email_verificado_at)
VALUES (
  'nuevo.usuario@gmail.com',                          -- email (en minúsculas)
  'Nuevo', 'Usuario',                                 -- nombre y apellido
  (SELECT id FROM roles WHERE codigo = 'EMPLEADO'),   -- rol inicial (el admin lo puede cambiar)
  'pendiente',
  UTC_TIMESTAMP()
);

-- Comprobarlo:
SELECT id, email, nombre, apellido, estado_cuenta, created_at
FROM usuarios WHERE email = 'nuevo.usuario@gmail.com';


-- ---------------------------------------------------------------------
-- 3) CARGAR UN USUARIO A MANO · completo (con legajo, área y contraseña)
--    Queda habilitado y puede entrar enseguida.
--    La contraseña NO se escribe en texto: se guarda su hash bcrypt. Para
--    generarlo, en una terminal, dentro de la carpeta backend:
--        node -e "console.log(require('bcryptjs').hashSync('TuClaveSegura2026', 12))"
--    (mínimo 10 caracteres, con letras y números) y pegá el resultado en @hash.
-- ---------------------------------------------------------------------

SET @email    = 'operario.nuevo@gmail.com';
SET @nombre   = 'Operario';
SET @apellido = 'Nuevo';
SET @area     = 'MEC';          -- código del área: MEC, SOL, I3D, ING, COM, CAL, ABA, MAN, ADM, RRHH
SET @rol      = 'EMPLEADO';     -- EMPLEADO, JEFE, GERENCIA o ADMIN
SET @hash     = 'PEGAR_ACA_EL_HASH_QUE_DIO_EL_COMANDO';

START TRANSACTION;

-- El legajo: el siguiente número libre (L0031, L0032…).
SET @legajo = (SELECT CONCAT('L', LPAD(COALESCE(MAX(CAST(SUBSTRING(legajo, 2) AS UNSIGNED)), 0) + 1, 4, '0'))
               FROM empleados WHERE legajo REGEXP '^L[0-9]+$');

INSERT INTO empleados (legajo, nombre, apellido, email_laboral, area_id, fecha_ingreso, estado)
VALUES (@legajo, @nombre, @apellido, @email, (SELECT id FROM areas WHERE codigo = @area), CURDATE(), 'activo');
SET @empleado = LAST_INSERT_ID();

INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, empleado_id,
                      email_verificado_at, estado_cuenta, habilitada_at)
VALUES (@email, @hash, @nombre, @apellido, (SELECT id FROM roles WHERE codigo = @rol), @empleado,
        UTC_TIMESTAMP(), 'habilitada', UTC_TIMESTAMP());

COMMIT;

-- Comprobarlo: ya aparece en Personas y puede iniciar sesión con esa contraseña.
SELECT u.id, u.email, r.nombre AS rol, e.legajo, a.nombre AS area, u.estado_cuenta
FROM usuarios u
JOIN roles r     ON r.id = u.rol_id
JOIN empleados e ON e.id = u.empleado_id
JOIN areas a     ON a.id = e.area_id
WHERE u.email = @email;
