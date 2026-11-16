# Dónde está cada cosa en el código

Índice para ubicar rápido una funcionalidad: el profesor ve algo en la app → acá está qué archivo
abrir y en qué línea. Los números de línea son los de la versión entregada (en VS Code:
**Ctrl+P** para abrir el archivo por nombre y **Ctrl+G** para ir a la línea).

Cómo leer cada fila:

- **Pantalla:** lo que se ve, en `mobile/src/` (React Native + Expo Router, TypeScript).
- **Ruta de la API:** el endpoint que llama la pantalla, en `backend/src/routes/`.
- **Lógica:** la función que hace el trabajo de verdad, en `backend/src/services/`.

El camino es siempre el mismo: **pantalla → `api()` → ruta → middlewares (sesión, permiso,
validación) → servicio → base de datos**. La explicación de la arquitectura está en
[como-esta-hecho.md](como-esta-hecho.md).

---

## 1. Mapa general de carpetas

| Carpeta / archivo | Qué hay |
|---|---|
| `backend/src/server.js` | Arranca el servidor HTTP y lo apaga ordenadamente |
| `backend/src/app.js` | `crearApp()` (línea 17): arma Express con seguridad, límites, rutas y manejo de errores |
| `backend/src/routes/index.js` | Lista de todos los módulos de rutas bajo `/api/v1` |
| `backend/src/routes/` | Un archivo por módulo: reciben el pedido, chequean permisos y llaman al servicio |
| `backend/src/services/` | La lógica de negocio (reglas, cálculos, transacciones) |
| `backend/src/middlewares/` | Sesión, permisos, validación, límites, cabeceras de seguridad, errores |
| `backend/src/validators/` | Esquemas **zod** que validan cada dato que entra |
| `backend/src/config/` | `db.js` (conexión MySQL) y `env.js` (variables de entorno validadas) |
| `backend/src/utils/` | Ayudas: CRUD genérico, fechas, numeración, hashes |
| `backend/db/schema.sql` | Todas las tablas, comentadas por módulo |
| `backend/db/seed.sql` · `backend/scripts/seed.js` | Datos iniciales y de prueba |
| `backend/scripts/migraciones.js` | Cambios a la base después de la primera versión |
| `backend/tests/` | Pruebas automáticas (187) |
| `mobile/src/app/` | Las pantallas: cada archivo es una ruta (Expo Router) |
| `mobile/src/app/(auth)/` | Pantallas sin sesión: login, registro, olvidé, restablecer |
| `mobile/src/app/(app)/` | Pantallas con sesión: Inicio, Tareas, Personas, Módulos, Perfil |
| `mobile/src/componentes/` | Piezas reutilizables (escáner, calendario, tablón, fotos…) |
| `mobile/src/contexto/` | Estado global: sesión (`sesion.tsx`) y avisos (`toast.tsx`) |
| `mobile/src/lib/` | Funciones sin pantalla: llamadas a la API, QR, CSV, roles, validación |
| `mobile/src/tema.tsx` | Colores, modo claro/oscuro y tamaños |
| `mobile/src/modulos.ts` | Catálogo de módulos y textos de estados (OT, tareas, compras…) |

---

