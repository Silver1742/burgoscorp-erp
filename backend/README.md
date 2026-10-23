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
| POST | `/auth/registro` | No | `email`, `password`, `nombre`, `apellido` | `201` sesión (rol `EMPLEADO`) · `400` · `409` |
| POST | `/auth/login` | No | `email`, `password` | `200` sesión · `200 { requiere2fa, tokenTemporal }` si tiene 2FA · `401` · `403` cuenta desactivada · `423` |
| POST | `/auth/refresh` | No | `refreshToken` | `200` sesión nueva · `401` |
| POST | `/auth/logout` | No | `refreshToken` | `204` |
| POST | `/auth/logout-todas` | Sí | — | `204` cierra las sesiones de todos los dispositivos |
| GET | `/auth/yo` | Sí | — | `200 { usuario, permisos }` |
| PUT | `/auth/password` | Sí | `actual` (si ya tenía), `nueva` | `200` sesión nueva (cierra las demás) · `400` |

**Sesión** (respuesta de login, registro, refresh y cambio de contraseña):

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

Al registrarse se envía un código de 6 dígitos. **Hasta confirmarlo, el usuario solo puede usar
`/auth/*`**: el resto de la API responde `403 EMAIL_NO_VERIFICADO`. Las cuentas creadas por el
admin o con una red social ya vienen verificadas.

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
| GET | `/usuarios` | SEG ver | Query: `pagina`, `limite`, `q`, `rol` | Listado paginado |
| GET | `/usuarios/:id` | SEG ver | — | `200` · `404` |
| POST | `/usuarios` | SEG crear | `email`, `nombre`, `apellido`, `rol`, `empleado_id?` | `201` (cuenta sin contraseña: entra con red social o recupera contraseña) |
| PUT | `/usuarios/:id` | SEG editar | `rol?`, `empleado_id?`, `activo?` | `200` · `403` si es la propia cuenta |

Cambiar el rol o desactivar una cuenta cierra todas sus sesiones.

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
