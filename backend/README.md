# BurgosCorp ERP · API REST

API en Node.js + Express + MySQL. Todas las rutas están bajo `/api/v1` y responden JSON.

- [Instalación](#instalación)
- [Formato de respuestas y errores](#formato-de-respuestas-y-errores)
- [Autenticación](#autenticación)
- [Roles y permisos](#roles-y-permisos)
- [Endpoints](#endpoints)
- [Seguridad](#seguridad)

## Instalación

```bash
cd backend
npm install
cp .env.example .env          # y completar (ver comentarios del archivo)
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql
npm run seed                  # empleados, usuarios de prueba, clientes, stock
npm run dev                   # desarrollo (se reinicia al guardar)
npm start                     # producción
npm test                      # tests de integración (¡usar una base de prueba!)
```

La guía paso a paso (XAMPP, usuario de base de datos, cuentas de prueba) está en
[`docs/guia-instalacion.md`](../docs/guia-instalacion.md).

### Estructura

```
backend/
├── db/            schema.sql (tablas) y seed.sql (catálogos, roles, permisos)
├── scripts/       seed.js (datos de prueba)
├── src/
│   ├── config/       env.js (valida .env), db.js (pool MySQL y transacciones)
│   ├── middlewares/  auth, permisos, validar, seguridad, límites, errores
│   ├── routes/       auth, usuarios, catálogos (uno por recurso)
│   ├── services/     auth, tokens, permisos, usuarios, auditoría
│   ├── validators/   esquemas zod (largos iguales a los de la base)
│   ├── utils/        motor CRUD, errores, helpers de seguridad
│   ├── app.js        armado de Express
│   └── server.js     arranque, timeouts y apagado
└── tests/         tests de integración (node:test + supertest)
```

## Formato de respuestas y errores

Éxito:

```json
{ "ok": true, "data": { ... }, "meta": { "pagina": 1, "limite": 20, "total": 57 } }
```

`meta` solo aparece en los listados. Error:

```json
{
  "ok": false,
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Datos inválidos",
    "detalles": [{ "campo": "body.email", "mensaje": "Email inválido" }]
  }
}
```

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Campo faltante, formato o largo inválido, campo no permitido, valor fuera de rango |
| 400 | `JSON_INVALIDO` | El cuerpo no es un JSON válido |
| 400 | `REFERENCIA_INVALIDA` | Un id apunta a un registro que no existe |
| 401 | `NO_AUTENTICADO` | Falta el token, es inválido, o las credenciales son incorrectas |
| 401 | `TOKEN_EXPIRADO` | El access token venció: renovar con `/auth/refresh` |
| 403 | `PROHIBIDO` | El rol o el área no tienen permiso para esa acción |
| 404 | `NO_ENCONTRADO` | El recurso no existe o no está dentro de tu alcance |
| 409 | `DUPLICADO` / `CONFLICTO` / `EN_USO` | Valor único repetido, estado incompatible o registro en uso |
| 413 | `DEMASIADO_GRANDE` | Cuerpo de más de 100 KB |
| 415 | `TIPO_NO_SOPORTADO` | El cuerpo no se envió como `application/json` |
| 422 | `REGLA_NEGOCIO` | La operación viola una regla del negocio |
| 423 | `CUENTA_BLOQUEADA` | 5 intentos de login fallidos: bloqueo de 15 minutos |
| 429 | `DEMASIADAS_PETICIONES` | Se superó el límite de peticiones |
| 500 | `ERROR_INTERNO` | Error inesperado (el detalle queda solo en el log del servidor) |

## Autenticación

Se usan dos tokens:

| Token | Duración | Dónde se guarda en la app | Para qué |
|---|---|---|---|
| `accessToken` (JWT HS256) | 15 minutos | Memoria / SecureStore | Header `Authorization: Bearer <token>` en cada petición |
| `refreshToken` (opaco) | 7 días | `expo-secure-store` | Pedir un access token nuevo |

El refresh token **rota**: cada uso devuelve uno nuevo y el anterior deja de servir. Si alguien
usa un refresh token que ya había sido usado (señal de robo), se invalidan todas las sesiones de
ese dispositivo. En la base solo se guarda su hash SHA-256.

Flujo típico en la app:

1. `POST /auth/login` → guarda los dos tokens.
2. Cada petición lleva el `accessToken`.
3. Si una petición devuelve `401 TOKEN_EXPIRADO`, se llama a `POST /auth/refresh`, se guardan los
   tokens nuevos y se repite la petición.
4. Si el refresh también da 401, se vuelve a la pantalla de login.

## Roles y permisos

| Rol | Resumen |
|---|---|
| `ADMIN` | Todo, incluida la administración de usuarios |
| `GERENCIA` | Ve todos los módulos, no modifica nada |
| `JEFE` | Administra los módulos de su área, asigna tareas a su equipo y aprueba |
| `EMPLEADO` | Sus tareas, fichaje y solicitudes; carga datos en los módulos de su área |

Cada endpoint exige un permiso **módulo + acción** (`ver`, `crear`, `editar`, `borrar`, `aprobar`)
definido en la tabla `permisos_rol`. El permiso tiene además un **alcance**:

- `todo`: toda la empresa.
- `area`: solo los registros del área del usuario.
- `propio`: solo los registros propios o asignados.

Algunos módulos son exclusivos del área que los administra (`area_modulos`). Por ejemplo, solo
Abastecimiento crea productos u órdenes de compra, y solo Administración accede a Finanzas.
Un JEFE del área dueña de un módulo tiene alcance `todo` en ese módulo.

Módulos: `SEG` usuarios · `ORG` organización · `RRHH` · `VEN` ventas · `PROD` producción ·
`TAR` tareas · `INV` inventario · `COM` compras · `MANT` mantenimiento · `CAL` calidad ·
`FIN` finanzas · `TAB` tablero.

## Endpoints

### Salud

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/health` | No | `200 { estado: "ok" }` |

### Autenticación · `/auth`

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/registro` | No | `email`, `password`, `nombre`, `apellido` | `202 { mensaje }`: solicitud de acceso **pendiente** hasta que la habilite un administrador. Misma respuesta si el email ya existe · `400` · `403` si `REGISTRO_ABIERTO=false` |
| POST | `/auth/login` | No | `email`, `password` | `200` sesión · `200 { requiere2fa, tokenTemporal }` si tiene 2FA · `401` · `403 CUENTA_PENDIENTE` / `CUENTA_RECHAZADA` / `CUENTA_INACTIVA` (solo con la contraseña correcta) · `423` |
| POST | `/auth/refresh` | No | `refreshToken` | `200` sesión nueva · `401` |
| POST | `/auth/logout` | No | `refreshToken` | `204` |
| POST | `/auth/logout-todas` | Sí | — | `204` cierra las sesiones de todos los dispositivos |
| GET | `/auth/yo` | Sí | — | `200 { usuario, permisos }` |
| PUT | `/auth/password` | Sí | `actual` (si ya tenía), `nueva` | `200` sesión nueva (cierra las demás) · `400` |

**Sesión** (respuesta de login, refresh y cambio de contraseña):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "q3V0b2tlbi1hbGVhdG9yaW8...",
  "usuario": {
    "id": 12, "email": "jorge.dominguez@burgoscorp.test", "nombre": "Jorge", "apellido": "Domínguez",
    "rol": "JEFE", "empleadoId": 11,
    "area": { "id": 6, "codigo": "MEC", "nombre": "Mecanizado" },
    "emailVerificado": true, "dosPasosActivo": false, "tienePassword": true
  }
}
```

**Permisos** (`/auth/yo`): un objeto por módulo visible, para que la app arme el menú.
La validación real siempre la hace el servidor.

```json
{ "PROD": { "ver": true, "crear": true, "editar": true, "borrar": true, "aprobar": true, "alcance": "todo" },
  "TAR":  { "ver": true, "crear": true, "editar": true, "borrar": true, "aprobar": true, "alcance": "area" } }
```

Reglas de contraseña: entre 10 caracteres y 72 bytes, con letras y números.

### Verificación de email · `/auth/email`

Cuando el administrador habilita la cuenta, la primera vez que entra se le manda un código de 6
dígitos. **Hasta confirmarlo, el usuario solo puede usar `/auth/*`**: el resto de la API responde
`403 EMAIL_NO_VERIFICADO`. Las cuentas creadas por el admin o con una red social ya vienen verificadas.

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/email/enviar` | Sí | — | `200` · `409` ya verificado · `429 ESPERAR_REENVIO` (un código por minuto) |
| POST | `/auth/email/verificar` | Sí | `codigo` | `200` · `400` incorrecto o vencido · `409` |

### Recuperar contraseña · `/auth/password`

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | `/auth/password/olvide` | No | `email` | `200` **siempre con el mismo mensaje**, exista o no el email |
| POST | `/auth/password/restablecer` | No | `email`, `codigo`, `nueva` | `200` · `400` código incorrecto o vencido |

Restablecer la contraseña cierra todas las sesiones, marca el email como verificado y levanta el
bloqueo por intentos fallidos. No inicia sesión: si el usuario tiene 2FA, igual se le pide.

Los códigos por email vencen a los 10 minutos, sirven una sola vez, admiten 5 intentos y se
guardan como HMAC (nunca en claro).

### Verificación en dos pasos · `/auth/2fa`

Primer factor: la contraseña o una red social. Segundo factor, a elección del usuario:

- **App autenticadora (TOTP):** Google Authenticator, Microsoft Authenticator, Authy.
- **Código por email.**
- **Código de respaldo:** 10 códigos de un solo uso, para cuando se pierde el celular.

Activación (con sesión iniciada):

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/2fa/configurar` | — | `200 { secreto, otpauthUri }`: la app muestra el QR de `otpauthUri` · `409` si ya está activa |
| POST | `/auth/2fa/activar` | `codigo` (de la app autenticadora) | `200 { codigosRespaldo: [10] }` (**se muestran una sola vez**) · `400` |
| POST | `/auth/2fa/desactivar` | `codigo` (TOTP o de respaldo) | `200` · `400` |
| POST | `/auth/2fa/codigos-respaldo` | `codigo` (TOTP o de respaldo) | `200 { codigosRespaldo }`: invalida los anteriores |

Login con 2FA:

1. `POST /auth/login` (o `/auth/social/:proveedor`) responde `{ requiere2fa: true, tokenTemporal }`.
   El `tokenTemporal` dura 5 minutos y **no sirve como sesión**.
2. Opcional: `POST /auth/2fa/email { tokenTemporal }` envía el código por email.
3. `POST /auth/2fa/verificar { tokenTemporal, metodo, codigo }` con `metodo` = `totp` | `email`
   | `respaldo` → `200` sesión · `400` código incorrecto · `423` bloqueada.

Los fallos del segundo paso cuentan para el mismo bloqueo que la contraseña (5 intentos). Un
código TOTP no se puede usar dos veces. El secreto TOTP se guarda cifrado con AES-256-GCM.

### Redes sociales · `/auth/social`

La app hace el flujo OAuth con PKCE (`expo-auth-session`) y le manda al backend lo que obtuvo.
El backend lo **verifica con el proveedor** antes de emitir sus propios tokens.

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| GET | `/auth/social/proveedores` | No | — | `200 { google, github, facebook }`: ids públicos de los proveedores configurados, `null` en los que no |
| POST | `/auth/social/google` | No | `idToken` | Sesión · `{ requiere2fa, tokenTemporal }` |
| POST | `/auth/social/github` | No | `code`, `codeVerifier`, `redirectUri` | Sesión · `{ requiere2fa, tokenTemporal }` |
| POST | `/auth/social/facebook` | No | `accessToken` | Sesión · `{ requiere2fa, tokenTemporal }` |
| DELETE | `/auth/social/:proveedor` | Sí | — | `204` · `422` si es la única forma de ingresar |

Errores: `400` email no verificado por el proveedor o redirect URI no permitida · `401` token
inválido, vencido o de otra app · `409` el usuario ya tiene otra cuenta de ese proveedor
vinculada · `503 PROVEEDOR_NO_CONFIGURADO`.

Vinculación: si la cuenta social ya está vinculada, se ingresa a ese usuario. Si no, y el
proveedor confirma el email, se vincula al usuario con ese email (así un empleado dado de alta
por RRHH entra con su Google) o se crea uno nuevo con rol `EMPLEADO`. La guía para crear las
apps OAuth está en [`docs/guia-oauth.md`](../docs/guia-oauth.md).

### Usuarios · `/usuarios` (módulo `SEG`)

| Método | Ruta | Permiso | Parámetros / Body | Respuesta |
|---|---|---|---|---|
| GET | `/usuarios/roles` | SEG ver | — | Lista de roles |
| GET | `/usuarios` | SEG ver | Query: `pagina`, `limite`, `q`, `rol`, `estado_cuenta` (`pendiente`, `habilitada`, `rechazada`) | Listado paginado, primero los pendientes |
| GET | `/usuarios/:id` | SEG ver | — | `200` · `404` |
| POST | `/usuarios` | SEG crear | `email`, `nombre`, `apellido`, `rol`, `empleado_id?` | `201` (cuenta sin contraseña: entra con red social o recupera contraseña) |
| PUT | `/usuarios/:id` | SEG editar | `rol?`, `empleado_id?`, `activo?` | `200` · `403` si es la propia cuenta |
| POST | `/usuarios/:id/habilitar` | SEG aprobar (admin) | `rol`, `empleado_id?` | `200` · `409` si ya estaba habilitada o el legajo ya tiene cuenta. Le avisa por email |
| POST | `/usuarios/:id/rechazar` | SEG aprobar (admin) | `motivo?` | `200` · `409` si no estaba pendiente. Le avisa por email con el motivo |

Cambiar el rol o desactivar una cuenta cierra todas sus sesiones.

**Solicitudes de acceso** (como en el portal R3): quien se registra en la app, o entra por primera vez
con Google, GitHub o Facebook, queda `pendiente` y no puede iniciar sesión hasta que un administrador
la habilita (con rol y legajo) o la rechaza. A los administradores les llega el aviso `cuenta_pendiente`.

### Recursos CRUD (motor común)

Todos estos recursos aceptan las mismas operaciones:

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/<recurso>` | ver | `200` listado paginado |
| GET | `/<recurso>/:id` | ver | `200` · `404` |
| POST | `/<recurso>` | crear | `201` registro creado · `400` · `409` |
| PUT | `/<recurso>/:id` | editar | `200` (modificación **parcial**: solo los campos enviados) |
| DELETE | `/<recurso>/:id` | borrar | `204` (baja lógica: `activo = 0`, si el recurso lo tiene) |

Parámetros de listado: `pagina` (desde 1), `limite` (1–100, por defecto 20), `q` (búsqueda de
texto), `orden`, `dir` (`asc`/`desc`) y los filtros propios de cada recurso. Un filtro u orden
desconocido devuelve `400`.

| Recurso | Módulo | Campos (POST) | Filtros | Orden |
|---|---|---|---|---|
| `areas` | ORG | `codigo`\*, `nombre`\*, `descripcion`, `jefe_empleado_id` | `activo` | `codigo`, `nombre` |
| `puestos` | ORG | `area_id`\*, `nombre`\*, `descripcion` | `activo`, `area_id` | `nombre`, `area` |
| `habilidades` | RRHH | `codigo`\*, `nombre`\*, `descripcion`, `requiere_certificacion` | — | `codigo`, `nombre` |
| `clientes` | VEN | `razon_social`\*, `cuit`, `condicion_iva`, `email`, `telefono`, `direccion`, `localidad`, `provincia`, `contacto` | `activo`, `condicion_iva` | `razon_social`, `creado` |
| `servicios` | VEN | `codigo`\*, `nombre`\*, `descripcion`, `tipo_centro`, `tercerizado`, `precio_hora_referencia` | `activo` | `codigo`, `nombre` |
| `proveedores` | COM | `razon_social`\*, `cuit`, `condicion_iva`, `rubro`, `email`, `telefono`, `direccion`, `contacto`, `tercerizado` | `activo`, `tercerizado` | `razon_social`, `rubro` |
| `categorias-producto` | INV | `nombre`\* | — | `nombre` |
| `depositos` | INV | `codigo`\*, `nombre`\*, `ubicacion` | `activo` | `codigo`, `nombre` |
| `productos` | INV | `codigo`\*, `nombre`\*, `tipo`\*, `descripcion`, `categoria_id`, `unidad`, `costo_promedio`, `precio_venta`, `stock_minimo` | `activo`, `categoria_id`, `tipo` | `codigo`, `nombre`, `costo` |
| `centros-trabajo` | PROD | `codigo`\*, `nombre`\*, `tipo`\*, `area_id`\*, `habilidad_requerida_id`, `costo_hora`, `estado`, `marca`, `modelo`, `nro_serie`, `ubicacion` | `activo`, `area_id`, `tipo`, `estado` | `codigo`, `nombre`, `area` |

\* obligatorio. Los campos no listados se rechazan con `400`. El CUIT se valida con su dígito
verificador y se guarda como `XX-XXXXXXXX-X`. `productos` devuelve además `stock_total`.

Ejemplo:

```http
GET /api/v1/productos?tipo=materia_prima&q=acero&orden=nombre&limite=10
Authorization: Bearer eyJhbGciOi...
```

```http
POST /api/v1/clientes
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "razon_social": "Talleres Prueba SRL", "cuit": "30-71234567-1", "condicion_iva": "RI" }
```

### Recursos Humanos y Organización (módulos `RRHH` y `ORG`)

#### Legajos · `/empleados`

Usan el motor común (listar, ver, crear, modificar), pero **no se borran**: la baja se registra
con `estado: "baja"` y `fecha_egreso`.

| Quién | Ve | Puede modificar |
|---|---|---|
| RRHH (jefe) y admin | Toda la empresa | Todo |
| Jefe de otra área | Su área | Solo su propio teléfono y dirección |
| Empleado | Solo su legajo | Solo su teléfono y dirección |

Campos de alta: `legajo`\* (`L0001`), `nombre`\*, `apellido`\*, `dni`\* (7–8 dígitos), `cuil`,
`fecha_nacimiento`, `telefono`, `email_laboral`, `direccion`, `area_id`\*, `puesto_id`,
`supervisor_id`, `fecha_ingreso`\*, `fecha_egreso`, `estado`, `costo_hora`. Filtros: `area_id`,
`estado`. Orden: `apellido`, `legajo`, `ingreso`, `area`. La respuesta incluye `area_nombre`,
`puesto_nombre`, `supervisor_nombre` y `habilidades` (texto).

| Método | Ruta | Permiso | Body | Respuesta |
|---|---|---|---|---|
| GET | `/empleados/:id/habilidades` | RRHH ver | — | Habilidades con `nivel`, `certificado_vence` y `vencida` (0/1) |
| PUT | `/empleados/:id/habilidades/:habilidadId` | RRHH (toda la empresa) | `nivel`, `certificado_vence` | `200` · `400` si la habilidad requiere certificación y falta la fecha |
| DELETE | `/empleados/:id/habilidades/:habilidadId` | RRHH (toda la empresa) | — | `204` |

#### Fichaje · `/asistencias`

Fichar es personal: alcanza con tener la cuenta vinculada a un legajo (si no, `422`).

| Método | Ruta | Permiso | Body / Query | Respuesta |
|---|---|---|---|---|
| GET | `/asistencias/hoy` | Sesión | — | `{ dentro, desde, registros, minutosHoy }` |
| POST | `/asistencias/entrada` | Sesión | — | `201` estado de hoy · `409` ya está dentro |
| POST | `/asistencias/salida` | Sesión | — | `200` · `409` no registró la entrada |
| GET | `/asistencias` | RRHH ver (según alcance) | `empleado_id`, `desde`, `hasta`, `pagina`, `limite` | Listado con `horas` |
| PUT | `/asistencias/:id` | RRHH (toda la empresa) | `entrada_at`, `salida_at`, `observacion`\* | Corrección manual (`origen: "manual"`) |

Un fichaje abierto por más de 16 horas se considera olvidado y no impide fichar de nuevo.

#### Licencias y vacaciones · `/licencias`

Circuito: **pendiente → aprobada por el jefe del área → aprobada por RRHH**. Si quien pide es
jefe, o su área no tiene jefe, aprueba RRHH directamente. Nadie resuelve su propia solicitud.
Cada paso genera un aviso para quien tiene que actuar.

| Método | Ruta | Permiso | Body / Query | Respuesta |
|---|---|---|---|---|
| GET | `/licencias` | RRHH ver (según alcance) | `estado`, `empleado_id`, `para_aprobar=1`, `pagina`, `limite` | Listado. `para_aprobar=1` devuelve lo que el usuario puede resolver ahora |
| POST | `/licencias` | Sesión con legajo | `tipo`\*, `fecha_desde`\*, `fecha_hasta`\*, `motivo` | `201` (calcula los `dias` hábiles) · `400` fechas pasadas o sin días hábiles · `409` se superpone con otra |
| POST | `/licencias/:id/aprobar` | RRHH aprobar | `comentario` | `200` · `403` no le corresponde · `409` ya resuelta · `422` falta la aprobación del jefe |
| POST | `/licencias/:id/rechazar` | RRHH aprobar | `comentario`\* | `200` |
| POST | `/licencias/:id/cancelar` | La persona que la pidió | — | `200` · `409` ya resuelta |

`tipo`: `vacaciones`, `enfermedad` (se puede cargar hasta 7 días hacia atrás), `estudio`,
`personal`, `otro`.

#### Elementos de protección personal · `/epp-entregas`

Motor común. Solo RRHH registra entregas (`empleado_id`\*, `elemento`\*, `talle`, `cantidad`,
`fecha_entrega`\*, `fecha_vencimiento`). Cada empleado ve las suyas y el jefe, las de su área. La
respuesta incluye `vencido`.

#### Organigrama y avisos

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/organigrama` | ORG ver | Áreas con su jefe, el puesto del jefe y la cantidad de personas |
| GET | `/notificaciones` | Sesión | Últimos 50 avisos del usuario; `meta.sinLeer` |
| POST | `/notificaciones/leidas` | Sesión | `204`, marca todos como leídos |

### Producción y Tareas (módulos `PROD` y `TAR`)

#### Órdenes de trabajo · `/ordenes-trabajo`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/ordenes-trabajo` | PROD ver | Lista paginada. Filtros: `estado`, `abiertas=1`, `area_id`, `q`, `pagina`, `limite` |
| GET | `/ordenes-trabajo/:id` | PROD ver | Detalle con sus operaciones (`tareas`) y el avance |
| POST | `/ordenes-trabajo` | PROD crear | `titulo`\*, `tipo_trabajo`\*, `cliente_id`, `area_id`, `responsable_id`, `prioridad`, `cantidad`, `fecha_inicio_plan`, `fecha_entrega_plan`, `horas_estimadas`, `descripcion`. Devuelve `201` con el número `OT-AAAA-NNNN` |
| PUT | `/ordenes-trabajo/:id` | PROD editar | Mismos campos y `estado`. Solo se permiten las transiciones válidas (`409` si no) |
| POST | `/ordenes-trabajo/:id/operaciones` | PROD editar | `titulo`\*, `descripcion`, `prioridad`, `centro_trabajo_id`, `habilidad_requerida_id`, `horas_estimadas` (en cuartos de hora), `fecha_limite`, `checklist` (hasta 30 textos). Secuencia automática de 10 en 10 |

Estados: `planificada` → `en_proceso` → `control_calidad` → `terminada` → `entregada`, con
`pausada` y `cancelada`. Pasa sola a `en_proceso` al iniciarse una operación y a
`control_calidad` cuando todas están aprobadas. Alcance: un jefe ve las de su área y un empleado,
las que tienen alguna operación suya.

#### Tareas · `/tareas`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/tareas` | TAR ver | Filtros: `mias`, `abiertas`, `estado`, `orden_trabajo_id`, `area_id`, `q` |
| GET | `/tareas/:id` | TAR ver | Detalle con asignados, lista de control, comentarios, historial y horas |
| POST | `/tareas` | TAR crear | Tarea suelta (sin OT): `titulo`\*, `area_id`, `centro_trabajo_id`, `prioridad`, `fecha_limite`, `horas_estimadas`, `checklist` |
| PUT | `/tareas/:id` | TAR editar | Edita los datos mientras no esté aprobada ni cancelada |
| GET | `/tareas/:id/candidatos` | TAR aprobar | Empleados que pueden hacerla, con su carga |
| POST | `/tareas/:id/asignaciones` | TAR aprobar | `empleado_id`\*. `422` si no es del área, no tiene la habilidad, la certificación venció o la máquina está en mantenimiento |
| DELETE | `/tareas/:id/asignaciones/:empleadoId` | TAR aprobar | `204` |
| POST | `/tareas/:id/iniciar` · `/pausar` | TAR ver (asignado) | Una sola tarea en curso por persona (`409`) |
| POST | `/tareas/:id/terminar` | TAR ver (asignado) | `comentario`. Exige la lista de control completa (`422` si falta algo); pasa a `en_revision` |
| POST | `/tareas/:id/aprobar` | TAR aprobar | `comentario`. No se aprueba lo propio (`403`) |
| POST | `/tareas/:id/rechazar` | TAR aprobar | `comentario`\* (el motivo) |
| POST | `/tareas/:id/cancelar` | TAR aprobar | `comentario` |
| POST | `/tareas/:id/comentarios` | TAR ver | `texto`\* |
| POST | `/tareas/:id/checklist` | TAR editar | `texto`\*, agrega un punto |
| PUT | `/tareas/:id/checklist/:itemId` | TAR ver (asignado) | `hecho`\* (booleano) |

Estados: `pendiente` → `en_curso` ⇄ `pausada` → `en_revision` → `aprobada`, o `rechazada`
(vuelve a empezarse) y `cancelada`. Las horas reales se calculan con los registros de inicio y
pausa. Cada paso genera un aviso en `/notificaciones`.

#### Materiales de una OT · `/ordenes-trabajo/:id/materiales`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/ordenes-trabajo/:id/materiales` | PROD ver (quien ve la OT) | Reservas con `cantidad`, `cantidad_consumida`, `pendiente` y `faltante`; `meta.puede_reservar` y `meta.puede_consumir` |
| POST | `/ordenes-trabajo/:id/materiales` | PROD editar (jefe del área) | `producto_id`\*, `cantidad`\*. Si ya hay una reserva activa del producto, se suma. Si no alcanza, se reserva igual, `meta.faltante` dice cuánto falta y se avisa a Abastecimiento. `201` |
| POST | `/ordenes-trabajo/:id/materiales/:reservaId/consumir` | Asignados a la OT o el jefe | `cantidad`\*, `deposito_id`, `tarea_id`, `observacion`. Baja el stock (`422` si no hay o si supera lo reservado) y suma el costo al de la OT |
| DELETE | `/ordenes-trabajo/:id/materiales/:reservaId` | Jefe del área | Libera lo que quedaba reservado |

Al pasar la OT a `entregada` o `cancelada`, lo reservado que no se usó se libera solo.

### Inventario · `/inventario` (módulo `INV`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/inventario/stock` | INV ver | Por producto: `stock_total`, `reservado`, `disponible`, `en_camino` (compras aprobadas sin recibir) y `bajo_minimo`. Filtros: `q`, `tipo`, `categoria_id`, `bajo_minimo=1`. Lo bajo el mínimo primero |
| GET | `/inventario/stock/:id` | INV ver | Ficha: stock por depósito, reservas por OT, compras en curso y últimos movimientos |
| GET | `/inventario/movimientos` | INV ver | Filtros: `producto_id`, `deposito_id`, `tipo`. Cada movimiento trae el número del documento de origen (`ref_numero`) |
| POST | `/inventario/ajustes` | INV editar (Abastecimiento) | `producto_id`\*, `deposito_id`\*, `tipo`\* (`ajuste_positivo` o `ajuste_negativo`), `cantidad`\*, `observacion`\* (el motivo). No deja bajar de lo reservado (`422`) |
| POST | `/inventario/transferencias` | INV editar | `producto_id`\*, `desde_deposito_id`\*, `hacia_deposito_id`\*, `cantidad`\* |

### Compras · `/ordenes-compra` (módulo `COM`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/ordenes-compra` | COM ver | Filtros: `estado`, `abiertas=1`, `proveedor_id`, `orden_trabajo_id`, `q` |
| GET | `/ordenes-compra/:id` | COM ver | Detalle con ítems, recepciones y qué puede hacer el usuario (`puede_aprobar`, `puede_recibir`…) |
| POST | `/ordenes-compra` | COM crear | `proveedor_id`\*, `items`\* (1 a 50: `producto_id` o `descripcion`, `cantidad`\*, `precio_unitario`\*, `iva_alicuota`), `orden_trabajo_id`, `fecha_entrega_esperada`, `observaciones`. Los importes los calcula el servidor. Queda en `borrador` |
| PUT | `/ordenes-compra/:id` | COM editar | Mismos campos, solo en borrador (`409` si no) |
| POST | `/ordenes-compra/:id/enviar-aprobacion` | COM editar | Borrador → para aprobar; avisa a la jefa de Abastecimiento |
| POST | `/ordenes-compra/:id/aprobar` | COM aprobar | La aprueba alguien distinto de quien la pidió (`403`), salvo un admin |
| POST | `/ordenes-compra/:id/rechazar` | COM aprobar | `comentario`\*. Vuelve a borrador |
| POST | `/ordenes-compra/:id/enviar` | COM editar | Aprobada → enviada al proveedor |
| POST | `/ordenes-compra/:id/recibir` | COM editar | `deposito_id`\*, `items`\* (`item_id`, `cantidad`), `remito`. Recepción total o parcial: entra al stock y recalcula el costo promedio. Si era para una OT, avisa al responsable |
| POST | `/ordenes-compra/:id/cancelar` | COM editar | `comentario`. Solo antes de recibir |

Estados: `borrador` → `pendiente_aprobacion` → `aprobada` → `enviada` → `recibida_parcial` →
`recibida`, y `cancelada`.

### Mantenimiento · `/ordenes-mantenimiento` y `/maquinas` (módulo `MANT`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/ordenes-mantenimiento` | MANT ver | Filtros: `estado`, `abiertas=1`, `mias=1`, `tipo`, `centro_trabajo_id`, `q`. Primero las máquinas paradas |
| GET | `/ordenes-mantenimiento/:id` | MANT ver | Detalle con repuestos y `transiciones` posibles para el usuario |
| POST | `/ordenes-mantenimiento` | MANT crear | Reportar falla: `centro_trabajo_id`\*, `descripcion`\*, `prioridad`, `detiene_maquina`. Con `detiene_maquina` la máquina pasa a mantenimiento. `tipo: "preventivo"` y `plan_id` solo para el jefe de Mantenimiento |
| PUT | `/ordenes-mantenimiento/:id` | Jefe de Mantenimiento | `responsable_id` (alguien del área), `prioridad`, `detiene_maquina` |
| POST | `/ordenes-mantenimiento/:id/estado` | Técnico a cargo o jefe | `estado`\* (`en_curso`, `esperando_repuesto`, `cerrada`, `cancelada`), `solucion` (obligatoria para cerrar), `costo`. Un técnico que inicia una orden sin responsable queda a cargo. Al cerrar la última que la detenía, la máquina vuelve a operar |
| POST | `/ordenes-mantenimiento/:id/repuestos` | Técnico a cargo o jefe | `producto_id`\*, `cantidad`\*, `deposito_id`. Sale del stock y suma al costo |
| GET | `/ordenes-mantenimiento/tecnicos` | MANT aprobar | Técnicos del área con sus órdenes abiertas |
| GET | `/ordenes-mantenimiento/planes-proximos` | MANT ver | Preventivos vencidos o que vencen en 7 días |
| GET | `/maquinas` · `/maquinas/:id` | MANT ver | Todas las máquinas; la ficha trae fallas abiertas, planes y últimas reparaciones |

Planes preventivos: CRUD en `/planes-mantenimiento` (solo los modifica Mantenimiento). Al cerrar
una orden preventiva, el plan se reprograma (`proxima_fecha` = hoy + frecuencia).

### Ventas · `/solicitudes` y `/presupuestos` (módulo `VEN`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/solicitudes` | VEN ver | Filtros: `estado`, `abiertas=1`, `mias=1` (asignadas a mí), `cliente_id`, `q`. Trae `fotos` (cantidad) y el teléfono del cliente |
| GET | `/solicitudes/:id` | VEN ver | Detalle con sus presupuestos, `puede_editar` y `puede_presupuestar` |
| GET | `/solicitudes/analistas` | VEN editar | Empleados de Ingeniería y Comercial con sus solicitudes abiertas |
| POST | `/solicitudes` | VEN crear | `cliente_id`\*, `titulo`\*, `tipo_trabajo`\*, `descripcion`, `cantidad`, `fecha_requerida`. Número `SOL-AAAA-NNNN` |
| PUT | `/solicitudes/:id` | VEN editar | `titulo`, `descripcion`, `cantidad`, `fecha_requerida`, `asignada_a` (pasa a `en_analisis` y avisa) o `estado: "cancelada"` |
| GET | `/presupuestos` | VEN ver | Filtros: `estado`, `abiertos=1`, `q` |
| GET | `/presupuestos/:id` | VEN ver | Detalle con líneas, `vence`, la OT generada (`puede_ver_ot`) y, si se puede aprobar, `areas_produccion` |
| POST | `/presupuestos` | VEN crear | `solicitud_id` o `cliente_id`, `items`\* (`tipo`: `maquina`, `material`, `mano_obra`, `tercerizado` u `otro`; `descripcion`\*, `cantidad`\*, `unidad`, `precio_unitario`\*, `centro_trabajo_id`, `producto_id`), `plazo_entrega_dias`, `validez_dias`, `observaciones`. Una solicitud tiene un solo presupuesto en curso (`409`) |
| PUT | `/presupuestos/:id` | VEN editar | Solo en borrador |
| POST | `/presupuestos/:id/enviar` | VEN editar | Borrador → enviado |
| POST | `/presupuestos/:id/aprobar` | VEN aprobar | El cliente aceptó: `area_id`\* (un área de producción), `prioridad`. Crea la OT: una operación por cada línea con máquina (con sus horas) y una reserva por cada material; devuelve `faltantes` y avisa al jefe del área y, si falta material, a Abastecimiento |
| POST | `/presupuestos/:id/rechazar` | VEN aprobar | `comentario`\* |

### Calidad · `/calidad` e `/inspecciones` (módulo `CAL`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/calidad/pendientes` | CAL ver | OT en `control_calidad` con sus operaciones (para elegir cuál rehacer) |
| GET | `/inspecciones` · `/inspecciones/:id` | CAL ver | Calidad ve todas; los demás, las de las OT de su área. El detalle trae las mediciones |
| POST | `/ordenes-trabajo/:id/inspecciones` | CAL crear (área Calidad) | `resultado`\* (`aprobada`, `aprobada_con_obs`, `rechazada`), `mediciones` (`caracteristica`, `valor_nominal`, `tolerancia_mas`, `tolerancia_menos`, `valor_medido`, `unidad`), `cantidad_inspeccionada`, `cantidad_rechazada`, `observaciones`, `retrabajo_tarea_id`. La API calcula si cada medición es conforme y no deja aprobar con algo fuera de tolerancia (`422`). Aprobada: la OT pasa a `terminada` y se avisa a Comercial y Finanzas. Rechazada: la operación elegida vuelve a "para rehacer" y la OT a `en_proceso` |

### Finanzas · `/comprobantes` (módulo `FIN`, solo Administración y Finanzas)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/comprobantes` | FIN ver | Filtros: `lado` (`venta` o `compra`), `estado`, `pendientes=1`, `vencidos=1`, `q` |
| GET | `/comprobantes/resumen` | FIN ver | A cobrar y a pagar, con lo vencido |
| GET | `/comprobantes/pendientes` | FIN ver | OT terminadas sin facturar y OC recibidas sin la factura del proveedor |
| GET | `/comprobantes/:id` | FIN ver | Detalle con ítems y cobros o pagos |
| POST | `/comprobantes/factura-venta` | FIN crear | `orden_trabajo_id`\*. Solo de una OT terminada o entregada; los ítems salen del presupuesto (o de `items` si no tiene). Letra A para Responsables Inscriptos, B para el resto; numeración correlativa. Una por OT (`409`) |
| POST | `/comprobantes/factura-compra` | FIN crear | `orden_compra_id`\*, `letra`\*, `punto_venta`\*, `numero`\*, `fecha`, `fecha_vencimiento`. Solo de una OC recibida; el mismo comprobante no se carga dos veces (`409`) |
| POST | `/comprobantes/:id/pagos` | FIN editar | `monto`\*, `medio`\* (`efectivo`, `transferencia`, `cheque`, `tarjeta`, `otro`), `referencia`, `fecha`. Cobro o pago, total o parcial; no más que el saldo (`422`) |
| POST | `/comprobantes/:id/anular` | FIN aprobar | Solo pendiente y sin pagos (`409`) |

### Tablero · `/tablero` (módulo `TAB`)

`GET /tablero` devuelve los indicadores de Producción, Ventas, Calidad, Mantenimiento, Inventario y
Finanzas; cada bloque aparece solo si el usuario puede ver ese módulo. Con alcance de área,
Producción se limita a las OT de su área.

### Escaneo de códigos · `/escaneo`

`GET /escaneo?codigo=` resuelve lo leído con la cámara: `BC:OT:OT-2026-0001` (pieza),
`BC:MAQ:CNC-02` (máquina), `BC:PRD:MP-1045-25` (producto) o `BC:OC:OC-2026-0001`; también el
código solo. Devuelve `{ tipo, id, titulo }` y, para una OT, `tarea_id` con la operación abierta
del usuario; a alguien de Calidad, si la OT espera inspección, `tipo: "inspeccion"`. Solo letras,
números y `: . _ - /` (`400`); `404` si no existe o el usuario no lo ve.

### Fotos y archivos adjuntos · `/adjuntos`

Entidades: `tarea` (fotos del trabajo), `licencia` (certificado), `orden_compra` (remito),
`orden_mantenimiento` (falla y reparación), `solicitud` (la pieza del cliente), `inspeccion` y
`comprobante` (la factura del proveedor). Ve los archivos quien ve la entidad; los
agrega quien la puede modificar mientras esté abierta (en una tarea, los asignados y el jefe del
área; en una licencia, quien la pidió; en una falla, quien la reportó y Mantenimiento).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/adjuntos?entidad=&entidad_id=&nombre=` | El cuerpo es el archivo **en binario** con su `Content-Type` (`image/jpeg`, `image/png`, `image/webp` o `application/pdf`), hasta 8 MB. El tipo se verifica por la firma del archivo (`400` si no coincide, `415` si el Content-Type no es uno de esos). A los JPEG se les quita el EXIF. Máximo 12 por entidad (`422`). Devuelve `201` |
| GET | `/adjuntos?entidad=&entidad_id=` | Lista con `subido_por_nombre` y `puede_borrar`; `meta.puede_agregar` y `meta.maximo` |
| GET | `/adjuntos/:id` | El archivo, con su `Content-Type` y `nosniff`. `404` si no se ve la entidad |
| DELETE | `/adjuntos/:id` | `204`. Lo borra quien lo subió o el jefe, mientras la entidad esté abierta |

Límite: 40 subidas cada 15 minutos por IP.

## Seguridad

Medidas aplicadas según OWASP Top 10:

- **Control de acceso (A01):** permisos por rol, módulo, acción y alcance, validados en el
  servidor en cada petición. Las consultas filtran por área o dueño. Nadie puede cambiarse su
  propio rol. Los accesos denegados se auditan.
- **Configuración (A02):** helmet (CSP `default-src 'none'`, `nosniff`, `DENY`, `no-referrer`),
  sin `X-Powered-By`, `Cache-Control: no-store`, CORS cerrado, `.env` validado al arrancar.
- **Autenticación (A07):** bcrypt (costo 12), bloqueo después de 5 intentos, el mismo mensaje
  para un email inexistente que para una contraseña incorrecta, JWT solo HS256 con `iss`/`aud`,
  refresh tokens rotativos guardados como hash y con detección de reutilización. 2FA TOTP
  (RFC 6238) que no acepta reusar un código, con el secreto cifrado (AES-256-GCM); códigos por
  email de un solo uso guardados como HMAC; "olvidé mi contraseña" sin revelar si el email existe.
- **OAuth:** verificación del `id_token` de Google (firma RS256 contra las claves de Google,
  `aud`, `iss`, `exp`), canje del código de GitHub con PKCE y redirect URI en lista blanca,
  `debug_token` y `appsecret_proof` en Facebook. No se vinculan cuentas sin email verificado.
- **Inyección (A05):** consultas parametrizadas; los nombres de columna, orden y filtros solo
  pueden ser los que define el código. Esquemas `strict` que impiden la asignación masiva.
- **Recursos (A06):** límite de 100 KB por cuerpo, rate limit general y estricto en login,
  timeouts del servidor y largos de campo iguales a los de la base.
- **Logging (A09):** tabla `auditoria` con login correcto y fallido, bloqueos, 403, rate limit
  y reutilización de tokens, sin guardar contraseñas ni tokens.
- **Errores (A10):** 400 para la entrada inválida (incluidos los errores de MySQL causados por
  datos) y un mensaje genérico en los 500.