## 2. Ingreso y seguridad de la cuenta

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| **Iniciar sesión** | `app/(auth)/login.tsx` → `contexto/sesion.tsx` `login()` línea 94 | `routes/auth.js` línea 23 `POST /auth/login` | `services/auth.js` `login()` línea 129 |
| Contraseña cifrada (bcrypt) | — | — | `services/auth.js` línea 105 (`bcrypt.hash`) y 140 (`bcrypt.compare`), costo 12 en línea 14 |
| Bloqueo tras intentos fallidos | — | — | `services/intentos.js` `exigirNoBloqueado()` 31, `registrarFallo()` 37 |
| **Registrarse / pedir acceso** | `app/(auth)/registro.tsx` | `routes/auth.js` 17 `POST /auth/registro` | `services/auth.js` `registrar()` 103; tope diario `exigirCupoDeSolicitudes()` 63; aviso al admin `avisarSolicitud()` 72 |
| Validar email y nombre | `lib/validacion.ts` (`esEmail`, `esNombre`, `errorPassword`) | — | `validators/comunes.js`: `email` 28, `password` 31, `nombrePersona` 40 |
| **Verificación en dos pasos (2FA)** | `app/dos-pasos.tsx` (al entrar) y `app/(app)/perfil/dos-pasos.tsx` (activar) | `routes/auth.js` 79–99 | `services/dosPasos.js`: `activar()` 42, `iniciarSegundoPaso()` 89, `completarLogin()` 112 |
| **Generar el código de 6 números** | — | — | `services/codigos.js` `generarCodigo()` 18 (número al azar seguro con `crypto.randomInt`, línea 29); `verificarCodigo()` 42. Se guarda solo su hash |
| Enviar el código por email | — | — | `services/email.js` `enviarCodigo()` 139 (por Brevo, `enviarPorBrevo()` 43) |
| Verificar el email | `app/verificar-email.tsx` | `routes/auth.js` 52 y 57 | `services/verificacion.js` `enviarCodigoVerificacion()` 10, `confirmarEmail()` 16 |
| **Olvidé mi contraseña** | `app/(auth)/olvide.tsx` y `restablecer.tsx` | `routes/auth.js` 66 y 71 | `services/verificacion.js` `solicitarRecuperacion()` 30, `restablecerPassword()` 45 |
| Cambiar contraseña | En la app se hace con "¿Olvidaste tu contraseña?" (código por email) | `routes/auth.js` 46 (también disponible en la API) | `services/auth.js` `cambiarPassword()` 189 |
| **Login con Google, GitHub, Discord** | `componentes/BotonesSociales.tsx` y `lib/social.ts` `iniciarIngreso()` 90; vuelta en `app/oauth.tsx` | `routes/auth.js` 105 (qué redes hay) y 109 | `services/social.js` `loginSocial()` 223; perfiles: `perfilGoogle()` 70, `perfilGithub()` 96, `perfilDiscord()` 133 |
| **Tokens de sesión (JWT)** | `lib/api.ts` (renueva solo: `renovarSesion()` 118) | `routes/auth.js` 27 `POST /auth/refresh` | `services/tokens.js`: `firmarAcceso()` 20, `verificarAcceso()` 31 (solo HS256), `rotarRefresh()` 118 |
| Sesión que no se pierde al cerrar la app | `lib/almacen.ts` (guarda el refresh token en `SecureStore`, línea 36) | — | Refresh tokens guardados como hash: tabla `refresh_tokens` |
| Cerrar sesión (y en todos los dispositivos) | `app/(app)/perfil/index.tsx` | `routes/auth.js` 32 y 37 | `services/auth.js` `logout()` 175, `cerrarTodasLasSesiones()` 180 |
| Pantallas protegidas (sin sesión no se entra) | `app/_layout.tsx` líneas 65–79 (`Stack.Protected`) | — | — |

## 3. Roles, permisos y protecciones de la API

