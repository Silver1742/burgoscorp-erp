-- =====================================================================
-- BurgosCorp ERP · Esquema de base de datos
-- Compatible con MySQL 8.0+ y MariaDB 10.4+ (XAMPP).
--
-- Módulos (equivalente SAP):
--   SEG  Seguridad y usuarios      ORG  Organización
--   RRHH Recursos humanos (HR)     VEN  Ventas y presupuestos (SD)
--   PROD Producción (PP)           TAR  Tareas y proyectos (PS)
--   INV  Inventario (MM)           COM  Compras (MM)
--   MANT Mantenimiento (PM)        CAL  Calidad (QM)
--   FIN  Finanzas (FI)
--
-- Convenciones:
--   * Importes en DECIMAL(14,2) (pesos argentinos), cantidades en DECIMAL(12,3).
--   * Los datos maestros no se borran: se desactivan con `activo = 0`.
--   * Los tokens, códigos y secretos nunca se guardan en claro (solo hash o cifrado).
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS burgoscorp_erp
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE burgoscorp_erp;

-- =====================================================================
-- SEG · Roles, módulos y permisos
-- =====================================================================

CREATE TABLE roles (
  id          TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo      VARCHAR(20)  NOT NULL UNIQUE,   -- ADMIN, GERENCIA, JEFE, EMPLEADO
  nombre      VARCHAR(50)  NOT NULL,
  descripcion VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE modulos (
  id     TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

-- Permiso máximo de cada rol sobre cada módulo.
--   alcance:  'propio' = solo registros propios / asignados
--             'area'   = registros de su área
--             'todo'   = toda la empresa
--   requiere_area_duenia (si el área del usuario administra el módulo, ver area_modulos):
--             'no'        = cualquier área
--             'escritura' = todos pueden ver, pero crear/editar/borrar/aprobar solo el área dueña
--                           (un jefe de Compras aprueba órdenes de compra; uno de Mecanizado no)
--             'todo'      = solo el área dueña accede al módulo (ej. Finanzas)
--   Regla adicional: si un JEFE pertenece al área dueña del módulo, su alcance pasa a 'todo'
--   (el jefe de RRHH ve los legajos de toda la empresa; el de Soldadura, solo los de su equipo).
--   Los empleados conservan el alcance configurado.
CREATE TABLE permisos_rol (
  rol_id               TINYINT UNSIGNED NOT NULL,
  modulo_id            TINYINT UNSIGNED NOT NULL,
  puede_ver            BOOLEAN NOT NULL DEFAULT 0,
  puede_crear          BOOLEAN NOT NULL DEFAULT 0,
  puede_editar         BOOLEAN NOT NULL DEFAULT 0,
  puede_borrar         BOOLEAN NOT NULL DEFAULT 0,
  puede_aprobar        BOOLEAN NOT NULL DEFAULT 0,
  alcance              ENUM('propio','area','todo') NOT NULL DEFAULT 'propio',
  requiere_area_duenia ENUM('no','escritura','todo') NOT NULL DEFAULT 'no',
  PRIMARY KEY (rol_id, modulo_id),
  CONSTRAINT fk_perm_rol    FOREIGN KEY (rol_id)    REFERENCES roles(id),
  CONSTRAINT fk_perm_modulo FOREIGN KEY (modulo_id) REFERENCES modulos(id)
) ENGINE=InnoDB;

-- =====================================================================
-- ORG · Estructura de la empresa
-- =====================================================================

CREATE TABLE areas (
  id               SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo           VARCHAR(10)  NOT NULL UNIQUE,
  nombre           VARCHAR(80)  NOT NULL,
  descripcion      VARCHAR(255) NULL,
  jefe_empleado_id INT UNSIGNED NULL,          -- FK agregada después de crear empleados
  activo           BOOLEAN NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Qué módulos administra cada área.
CREATE TABLE area_modulos (
  area_id   SMALLINT UNSIGNED NOT NULL,
  modulo_id TINYINT UNSIGNED  NOT NULL,
  PRIMARY KEY (area_id, modulo_id),
  CONSTRAINT fk_am_area   FOREIGN KEY (area_id)   REFERENCES areas(id),
  CONSTRAINT fk_am_modulo FOREIGN KEY (modulo_id) REFERENCES modulos(id)
) ENGINE=InnoDB;

CREATE TABLE puestos (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  area_id     SMALLINT UNSIGNED NOT NULL,
  nombre      VARCHAR(80)  NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo      BOOLEAN NOT NULL DEFAULT 1,
  UNIQUE KEY uq_puesto_area (area_id, nombre),
  CONSTRAINT fk_puesto_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB;

-- Numeración correlativa por tipo de documento y año (OT-2026-0001).
-- Se incrementa con SELECT ... FOR UPDATE dentro de una transacción.
CREATE TABLE secuencias (
  codigo VARCHAR(10)       NOT NULL,          -- OT, PRE, SOL, OC, OM, FV, FC, PRY
  anio   SMALLINT UNSIGNED NOT NULL,
  ultimo INT UNSIGNED      NOT NULL DEFAULT 0,
  PRIMARY KEY (codigo, anio)
) ENGINE=InnoDB;

-- =====================================================================
-- RRHH · Legajos, habilidades, asistencia, licencias, EPP
-- =====================================================================

CREATE TABLE empleados (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  legajo           VARCHAR(10)  NOT NULL UNIQUE,
  nombre           VARCHAR(60)  NOT NULL,
  apellido         VARCHAR(60)  NOT NULL,
  dni              VARCHAR(10)  NULL UNIQUE,     -- lo completa RRHH (el legajo se crea al habilitar la cuenta)
  cuil             VARCHAR(13)  NULL UNIQUE,
  fecha_nacimiento DATE         NULL,
  telefono         VARCHAR(30)  NULL,
  email_laboral    VARCHAR(254) NULL,
  direccion        VARCHAR(150) NULL,
  area_id          SMALLINT UNSIGNED NOT NULL,
  puesto_id        SMALLINT UNSIGNED NULL,
  supervisor_id    INT UNSIGNED NULL,
  fecha_ingreso    DATE         NOT NULL,
  fecha_egreso     DATE         NULL,
  estado           ENUM('activo','licencia','baja') NOT NULL DEFAULT 'activo',
  costo_hora       DECIMAL(10,2) NOT NULL DEFAULT 0,  -- para costear horas reales en las OT
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_emp_estado (estado),
  CONSTRAINT fk_emp_area       FOREIGN KEY (area_id)       REFERENCES areas(id),
  CONSTRAINT fk_emp_puesto     FOREIGN KEY (puesto_id)     REFERENCES puestos(id),
  CONSTRAINT fk_emp_supervisor FOREIGN KEY (supervisor_id) REFERENCES empleados(id),
  CONSTRAINT ck_emp_egreso CHECK (fecha_egreso IS NULL OR fecha_egreso >= fecha_ingreso),
  CONSTRAINT ck_emp_costo  CHECK (costo_hora >= 0)
) ENGINE=InnoDB;

ALTER TABLE areas
  ADD CONSTRAINT fk_area_jefe FOREIGN KEY (jefe_empleado_id) REFERENCES empleados(id);

CREATE TABLE habilidades (
  id                     SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo                 VARCHAR(20)  NOT NULL UNIQUE,
  nombre                 VARCHAR(80)  NOT NULL,
  descripcion            VARCHAR(255) NULL,
  requiere_certificacion BOOLEAN NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Habilidades de cada empleado. Se usan para validar asignaciones:
-- no se puede asignar una operación de soldadura MIG a quien no la tenga
-- (o la tenga con la certificación vencida).
CREATE TABLE empleado_habilidades (
  empleado_id       INT UNSIGNED      NOT NULL,
  habilidad_id      SMALLINT UNSIGNED NOT NULL,
  nivel             ENUM('basico','intermedio','avanzado') NOT NULL DEFAULT 'basico',
  certificado_vence DATE NULL,
  PRIMARY KEY (empleado_id, habilidad_id),
  CONSTRAINT fk_eh_empleado  FOREIGN KEY (empleado_id)  REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_eh_habilidad FOREIGN KEY (habilidad_id) REFERENCES habilidades(id)
) ENGINE=InnoDB;

CREATE TABLE asistencias (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empleado_id INT UNSIGNED NOT NULL,
  fecha       DATE         NOT NULL,
  entrada_at  DATETIME     NOT NULL,
  salida_at   DATETIME     NULL,
  origen      ENUM('app','manual') NOT NULL DEFAULT 'app',
  observacion VARCHAR(255) NULL,
  KEY idx_asis_emp_fecha (empleado_id, fecha),
  CONSTRAINT fk_asis_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  CONSTRAINT ck_asis_salida CHECK (salida_at IS NULL OR salida_at >= entrada_at)
) ENGINE=InnoDB;

-- Flujo: pendiente -> aprobada_jefe -> aprobada (RRHH) | rechazada | cancelada
CREATE TABLE solicitudes_licencia (
  id                   INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empleado_id          INT UNSIGNED NOT NULL,
  tipo                 ENUM('vacaciones','enfermedad','estudio','personal','otro') NOT NULL,
  fecha_desde          DATE NOT NULL,
  fecha_hasta          DATE NOT NULL,
  dias                 SMALLINT UNSIGNED NOT NULL,
  motivo               VARCHAR(500) NULL,
  estado               ENUM('pendiente','aprobada_jefe','aprobada','rechazada','cancelada')
                         NOT NULL DEFAULT 'pendiente',
  aprobado_jefe_por    INT UNSIGNED NULL,        -- usuarios.id
  aprobado_rrhh_por    INT UNSIGNED NULL,        -- usuarios.id
  comentario_resolucion VARCHAR(500) NULL,
  resuelto_at          DATETIME NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_lic_estado (estado),
  CONSTRAINT fk_lic_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  CONSTRAINT ck_lic_fechas CHECK (fecha_hasta >= fecha_desde)
) ENGINE=InnoDB;

-- Seguridad e higiene: elementos de protección personal entregados.
CREATE TABLE epp_entregas (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  empleado_id       INT UNSIGNED NOT NULL,
  elemento          VARCHAR(80)  NOT NULL,     -- careta de soldar, guantes, protector auditivo...
  talle             VARCHAR(10)  NULL,
  cantidad          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  fecha_entrega     DATE NOT NULL,
  fecha_vencimiento DATE NULL,
  entregado_por     INT UNSIGNED NULL,         -- usuarios.id
  CONSTRAINT fk_epp_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  CONSTRAINT ck_epp_cant CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- SEG · Usuarios, login social, tokens y 2FA
-- =====================================================================

CREATE TABLE usuarios (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email               VARCHAR(254) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NULL,            -- bcrypt; NULL si solo entra con red social
  nombre              VARCHAR(60)  NOT NULL,
  apellido            VARCHAR(60)  NOT NULL,
  rol_id              TINYINT UNSIGNED NOT NULL,
  empleado_id         INT UNSIGNED NULL UNIQUE,     -- vínculo con el legajo
  email_verificado_at DATETIME NULL,
  totp_secret_cifrado VARCHAR(255) NULL,            -- AES-256-GCM (iv:tag:dato en base64)
  totp_habilitado     BOOLEAN NOT NULL DEFAULT 0,
  totp_ultimo_paso    BIGINT UNSIGNED NULL,         -- último intervalo de 30 s usado (evita reusar un código)
  intentos_fallidos   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta     DATETIME NULL,
  ultimo_login_at     DATETIME NULL,
  activo              BOOLEAN NOT NULL DEFAULT 1,
  -- Quien se registra solo (o entra por primera vez con una red social) queda 'pendiente' hasta que
  -- un administrador lo habilita; no puede iniciar sesión. Las cuentas que crea el admin nacen habilitadas.
  estado_cuenta       ENUM('pendiente','habilitada','rechazada') NOT NULL DEFAULT 'habilitada',
  motivo_rechazo      VARCHAR(255) NULL,
  habilitada_por      INT UNSIGNED NULL,
  habilitada_at       DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_usr_estado (estado_cuenta),
  CONSTRAINT fk_usr_rol      FOREIGN KEY (rol_id)      REFERENCES roles(id),
  CONSTRAINT fk_usr_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB;

CREATE TABLE cuentas_sociales (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id    INT UNSIGNED NOT NULL,
  proveedor     ENUM('google','github','facebook') NOT NULL,
  proveedor_uid VARCHAR(128) NOT NULL,             -- "sub" / id del proveedor
  email         VARCHAR(254) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_social_uid (proveedor, proveedor_uid),
  UNIQUE KEY uq_social_usuario (usuario_id, proveedor),
  CONSTRAINT fk_social_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Refresh tokens: se guarda el SHA-256, nunca el token.
-- Rotación: cada uso crea uno nuevo en la misma familia; si llega uno ya
-- revocado (reutilizado), se revoca toda la familia.
CREATE TABLE refresh_tokens (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id         INT UNSIGNED NOT NULL,
  token_hash         CHAR(64)  NOT NULL UNIQUE,
  familia_id         CHAR(36)  NOT NULL,
  expira_at          DATETIME  NOT NULL,
  familia_expira_at  DATETIME  NOT NULL,      -- vida máxima de la sesión (no se estira al rotar)
  revocado_at        DATETIME  NULL,
  reemplazado_por_id BIGINT UNSIGNED NULL,
  ip                 VARCHAR(45)  NULL,
  user_agent         VARCHAR(255) NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rt_familia (familia_id),
  KEY idx_rt_usuario (usuario_id),
  CONSTRAINT fk_rt_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Intentos fallidos de login (contraseña o segundo paso), por email (su SHA-256, exista o no
-- la cuenta) e IP. Ver services/intentos.js: bloqueo por IP y por email en una ventana de 15 min.
CREATE TABLE intentos_login (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  clave      CHAR(64)    NOT NULL,
  ip         VARCHAR(45) NULL,
  tipo       ENUM('password','2fa') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_il_clave (clave, created_at)
) ENGINE=InnoDB;

-- Segundo paso del login pendiente: el token temporal lleva este id y sirve una sola vez,
-- con 3 intentos como máximo.
CREATE TABLE pasos_2fa (
  jti        CHAR(36) PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  intentos   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  usado_at   DATETIME NULL,
  expira_at  DATETIME NOT NULL,
  CONSTRAINT fk_p2_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Códigos de 6 dígitos enviados por email (HMAC con secreto del servidor, un solo uso, 10 min).
CREATE TABLE codigos_verificacion (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id  INT UNSIGNED NOT NULL,
  tipo        ENUM('verificar_email','recuperar_password','login_email') NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  intentos    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expira_at   DATETIME NOT NULL,
  usado_at    DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cv_usuario_tipo (usuario_id, tipo),
  CONSTRAINT fk_cv_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE codigos_respaldo_2fa (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id  INT UNSIGNED NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  usado_at    DATETIME NULL,
  CONSTRAINT fk_cr_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Las referencias a usuarios de RRHH se agregan ahora que existe la tabla.
ALTER TABLE solicitudes_licencia
  ADD CONSTRAINT fk_lic_jefe FOREIGN KEY (aprobado_jefe_por) REFERENCES usuarios(id),
  ADD CONSTRAINT fk_lic_rrhh FOREIGN KEY (aprobado_rrhh_por) REFERENCES usuarios(id);
ALTER TABLE epp_entregas
  ADD CONSTRAINT fk_epp_usuario FOREIGN KEY (entregado_por) REFERENCES usuarios(id);

-- =====================================================================
-- VEN · Clientes, catálogo de servicios, solicitudes y presupuestos
-- =====================================================================

CREATE TABLE clientes (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  razon_social VARCHAR(120) NOT NULL,
  cuit         VARCHAR(13)  NULL UNIQUE,
  condicion_iva ENUM('RI','MONOTRIBUTO','CF','EXENTO') NOT NULL DEFAULT 'CF',
  email        VARCHAR(254) NULL,
  telefono     VARCHAR(30)  NULL,
  direccion    VARCHAR(150) NULL,
  localidad    VARCHAR(80)  NULL,
  provincia    VARCHAR(50)  NULL,
  contacto     VARCHAR(100) NULL,
  activo       BOOLEAN NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cli_razon (razon_social)
) ENGINE=InnoDB;

-- Habilidades se definen antes porque centros de trabajo y servicios las requieren.
CREATE TABLE centros_trabajo (
  id                     SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo                 VARCHAR(10) NOT NULL UNIQUE,
  nombre                 VARCHAR(80) NOT NULL,
  tipo                   ENUM('diseno','impresion_3d','torno','cnc','soldadura_mig','soldadura_tig','herreria',
                              'corte','plegado','terminacion','montaje','servicio_planta')
                           NOT NULL,
  area_id                SMALLINT UNSIGNED NOT NULL,
  habilidad_requerida_id SMALLINT UNSIGNED NULL,
  costo_hora             DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado                 ENUM('operativo','mantenimiento','fuera_servicio') NOT NULL DEFAULT 'operativo',
  marca                  VARCHAR(60) NULL,
  modelo                 VARCHAR(60) NULL,
  nro_serie              VARCHAR(60) NULL,
  ubicacion              VARCHAR(80) NULL,
  activo                 BOOLEAN NOT NULL DEFAULT 1,
  CONSTRAINT fk_ct_area      FOREIGN KEY (area_id)                REFERENCES areas(id),
  CONSTRAINT fk_ct_habilidad FOREIGN KEY (habilidad_requerida_id) REFERENCES habilidades(id),
  CONSTRAINT ck_ct_costo CHECK (costo_hora >= 0)
) ENGINE=InnoDB;

CREATE TABLE servicios (
  id                     SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo                 VARCHAR(20)  NOT NULL UNIQUE,
  nombre                 VARCHAR(80)  NOT NULL,
  descripcion            VARCHAR(255) NULL,
  tipo_centro            VARCHAR(20)  NULL,     -- tipo de centro de trabajo que usa
  tercerizado            BOOLEAN NOT NULL DEFAULT 0,
  precio_hora_referencia DECIMAL(10,2) NULL,
  activo                 BOOLEAN NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Pedido del cliente antes de presupuestar.
CREATE TABLE solicitudes (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero         VARCHAR(20)  NOT NULL UNIQUE,  -- SOL-2026-0001
  cliente_id     INT UNSIGNED NOT NULL,
  titulo         VARCHAR(120) NOT NULL,
  descripcion    TEXT NULL,
  tipo_trabajo   ENUM('reparacion','fabricacion','mecanizado','prototipo','diseno','servicio_planta')
                   NOT NULL,
  cantidad       INT UNSIGNED NOT NULL DEFAULT 1,
  fecha_requerida DATE NULL,
  estado         ENUM('nueva','en_analisis','presupuestada','aprobada','rechazada','cancelada')
                   NOT NULL DEFAULT 'nueva',
  recibida_por   INT UNSIGNED NOT NULL,         -- usuarios.id
  asignada_a     INT UNSIGNED NULL,             -- empleados.id (ingeniería)
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sol_estado (estado),
  CONSTRAINT fk_sol_cliente  FOREIGN KEY (cliente_id)   REFERENCES clientes(id),
  CONSTRAINT fk_sol_usuario  FOREIGN KEY (recibida_por) REFERENCES usuarios(id),
  CONSTRAINT fk_sol_empleado FOREIGN KEY (asignada_a)   REFERENCES empleados(id),
  CONSTRAINT ck_sol_cant CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE presupuestos (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero             VARCHAR(20)  NOT NULL UNIQUE,   -- PRE-2026-0001
  solicitud_id       INT UNSIGNED NULL,
  cliente_id         INT UNSIGNED NOT NULL,
  fecha              DATE NOT NULL,
  validez_dias       SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  plazo_entrega_dias SMALLINT UNSIGNED NULL,
  estado             ENUM('borrador','enviado','aprobado','rechazado','vencido') NOT NULL DEFAULT 'borrador',
  subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva_monto          DECIMAL(14,2) NOT NULL DEFAULT 0,
  total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  observaciones      TEXT NULL,
  creado_por         INT UNSIGNED NOT NULL,
  respuesta_cliente_at DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pre_estado (estado),
  CONSTRAINT fk_pre_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id),
  CONSTRAINT fk_pre_cliente   FOREIGN KEY (cliente_id)   REFERENCES clientes(id),
  CONSTRAINT fk_pre_usuario   FOREIGN KEY (creado_por)   REFERENCES usuarios(id),
  CONSTRAINT ck_pre_importes CHECK (subtotal >= 0 AND iva_monto >= 0 AND total >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- INV · Productos, depósitos y stock
-- =====================================================================

CREATE TABLE categorias_producto (
  id     SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE productos (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo         VARCHAR(20)  NOT NULL UNIQUE,
  nombre         VARCHAR(120) NOT NULL,
  descripcion    VARCHAR(255) NULL,
  categoria_id   SMALLINT UNSIGNED NULL,
  tipo           ENUM('materia_prima','insumo','repuesto','producto_terminado','herramienta') NOT NULL,
  unidad         ENUM('un','kg','m','m2','l','rollo','tubo','caja') NOT NULL DEFAULT 'un',
  costo_promedio DECIMAL(14,2) NOT NULL DEFAULT 0,
  precio_venta   DECIMAL(14,2) NULL,
  stock_minimo   DECIMAL(12,3) NOT NULL DEFAULT 0,
  activo         BOOLEAN NOT NULL DEFAULT 1,
  KEY idx_prod_nombre (nombre),
  CONSTRAINT fk_prod_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_producto(id),
  CONSTRAINT ck_prod_valores CHECK (costo_promedio >= 0 AND stock_minimo >= 0)
) ENGINE=InnoDB;

CREATE TABLE depositos (
  id        SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo    VARCHAR(10) NOT NULL UNIQUE,
  nombre    VARCHAR(80) NOT NULL,
  ubicacion VARCHAR(120) NULL,
  activo    BOOLEAN NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE stock (
  producto_id INT UNSIGNED      NOT NULL,
  deposito_id SMALLINT UNSIGNED NOT NULL,
  cantidad    DECIMAL(12,3)     NOT NULL DEFAULT 0,
  PRIMARY KEY (producto_id, deposito_id),
  CONSTRAINT fk_stock_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_stock_deposito FOREIGN KEY (deposito_id) REFERENCES depositos(id),
  CONSTRAINT ck_stock_no_negativo CHECK (cantidad >= 0)
) ENGINE=InnoDB;

-- Ítems de presupuesto (necesita productos y centros de trabajo).
CREATE TABLE presupuesto_items (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  presupuesto_id    INT UNSIGNED NOT NULL,
  tipo              ENUM('material','mano_obra','maquina','tercerizado','otro') NOT NULL,
  descripcion       VARCHAR(200) NOT NULL,
  producto_id       INT UNSIGNED NULL,
  centro_trabajo_id SMALLINT UNSIGNED NULL,
  servicio_id       SMALLINT UNSIGNED NULL,
  cantidad          DECIMAL(12,3) NOT NULL,
  unidad            VARCHAR(10)   NOT NULL DEFAULT 'un',
  precio_unitario   DECIMAL(14,2) NOT NULL,
  iva_alicuota      DECIMAL(4,2)  NOT NULL DEFAULT 21.00,
  subtotal          DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_pi_presupuesto FOREIGN KEY (presupuesto_id)    REFERENCES presupuestos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_producto    FOREIGN KEY (producto_id)       REFERENCES productos(id),
  CONSTRAINT fk_pi_centro      FOREIGN KEY (centro_trabajo_id) REFERENCES centros_trabajo(id),
  CONSTRAINT fk_pi_servicio    FOREIGN KEY (servicio_id)       REFERENCES servicios(id),
  CONSTRAINT ck_pi_valores CHECK (cantidad > 0 AND precio_unitario >= 0 AND iva_alicuota IN (0, 10.5, 21, 27))
) ENGINE=InnoDB;

-- =====================================================================
-- PROD / TAR · Órdenes de trabajo, proyectos y tareas
-- =====================================================================

CREATE TABLE ordenes_trabajo (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero             VARCHAR(20)  NOT NULL UNIQUE,  -- OT-2026-0001
  cliente_id         INT UNSIGNED NULL,             -- NULL = trabajo interno
  presupuesto_id     INT UNSIGNED NULL UNIQUE,
  titulo             VARCHAR(120) NOT NULL,
  descripcion        TEXT NULL,
  tipo_trabajo       ENUM('reparacion','fabricacion','mecanizado','prototipo','diseno','servicio_planta')
                       NOT NULL,
  cantidad           INT UNSIGNED NOT NULL DEFAULT 1,
  prioridad          ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  estado             ENUM('planificada','en_proceso','pausada','control_calidad','terminada','entregada','cancelada')
                       NOT NULL DEFAULT 'planificada',
  fecha_inicio_plan  DATE NULL,
  fecha_entrega_plan DATE NULL,
  fecha_entrega_real DATE NULL,
  area_id            SMALLINT UNSIGNED NOT NULL,    -- área responsable
  responsable_id     INT UNSIGNED NULL,             -- empleados.id
  costo_estimado     DECIMAL(14,2) NOT NULL DEFAULT 0,
  costo_real         DECIMAL(14,2) NOT NULL DEFAULT 0,
  creado_por         INT UNSIGNED NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ot_estado (estado),
  KEY idx_ot_entrega (fecha_entrega_plan),
  CONSTRAINT fk_ot_cliente     FOREIGN KEY (cliente_id)     REFERENCES clientes(id),
  CONSTRAINT fk_ot_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id),
  CONSTRAINT fk_ot_area        FOREIGN KEY (area_id)        REFERENCES areas(id),
  CONSTRAINT fk_ot_responsable FOREIGN KEY (responsable_id) REFERENCES empleados(id),
  CONSTRAINT fk_ot_usuario     FOREIGN KEY (creado_por)     REFERENCES usuarios(id),
  CONSTRAINT ck_ot_cant CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE proyectos (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  codigo         VARCHAR(20)  NOT NULL UNIQUE,      -- PRY-2026-0001
  nombre         VARCHAR(120) NOT NULL,
  descripcion    TEXT NULL,
  cliente_id     INT UNSIGNED NULL,
  area_id        SMALLINT UNSIGNED NOT NULL,
  responsable_id INT UNSIGNED NULL,
  fecha_inicio   DATE NULL,
  fecha_fin_plan DATE NULL,
  estado         ENUM('planificado','activo','pausado','terminado','cancelado') NOT NULL DEFAULT 'planificado',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pry_cliente     FOREIGN KEY (cliente_id)     REFERENCES clientes(id),
  CONSTRAINT fk_pry_area        FOREIGN KEY (area_id)        REFERENCES areas(id),
  CONSTRAINT fk_pry_responsable FOREIGN KEY (responsable_id) REFERENCES empleados(id),
  CONSTRAINT ck_pry_fechas CHECK (fecha_fin_plan IS NULL OR fecha_inicio IS NULL OR fecha_fin_plan >= fecha_inicio)
) ENGINE=InnoDB;

-- La unidad de trabajo asignable. Una tarea puede ser:
--   * una operación de una OT (orden_trabajo_id + secuencia + centro_trabajo_id),
--   * parte de un proyecto,
--   * o una tarea suelta vinculada a cualquier documento (ref_tipo/ref_id),
--     p. ej. "Controlar recepción de OC-2026-0012".
-- Flujo: pendiente -> en_curso <-> pausada -> en_revision -> aprobada | rechazada (vuelve a en_curso)
CREATE TABLE tareas (
  id                     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  titulo                 VARCHAR(150) NOT NULL,
  descripcion            TEXT NULL,
  area_id                SMALLINT UNSIGNED NOT NULL,
  proyecto_id            INT UNSIGNED NULL,
  orden_trabajo_id       INT UNSIGNED NULL,
  secuencia              SMALLINT UNSIGNED NULL,     -- orden de la operación dentro de la OT
  centro_trabajo_id      SMALLINT UNSIGNED NULL,
  habilidad_requerida_id SMALLINT UNSIGNED NULL,
  ref_tipo               ENUM('orden_compra','orden_mantenimiento','inspeccion','solicitud','presupuesto') NULL,
  ref_id                 INT UNSIGNED NULL,
  prioridad              ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  estado                 ENUM('pendiente','en_curso','pausada','en_revision','aprobada','rechazada','cancelada')
                           NOT NULL DEFAULT 'pendiente',
  fecha_limite           DATETIME NULL,
  horas_estimadas        DECIMAL(6,2) NULL,
  horas_reales           DECIMAL(6,2) NOT NULL DEFAULT 0,  -- suma de registros_horas
  creado_por             INT UNSIGNED NOT NULL,
  revisado_por           INT UNSIGNED NULL,
  iniciada_at            DATETIME NULL,
  completada_at          DATETIME NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tar_estado (estado),
  KEY idx_tar_limite (fecha_limite),
  KEY idx_tar_ref (ref_tipo, ref_id),
  UNIQUE KEY uq_tar_ot_secuencia (orden_trabajo_id, secuencia),
  CONSTRAINT fk_tar_area      FOREIGN KEY (area_id)                REFERENCES areas(id),
  CONSTRAINT fk_tar_proyecto  FOREIGN KEY (proyecto_id)            REFERENCES proyectos(id),
  CONSTRAINT fk_tar_ot        FOREIGN KEY (orden_trabajo_id)       REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_tar_centro    FOREIGN KEY (centro_trabajo_id)      REFERENCES centros_trabajo(id),
  CONSTRAINT fk_tar_habilidad FOREIGN KEY (habilidad_requerida_id) REFERENCES habilidades(id),
  CONSTRAINT fk_tar_creador   FOREIGN KEY (creado_por)             REFERENCES usuarios(id),
  CONSTRAINT fk_tar_revisor   FOREIGN KEY (revisado_por)           REFERENCES usuarios(id),
  CONSTRAINT ck_tar_horas CHECK (horas_reales >= 0 AND (horas_estimadas IS NULL OR horas_estimadas >= 0)),
  CONSTRAINT ck_tar_ref CHECK ((ref_tipo IS NULL) = (ref_id IS NULL))
) ENGINE=InnoDB;

-- Una tarea puede tener varios asignados (ej. dos soldadores en la misma estructura).
CREATE TABLE tarea_asignaciones (
  tarea_id     INT UNSIGNED NOT NULL,
  empleado_id  INT UNSIGNED NOT NULL,
  asignado_por INT UNSIGNED NOT NULL,     -- usuarios.id
  asignado_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tarea_id, empleado_id),
  KEY idx_ta_empleado (empleado_id),
  CONSTRAINT fk_ta_tarea    FOREIGN KEY (tarea_id)     REFERENCES tareas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_empleado FOREIGN KEY (empleado_id)  REFERENCES empleados(id),
  CONSTRAINT fk_ta_usuario  FOREIGN KEY (asignado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE tarea_checklist (
  id       INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tarea_id INT UNSIGNED NOT NULL,
  texto    VARCHAR(200) NOT NULL,
  hecho    BOOLEAN NOT NULL DEFAULT 0,
  orden    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_tc_tarea FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tarea_comentarios (
  id         INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tarea_id   INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  texto      VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tcom_tarea (tarea_id, created_at),
  CONSTRAINT fk_tcom_tarea   FOREIGN KEY (tarea_id)   REFERENCES tareas(id) ON DELETE CASCADE,
  CONSTRAINT fk_tcom_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE tarea_historial (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tarea_id        INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  estado_anterior VARCHAR(20) NULL,
  estado_nuevo    VARCHAR(20) NOT NULL,
  comentario      VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_th_tarea (tarea_id),
  CONSTRAINT fk_th_tarea   FOREIGN KEY (tarea_id)   REFERENCES tareas(id) ON DELETE CASCADE,
  CONSTRAINT fk_th_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Horas trabajadas: se crean al iniciar/pausar/terminar la tarea desde la app.
CREATE TABLE registros_horas (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tarea_id    INT UNSIGNED NOT NULL,
  empleado_id INT UNSIGNED NOT NULL,
  inicio_at   DATETIME NOT NULL,
  fin_at      DATETIME NULL,
  horas       DECIMAL(6,2) NULL,
  nota        VARCHAR(255) NULL,
  KEY idx_rh_empleado (empleado_id, inicio_at),
  CONSTRAINT fk_rh_tarea    FOREIGN KEY (tarea_id)    REFERENCES tareas(id),
  CONSTRAINT fk_rh_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id),
  CONSTRAINT ck_rh_fin CHECK (fin_at IS NULL OR fin_at >= inicio_at)
) ENGINE=InnoDB;

-- Material reservado para una OT. Lo disponible de un producto es su stock menos lo
-- reservado y todavía no consumido. Si al reservar no alcanza, la reserva queda igual
-- (con faltante) y se avisa a Abastecimiento para que compre.
-- Flujo: activa -> consumida (se usó todo) | liberada (OT cerrada o el jefe la anuló)
CREATE TABLE reservas_material (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  orden_trabajo_id   INT UNSIGNED NOT NULL,
  producto_id        INT UNSIGNED NOT NULL,
  cantidad           DECIMAL(12,3) NOT NULL,
  cantidad_consumida DECIMAL(12,3) NOT NULL DEFAULT 0,
  estado             ENUM('activa','consumida','liberada') NOT NULL DEFAULT 'activa',
  creado_por         INT UNSIGNED NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_res_producto (producto_id, estado),
  KEY idx_res_ot (orden_trabajo_id, estado),
  CONSTRAINT fk_res_ot       FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_res_producto FOREIGN KEY (producto_id)      REFERENCES productos(id),
  CONSTRAINT fk_res_usuario  FOREIGN KEY (creado_por)       REFERENCES usuarios(id),
  CONSTRAINT ck_res_cant CHECK (cantidad > 0 AND cantidad_consumida >= 0 AND cantidad_consumida <= cantidad)
) ENGINE=InnoDB;

-- Materiales usados en una OT (cada consumo genera un movimiento de stock).
CREATE TABLE consumos_material (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  orden_trabajo_id INT UNSIGNED NOT NULL,
  tarea_id         INT UNSIGNED NULL,
  reserva_id       BIGINT UNSIGNED NULL,
  producto_id      INT UNSIGNED NOT NULL,
  deposito_id      SMALLINT UNSIGNED NOT NULL,
  cantidad         DECIMAL(12,3) NOT NULL,
  costo_unitario   DECIMAL(14,2) NOT NULL,
  registrado_por   INT UNSIGNED NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_ot       FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_cm_tarea    FOREIGN KEY (tarea_id)         REFERENCES tareas(id),
  CONSTRAINT fk_cm_reserva  FOREIGN KEY (reserva_id)       REFERENCES reservas_material(id),
  CONSTRAINT fk_cm_producto FOREIGN KEY (producto_id)      REFERENCES productos(id),
  CONSTRAINT fk_cm_deposito FOREIGN KEY (deposito_id)      REFERENCES depositos(id),
  CONSTRAINT fk_cm_usuario  FOREIGN KEY (registrado_por)   REFERENCES usuarios(id),
  CONSTRAINT ck_cm_cant CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- COM · Proveedores y órdenes de compra
-- =====================================================================

CREATE TABLE proveedores (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  razon_social  VARCHAR(120) NOT NULL,
  cuit          VARCHAR(13)  NULL UNIQUE,
  condicion_iva ENUM('RI','MONOTRIBUTO','CF','EXENTO') NOT NULL DEFAULT 'RI',
  rubro         VARCHAR(80)  NULL,
  email         VARCHAR(254) NULL,
  telefono      VARCHAR(30)  NULL,
  direccion     VARCHAR(150) NULL,
  contacto      VARCHAR(100) NULL,
  tercerizado   BOOLEAN NOT NULL DEFAULT 0,   -- presta servicios (galvanizado, pintura...)
  activo        BOOLEAN NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_prov_razon (razon_social)
) ENGINE=InnoDB;

-- Flujo: borrador -> pendiente_aprobacion -> aprobada -> enviada -> recibida_parcial -> recibida
CREATE TABLE ordenes_compra (
  id                     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero                 VARCHAR(20)  NOT NULL UNIQUE,  -- OC-2026-0001
  proveedor_id           INT UNSIGNED NOT NULL,
  orden_trabajo_id       INT UNSIGNED NULL,             -- compra o servicio para una OT
  fecha                  DATE NOT NULL,
  fecha_entrega_esperada DATE NULL,
  estado                 ENUM('borrador','pendiente_aprobacion','aprobada','enviada',
                              'recibida_parcial','recibida','cancelada') NOT NULL DEFAULT 'borrador',
  subtotal               DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva_monto              DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                  DECIMAL(14,2) NOT NULL DEFAULT 0,
  observaciones          TEXT NULL,
  solicitado_por         INT UNSIGNED NOT NULL,
  aprobado_por           INT UNSIGNED NULL,
  aprobado_at            DATETIME NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_oc_estado (estado),
  CONSTRAINT fk_oc_proveedor  FOREIGN KEY (proveedor_id)     REFERENCES proveedores(id),
  CONSTRAINT fk_oc_ot         FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_oc_solicitado FOREIGN KEY (solicitado_por)   REFERENCES usuarios(id),
  CONSTRAINT fk_oc_aprobado   FOREIGN KEY (aprobado_por)     REFERENCES usuarios(id),
  CONSTRAINT ck_oc_importes CHECK (subtotal >= 0 AND iva_monto >= 0 AND total >= 0)
) ENGINE=InnoDB;

CREATE TABLE orden_compra_items (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  orden_compra_id   INT UNSIGNED NOT NULL,
  producto_id       INT UNSIGNED NULL,           -- NULL para servicios tercerizados
  descripcion       VARCHAR(200) NOT NULL,
  cantidad          DECIMAL(12,3) NOT NULL,
  cantidad_recibida DECIMAL(12,3) NOT NULL DEFAULT 0,
  precio_unitario   DECIMAL(14,2) NOT NULL,
  iva_alicuota      DECIMAL(4,2)  NOT NULL DEFAULT 21.00,
  subtotal          DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_oci_oc       FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_oci_producto FOREIGN KEY (producto_id)     REFERENCES productos(id),
  CONSTRAINT ck_oci_valores CHECK (cantidad > 0 AND cantidad_recibida >= 0
                                   AND cantidad_recibida <= cantidad AND precio_unitario >= 0
                                   AND iva_alicuota IN (0, 10.5, 21, 27))
) ENGINE=InnoDB;

-- Movimientos de stock: toda variación de stock queda registrada acá.
CREATE TABLE movimientos_stock (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  producto_id     INT UNSIGNED NOT NULL,
  deposito_id     SMALLINT UNSIGNED NOT NULL,
  tipo            ENUM('ingreso_compra','consumo_ot','consumo_mantenimiento','ajuste_positivo','ajuste_negativo',
                       'transferencia_salida','transferencia_entrada','devolucion') NOT NULL,
  cantidad        DECIMAL(12,3) NOT NULL,          -- siempre positiva; el tipo define el signo
  costo_unitario  DECIMAL(14,2) NULL,
  ref_tipo        ENUM('orden_compra','orden_trabajo','orden_mantenimiento','ajuste') NULL,
  ref_id          INT UNSIGNED NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  observacion     VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mov_producto (producto_id, created_at),
  KEY idx_mov_ref (ref_tipo, ref_id),
  CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_mov_deposito FOREIGN KEY (deposito_id) REFERENCES depositos(id),
  CONSTRAINT fk_mov_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
  CONSTRAINT ck_mov_cant CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- MANT · Mantenimiento de máquinas
-- =====================================================================

CREATE TABLE planes_mantenimiento (
  id                SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  centro_trabajo_id SMALLINT UNSIGNED NOT NULL,
  nombre            VARCHAR(100) NOT NULL,         -- "Lubricación de bancada", "Cambio de boquilla"
  descripcion       VARCHAR(500) NULL,
  frecuencia_dias   SMALLINT UNSIGNED NOT NULL,
  ultima_ejecucion  DATE NULL,
  proxima_fecha     DATE NULL,
  activo            BOOLEAN NOT NULL DEFAULT 1,
  CONSTRAINT fk_pm_centro FOREIGN KEY (centro_trabajo_id) REFERENCES centros_trabajo(id),
  CONSTRAINT ck_pm_frec CHECK (frecuencia_dias > 0)
) ENGINE=InnoDB;

-- Si detiene_maquina = 1, el centro pasa a 'mantenimiento' y no admite operaciones nuevas.
CREATE TABLE ordenes_mantenimiento (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  numero            VARCHAR(20) NOT NULL UNIQUE,   -- OM-2026-0001
  centro_trabajo_id SMALLINT UNSIGNED NOT NULL,
  plan_id           SMALLINT UNSIGNED NULL,
  tipo              ENUM('preventivo','correctivo') NOT NULL,
  descripcion       VARCHAR(1000) NOT NULL,
  prioridad         ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  estado            ENUM('abierta','en_curso','esperando_repuesto','cerrada','cancelada') NOT NULL DEFAULT 'abierta',
  detiene_maquina   BOOLEAN NOT NULL DEFAULT 0,
  reportado_por     INT UNSIGNED NOT NULL,         -- usuarios.id
  responsable_id    INT UNSIGNED NULL,             -- empleados.id
  fecha_apertura    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre      DATETIME NULL,
  solucion          VARCHAR(1000) NULL,
  costo             DECIMAL(14,2) NOT NULL DEFAULT 0,
  KEY idx_om_estado (estado),
  CONSTRAINT fk_om_centro      FOREIGN KEY (centro_trabajo_id) REFERENCES centros_trabajo(id),
  CONSTRAINT fk_om_plan        FOREIGN KEY (plan_id)           REFERENCES planes_mantenimiento(id),
  CONSTRAINT fk_om_reportado   FOREIGN KEY (reportado_por)     REFERENCES usuarios(id),
  CONSTRAINT fk_om_responsable FOREIGN KEY (responsable_id)    REFERENCES empleados(id),
  CONSTRAINT ck_om_cierre CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_apertura)
) ENGINE=InnoDB;

-- =====================================================================
-- CAL · Control de calidad
-- =====================================================================

CREATE TABLE inspecciones (
  id                     INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  orden_trabajo_id       INT UNSIGNED NOT NULL,
  tarea_id               INT UNSIGNED NULL,       -- operación inspeccionada
  inspector_id           INT UNSIGNED NOT NULL,   -- empleados.id
  fecha                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resultado              ENUM('aprobada','aprobada_con_obs','rechazada') NOT NULL,
  cantidad_inspeccionada INT UNSIGNED NOT NULL DEFAULT 1,
  cantidad_rechazada     INT UNSIGNED NOT NULL DEFAULT 0,
  observaciones          VARCHAR(1000) NULL,
  CONSTRAINT fk_insp_ot        FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_insp_tarea     FOREIGN KEY (tarea_id)         REFERENCES tareas(id),
  CONSTRAINT fk_insp_inspector FOREIGN KEY (inspector_id)     REFERENCES empleados(id),
  CONSTRAINT ck_insp_cant CHECK (cantidad_rechazada <= cantidad_inspeccionada)
) ENGINE=InnoDB;

-- Mediciones dimensionales (ej. diámetro 25,00 mm ± 0,05).
CREATE TABLE inspeccion_mediciones (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  inspeccion_id    INT UNSIGNED NOT NULL,
  caracteristica   VARCHAR(100) NOT NULL,
  valor_nominal    DECIMAL(12,4) NOT NULL,
  tolerancia_mas   DECIMAL(12,4) NOT NULL DEFAULT 0,
  tolerancia_menos DECIMAL(12,4) NOT NULL DEFAULT 0,
  valor_medido     DECIMAL(12,4) NOT NULL,
  unidad           VARCHAR(10) NOT NULL DEFAULT 'mm',
  conforme         BOOLEAN NOT NULL,
  CONSTRAINT fk_med_inspeccion FOREIGN KEY (inspeccion_id) REFERENCES inspecciones(id) ON DELETE CASCADE,
  CONSTRAINT ck_med_tol CHECK (tolerancia_mas >= 0 AND tolerancia_menos >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- FIN · Comprobantes, cobros y pagos
-- =====================================================================

-- Facturas internas (sin integración con AFIP). Ventas -> cliente, compras -> proveedor.
CREATE TABLE comprobantes (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tipo              ENUM('factura_venta','nota_credito_venta','factura_compra','nota_credito_compra') NOT NULL,
  letra             ENUM('A','B','C') NOT NULL,
  punto_venta       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  numero            INT UNSIGNED NOT NULL,
  cliente_id        INT UNSIGNED NULL,
  proveedor_id      INT UNSIGNED NULL,
  orden_trabajo_id  INT UNSIGNED NULL,
  orden_compra_id   INT UNSIGNED NULL,
  fecha             DATE NOT NULL,
  fecha_vencimiento DATE NULL,
  subtotal          DECIMAL(14,2) NOT NULL,
  iva_monto         DECIMAL(14,2) NOT NULL,
  total             DECIMAL(14,2) NOT NULL,
  saldo             DECIMAL(14,2) NOT NULL,      -- lo que falta cobrar/pagar
  estado            ENUM('pendiente','parcial','pagado','anulado') NOT NULL DEFAULT 'pendiente',
  creado_por        INT UNSIGNED NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Las facturas de venta son únicas por número; las de compra, por número y proveedor.
  -- (Con proveedor_id NULL el UNIQUE no compara, por eso se usa esta columna calculada.)
  proveedor_clave   INT UNSIGNED AS (COALESCE(proveedor_id, 0)) STORED,
  UNIQUE KEY uq_comp_numero (tipo, letra, punto_venta, numero, proveedor_clave),
  KEY idx_comp_estado (estado),
  KEY idx_comp_venc (fecha_vencimiento),
  CONSTRAINT fk_comp_cliente   FOREIGN KEY (cliente_id)       REFERENCES clientes(id),
  CONSTRAINT fk_comp_proveedor FOREIGN KEY (proveedor_id)     REFERENCES proveedores(id),
  CONSTRAINT fk_comp_ot        FOREIGN KEY (orden_trabajo_id) REFERENCES ordenes_trabajo(id),
  CONSTRAINT fk_comp_oc        FOREIGN KEY (orden_compra_id)  REFERENCES ordenes_compra(id),
  CONSTRAINT fk_comp_usuario   FOREIGN KEY (creado_por)       REFERENCES usuarios(id),
  CONSTRAINT ck_comp_parte CHECK (
    (tipo IN ('factura_venta','nota_credito_venta')   AND cliente_id IS NOT NULL AND proveedor_id IS NULL) OR
    (tipo IN ('factura_compra','nota_credito_compra') AND proveedor_id IS NOT NULL AND cliente_id IS NULL)),
  CONSTRAINT ck_comp_importes CHECK (subtotal >= 0 AND iva_monto >= 0 AND total >= 0
                                     AND saldo >= 0 AND saldo <= total)
) ENGINE=InnoDB;

CREATE TABLE comprobante_items (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  comprobante_id  INT UNSIGNED NOT NULL,
  descripcion     VARCHAR(200) NOT NULL,
  cantidad        DECIMAL(12,3) NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  iva_alicuota    DECIMAL(4,2)  NOT NULL DEFAULT 21.00,
  subtotal        DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_ci_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE CASCADE,
  CONSTRAINT ck_ci_valores CHECK (cantidad > 0 AND precio_unitario >= 0 AND iva_alicuota IN (0, 10.5, 21, 27))
) ENGINE=InnoDB;

CREATE TABLE pagos (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tipo           ENUM('cobro','pago') NOT NULL,
  comprobante_id INT UNSIGNED NOT NULL,
  fecha          DATE NOT NULL,
  monto          DECIMAL(14,2) NOT NULL,
  medio          ENUM('efectivo','transferencia','cheque','tarjeta','otro') NOT NULL,
  referencia     VARCHAR(80) NULL,
  registrado_por INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id),
  CONSTRAINT fk_pago_usuario     FOREIGN KEY (registrado_por) REFERENCES usuarios(id),
  CONSTRAINT ck_pago_monto CHECK (monto > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- Transversal · Adjuntos, notificaciones y auditoría
-- =====================================================================

-- Archivos (planos DXF/STEP/STL, fotos, PDF). Se guardan en disco con un
-- nombre aleatorio; el nombre original solo se muestra, nunca se usa como ruta.
CREATE TABLE adjuntos (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  entidad         ENUM('solicitud','presupuesto','orden_trabajo','tarea','orden_mantenimiento',
                       'inspeccion','orden_compra','empleado','licencia','comprobante') NOT NULL,
  entidad_id      INT UNSIGNED NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  nombre_archivo  CHAR(36)     NOT NULL UNIQUE,   -- UUID
  extension       VARCHAR(10)  NOT NULL,
  mime            VARCHAR(100) NOT NULL,
  tamano_bytes    INT UNSIGNED NOT NULL,
  subido_por      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_adj_entidad (entidad, entidad_id),
  CONSTRAINT fk_adj_usuario FOREIGN KEY (subido_por) REFERENCES usuarios(id),
  CONSTRAINT ck_adj_tamano CHECK (tamano_bytes > 0 AND tamano_bytes <= 20971520)  -- 20 MB
) ENGINE=InnoDB;

CREATE TABLE notificaciones (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  tipo       VARCHAR(40)  NOT NULL,     -- tarea_asignada, tarea_vence, licencia_resuelta...
  titulo     VARCHAR(120) NOT NULL,
  mensaje    VARCHAR(500) NULL,
  entidad    VARCHAR(30)  NULL,
  entidad_id INT UNSIGNED NULL,
  leida_at   DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_usuario (usuario_id, leida_at),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Quién hizo qué y cuándo. Nunca se guardan contraseñas, tokens ni códigos en `detalle`.
CREATE TABLE auditoria (
  id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,          -- NULL = evento anónimo (login fallido)
  accion     VARCHAR(40)  NOT NULL,      -- login_ok, login_fallido, crear, editar, aprobar, 403...
  entidad    VARCHAR(30)  NULL,
  entidad_id INT UNSIGNED NULL,
  detalle    JSON NULL,
  ip         VARCHAR(45)  NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_aud_fecha (created_at),
  KEY idx_aud_usuario (usuario_id),
  KEY idx_aud_entidad (entidad, entidad_id),
  CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