| Funcionalidad | Dónde |
|---|---|
| Exigir sesión en una ruta | `middlewares/auth.js` `autenticar()` línea 7 |
| **Exigir permiso** (ver/crear/editar/aprobar por módulo) | `middlewares/permisos.js` `requierePermiso()` línea 10 |
| Calcular el permiso de un usuario | `services/permisos.js` `resolverPermiso()` línea 47 y `mapaPermisos()` 75 |
| Que un jefe vea solo su área | `services/permisos.js` `filtroAlcance()` línea 98 (y cada servicio tiene su `condicionAlcance()`, por ejemplo `services/tareas.js` línea 46) |
| La matriz de permisos | Tabla `permisos_rol` en `backend/db/schema.sql` (sección SEG) |
| Qué pestañas y color ve cada rol | `mobile/src/lib/roles.ts` `perfilRol` línea 23; pestañas en `app/(app)/_layout.tsx` |
| Qué botones se muestran según permiso | `contexto/sesion.tsx` `usePuede()` línea 173 |
| **Validación de datos (zod)** | `middlewares/validar.js` `validar()` línea 5 + esquemas en `validators/` (uno por módulo) |
| Cabeceras de seguridad (helmet, CSP) | `middlewares/seguridad.js` `cabeceras` línea 8 |
| Anti-CSRF (exige JSON) | `middlewares/seguridad.js` `exigirJson()` línea 39 |
| **Límite de pedidos por IP** | `middlewares/limites.js`: general 26, login 31, registro 34, subidas 36 |
| Errores (mensaje genérico, nunca el detalle interno) | `middlewares/errores.js` `manejarErrores()` línea 24 |
| **Auditoría** (quién hizo qué) | `services/auditoria.js` `auditar()` línea 10 → tabla `auditoria` |
| Conexión a MySQL y transacciones | `config/db.js`: `query()` 29, `transaccion()` 44 (todo o nada) |
| Consultas con parámetros `?` (anti inyección SQL) | En todos los servicios, a través de `query()` |
| Numeración tipo SAP (OT-2026-0001) | `utils/secuencias.js` `siguienteNumero()` línea 4 |
| CRUD genérico (clientes, productos, áreas…) | `utils/crud.js` `crearRecursoCrud()` línea 43, usado en `routes/catalogos.js` |
| Variables de entorno validadas | `config/env.js` |

## 4. Inicio

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| Pantalla de Inicio | `app/(app)/index.tsx` | — | — |
| **Tablón de avisos** (con imágenes) | `componentes/Tablon.tsx` `Tablon()` línea 113 | `routes/inicio.js` 47 (ver), 71 (publicar), 91 (editar), 105 (borrar) | `services/tablon.js` `acceso()` 12 |
| **Pendientes** (lo que espera una decisión) | `componentes/Pendientes.tsx` | `routes/inicio.js` 131 `GET /pendientes` | La misma ruta junta licencias, tareas, compras y solicitudes |
| Fichar entrada/salida | `componentes/Fichaje.tsx` | `routes/rrhh.js` 116 y 119 | `services/asistencias.js` `ficharEntrada()` 34, `ficharSalida()` 45 |
| Campanita de notificaciones | `app/(app)/perfil/notificaciones.tsx` | `routes/rrhh.js` 314 | `services/notificaciones.js` `notificar()` línea 4 |
| **Buscador general** | `app/(app)/buscar.tsx` | `routes/buscar.js` 78 `GET /buscar` | Misma ruta (busca solo en lo que el rol puede ver) |
| La app se actualiza sola cuando otro cambia algo | `lib/cambios.ts` `VigiaCambios()` 53, `useCargar()` 45 | `routes/inicio.js` 123 `GET /cambios` | `middlewares/cambios.js` `contarCambios()` 13 |

## 5. Personas, usuarios y RRHH

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| Lista de personas | `app/(app)/personas.tsx` | `routes/rrhh.js` 32 (`/empleados`) | `utils/crud.js` (filtra por área según el rol) |
| Resumen del personal por área | `app/(app)/modulos/rrhh/personal.tsx` | `routes/rrhh.js` 170 | — |
| Ficha de una persona | `componentes/FichaPersona.tsx` | `routes/rrhh.js` 258 | — |
| **Usuarios: crear, editar, borrar** (admin) | `app/(app)/modulos/usuarios/index.tsx`, `[id].tsx`, `nuevo.tsx` | `routes/usuarios.js`: crear 161, editar 202, borrar 252 | En la misma ruta + `services/usuarios.js` |
| **Habilitar o rechazar una solicitud de acceso** | `app/(app)/modulos/usuarios/solicitudes.tsx` | `routes/usuarios.js` 282 y 315 | `services/legajos.js` `crearLegajo()` 134 (crea el legajo solo) |
| Restablecer contraseña de otro (admin) | `app/(app)/modulos/usuarios/[id].tsx` | `routes/usuarios.js` 239 | — |
| Legajos (alta y edición) | `app/(app)/modulos/rrhh/legajo/nuevo.tsx` y `[id].tsx`, formulario `componentes/FormLegajo.tsx` | `routes/rrhh.js` 32 (CRUD de empleados) | `services/legajos.js` `crearLegajo()` 134, `actualizarLegajo()` 154, `proximoLegajo()` 83 |
| Área, puesto y habilidades de alguien | `componentes/UbicacionLaboral.tsx` | `routes/rrhh.js` 72–101 | `services/legajos.js` `guardarHabilidades()` 101 |
| Cambiar el jefe de un área | `componentes/Jefatura.tsx` | — | `services/legajos.js` `resolverJefatura()` 39 |
| Crear un área nueva (admin) | `componentes/NuevaArea.tsx` | `routes/catalogos.js` 48 y 29 | `utils/crud.js` |
| **Pedir licencia** (con calendario) | `app/(app)/modulos/rrhh/licencias.tsx` | `routes/rrhh.js` 134 | `services/licencias.js` `solicitar()` 29 |
| **Aprobar o rechazar licencia** | `app/(app)/modulos/rrhh/aprobaciones.tsx` y desde Pendientes | `routes/rrhh.js` 137 y 141 | `services/licencias.js` `aprobar()` 136, `rechazar()` 170 |
| Organigrama | `app/(app)/modulos/rrhh/organigrama.tsx` | `routes/rrhh.js` 303 | — |
| Equipo del jefe | `app/(app)/equipo.tsx`, `componentes/IntegrantesArea.tsx` | `routes/rrhh.js` 214 | — |
| Fichajes de todos (lista y corrección) | Pantalla genérica `app/(app)/modulos/[modulo]/[recurso].tsx`, configurada en `mobile/src/modulos.ts` línea 246 | `routes/rrhh.js` 122 y 125 | `services/asistencias.js` `listar()` 54, `corregir()` 76 |

## 6. Producción y tareas

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| Órdenes de trabajo (lista, nueva, detalle) | `app/(app)/modulos/produccion/index.tsx`, `nueva.tsx`, `[id].tsx` | `routes/produccion.js` 14–26 | `services/ordenes.js` `crear()` 112, `editar()` 132 |
| Materiales de una OT (reservar y consumir stock) | `componentes/MaterialesOt.tsx` | `routes/inventario.js` 34–44 | `services/materiales.js` `reservar()` 52, `consumir()` 86 |
| **Mis tareas** (empleado) | `app/(app)/tareas/index.tsx` y `[id].tsx`, lista en `componentes/ListaTareas.tsx` | `routes/produccion.js` 31 y 41 | `services/tareas.js` `listar()` 56, `obtener()` 135 |
| **Crear una tarea** (fecha y hora con calendario) | `app/(app)/modulos/tareas/nueva.tsx` | `routes/produccion.js` 44 | `services/tareas.js` `crear()` 217 |
| **Asignar una tarea a un empleado** | `componentes/DetalleTarea.tsx` `DialogoAsignar()` línea 36 | `routes/produccion.js` 55 | `services/tareas.js` `asignar()` 419 (valida área y habilidad en `validarAsignable()` 392) |
| Iniciar, pausar y terminar (horas trabajadas) | `componentes/DetalleTarea.tsx` | `routes/produccion.js` 64, 67, 70 | `services/tareas.js` `iniciar()` 483, `pausar()` 503, `terminar()` 517 |
| Aprobar o rechazar el trabajo (jefe) | `componentes/DetalleTarea.tsx` | `routes/produccion.js` 75 y 78 | `services/tareas.js` `aprobar()` 549, `rechazar()` 558 |
| Comentarios y checklist | `componentes/DetalleTarea.tsx` | `routes/produccion.js` 86–92 | `services/tareas.js` `comentar()` 583, `agregarItem()` 591, `marcarItem()` 599 |
| Fotos del trabajo (cámara o galería) | `componentes/Fotos.tsx` (cámara en línea 71) | `routes/adjuntos.js` 42–59 | `services/adjuntos.js` `subir()` 104 (revisa que sea imagen de verdad en `detectarTipo()` 56) |

## 7. Códigos QR

| Funcionalidad | Dónde |
|---|---|
| **Generar el QR** (etiqueta para imprimir) | `componentes/EtiquetaQR.tsx` línea 38 (`<QRCode value={enlaceDeCodigo(codigo)}>`, librería `react-native-qrcode-svg`) |
| Qué texto lleva el QR | `lib/qr.ts` `enlaceDeCodigo()` línea 11 (enlace a la web con el código, ej. `BC:MAQ:CNC-02`) |
| Dónde se muestra cada etiqueta | Máquina: `modulos/mantenimiento/maquina/[id].tsx` 76 · OT: `modulos/produccion/[id].tsx` 150 · Producto: `modulos/inventario/[id].tsx` 127 · Orden de compra: `modulos/compras/[id].tsx` 172 |
| **Escanear con la cámara** | `componentes/Escaner.tsx`: lector del sistema `abrirLector()` 66, procesar lo leído `resolver()` 75 |
| Leer el enlace del QR y aceptar solo los nuestros | `lib/qr.ts` `codigoDeQR()` línea 16 |
| Pantalla Escanear | `app/(app)/modulos/escanear.tsx` |
| Abrir un QR con la cámara común del teléfono | `app/qr.tsx` |
| Qué es cada código (máquina, pieza, OT, compra) | API `routes/inventario.js` 50 `GET /escaneo` → `services/escaneo.js` `resolver()` línea 61 |

## 8. Inventario, compras y mantenimiento

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| Stock y ficha de producto | `app/(app)/modulos/inventario/index.tsx` y `[id].tsx` | `routes/inventario.js` 15 y 18 | `services/inventario.js` `listarStock()` 29, `obtenerProducto()` 49 |
| Ajustes y transferencias de stock | `app/(app)/modulos/inventario/[id].tsx` | `routes/inventario.js` 25 y 28 | `services/inventario.js` `ajustar()` 99, `transferir()` 116; movimiento en `services/stock.js` |
| **Órdenes de compra** (circuito completo) | `app/(app)/modulos/compras/index.tsx`, `nueva.tsx`, `[id].tsx` | `routes/compras.js` 13–40 | `services/compras.js`: `crear()` 169, `aprobar()` 239, `enviar()` 259, `recibir()` 275 (suma al stock) |
| Proveedores, clientes, productos (ABM) | `app/(app)/modulos/[modulo]/[recurso].tsx` (pantalla genérica) | `routes/catalogos.js` | `utils/crud.js` `crearRecursoCrud()` 43 |
| **Reportar una falla de máquina** (con QR) | `app/(app)/modulos/mantenimiento/nueva.tsx` | `routes/mantenimiento.js` 26 | `services/mantenimiento.js` `crear()` 133 |
| Órdenes de mantenimiento y su estado | `app/(app)/modulos/mantenimiento/index.tsx` y `[id].tsx` | `routes/mantenimiento.js` 13–35 | `services/mantenimiento.js` `cambiarEstado()` 194, `usarRepuesto()` 230 |
| Ficha de una máquina | `app/(app)/modulos/mantenimiento/maquina/[id].tsx` | `routes/mantenimiento.js` 43 | `services/mantenimiento.js` `maquina()` 272 |

## 9. Ventas, calidad, finanzas y tablero

| Funcionalidad | Pantalla | Ruta de la API | Lógica |
|---|---|---|---|
| Solicitudes de clientes | `app/(app)/modulos/ventas/index.tsx`, `nueva.tsx`, `solicitud/[id].tsx` | `routes/ventas.js` 13–25 | `services/ventas.js` `crearSolicitud()` 113 |
| **Presupuestos** (con IVA) | `app/(app)/modulos/ventas/presupuesto/nuevo.tsx` y `[id].tsx` | `routes/ventas.js` 30–49 | `services/ventas.js` `crearPresupuesto()` 259, `aprobarPresupuesto()` 333 (crea la OT) |
| **Control de calidad** | `app/(app)/modulos/calidad/index.tsx`, `inspeccionar/[otId].tsx` | `routes/calidad.js` 12–22 | `services/calidad.js` `inspeccionar()` 96 |
| Facturas y pagos | `app/(app)/modulos/finanzas/index.tsx` y `[id].tsx` | `routes/finanzas.js` 14–36 | `services/finanzas.js` `facturarOt()` 102, `registrarPago()` 159, `anular()` 175 |
| **Liquidación de sueldos** (resumen por empleado) | `app/(app)/modulos/finanzas/liquidacion.tsx` | `routes/liquidacion.js` 53 y 61 | `services/liquidacion.js` `liquidar()` 143, cálculo por persona `calcularEmpleado()` 49 |
| Jornada laboral (horario de entrada) | `app/(app)/modulos/finanzas/liquidacion.tsx` | `routes/liquidacion.js` 28 y 33 | `services/liquidacion.js` `jornada()` 28 |
| **Descargar la planilla (CSV)** | `liquidacion.tsx` línea 187 (todos) y 90 (detalle de uno); columnas en línea 60 | — (se arma en el teléfono) | `lib/archivos.ts` `armarCsv()` 22 y `descargarCsv()` 29 (en el teléfono abre "Compartir") |
| **Tablero** (indicadores para gerencia) | `app/(app)/modulos/tablero.tsx` | `routes/finanzas.js` 40 `GET /tablero` | `services/tablero.js` `obtener()` 89 |

## 10. Interfaz de la app

| Funcionalidad | Dónde |
|---|---|
| **Llamar a la API** (token, errores, renovar sesión) | `lib/api.ts` `api()` línea 149 |
| Estado global de la sesión (Context + useReducer) | `contexto/sesion.tsx` `SesionProvider()` línea 40 |
| Avisos (toasts) en vez de `alert()` | `contexto/toast.tsx` `useToast()` línea 79 |
| **Calendario para las fechas** (formato DD/MM/AAAA) | `componentes/CampoFecha.tsx` línea 53 |
| Modo claro / oscuro | `tema.tsx` `TemaProvider()` 106 y `componentes/SelectorTema.tsx` |
| Escudo y marca BurgosCorp | `componentes/Marca.tsx` |
| Botones, tarjetas, campos (kit visual) | `componentes/ui.tsx` |
| Botón de volver y rutas | `lib/volver.tsx`: `RegistroRutas()` 41, `botonVolver` 118 |
| Botón "subir" en listas largas | `componentes/Desplazable.tsx` `BotonArriba()` línea 24 |
| Diálogo de confirmación | `componentes/ConfirmDialog.tsx` |
| Llamar o escribir por WhatsApp a alguien | `componentes/Contacto.tsx` (línea 28) |
| Barra de pestañas y menú por rol | `app/(app)/_layout.tsx` |
| Ayuda y tutorial dentro de la app | `app/(app)/perfil/ayuda.tsx` y `mobile/src/ayuda.ts` |

## 11. Base de datos

| Qué | Dónde |
|---|---|
| Todas las tablas | `backend/db/schema.sql` (secciones por módulo; reglas `CHECK`, por ejemplo stock no negativo en la línea 485) |
| Datos iniciales | `backend/db/seed.sql` |
| Datos de prueba (30 empleados) | `backend/scripts/seed.js` |
| Crear la base si está vacía | `backend/scripts/init-db.js` |
| Cambios posteriores (migraciones) | `backend/scripts/migraciones.js` |
| Consultas para mostrar y cargar un usuario a mano | `docs/sql/presentacion.sql` |
| Cómo usarla en Workbench | [guia-base-de-datos.md](guia-base-de-datos.md) |

## 12. Pruebas

| Qué | Dónde |
|---|---|
| Pruebas de la API (187) | `backend/tests/*.test.js`, un archivo por módulo (`auth.test.js`, `inicio.test.js`…) |
| Correrlas | `npm test` desde `backend/` (ver [guia-instalacion.md](guia-instalacion.md)) |
| Chequeo de tipos de la app | `npm run tipos` desde `mobile/` (TypeScript, 0 errores) |
