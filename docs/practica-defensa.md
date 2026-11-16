# Práctica para la defensa

El profesor mira una funcionalidad y pide: "mostrame dónde está esto en el código". Estas preguntas
practican eso. Primero respondé de memoria y después mirá las respuestas al final.

**Cómo contestar (en este orden):**

1. **La pantalla** que lo muestra (`mobile/src/app/...` o un componente).
2. **La ruta de la API** que llama (`backend/src/routes/...`).
3. **La función que hace el trabajo** (`backend/src/services/...`) y, si la sabés, la línea.

En VS Code: **Ctrl+P** abre un archivo por su nombre y **Ctrl+G** va a una línea. Si no te acordás
de la línea, **Ctrl+Shift+F** busca el nombre de la función en todo el proyecto.

---

## Preguntas

### Ingreso y seguridad

1. ¿Dónde se comprueba en el servidor que el email y la contraseña del login son correctos?
2. ¿Dónde se encripta la contraseña cuando alguien se registra? ¿Con qué algoritmo?
3. ¿Dónde se generan los 6 números del código de la verificación en dos pasos?
4. ¿Dónde se manda ese código por email?
5. ¿Dónde se termina el login cuando la persona escribe el código del segundo paso?
6. ¿Dónde se bloquea una cuenta después de varios intentos fallidos?
7. ¿Dónde se crea (firma) el token JWT de la sesión? ¿Y dónde se verifica?
8. ¿Cómo hace la app para no pedirte la contraseña cada vez que la abrís?
9. ¿Dónde está el login con Google?
10. ¿Dónde se impide entrar a las pantallas internas sin haber iniciado sesión?

### Permisos y protecciones de la API

11. ¿Dónde se controla que un usuario tenga permiso para hacer algo (ver, crear, aprobar)?
12. ¿Cómo se logra que un jefe vea solo lo de su área?
13. ¿Dónde se validan los datos que llegan a la API?
14. ¿Dónde está el límite de pedidos por minuto (para frenar ataques)?
15. ¿Dónde se ponen las cabeceras de seguridad y la protección contra CSRF?
16. ¿Dónde se guarda quién hizo cada acción (auditoría)?
17. ¿Cómo se evita la inyección SQL?
18. ¿Dónde se usan transacciones (que se guarde todo o nada)?
19. ¿Dónde se generan los números tipo OT-2026-0001?

### Tareas y producción

20. ¿Dónde se crea una tarea nueva?
21. ¿Dónde se asigna una tarea a un empleado? ¿Dónde se controla que sea de esa área?
22. ¿Dónde se registra que el empleado empezó y terminó una tarea (las horas)?
23. ¿Dónde aprueba el jefe el trabajo terminado?
24. ¿Dónde se suben las fotos del trabajo? ¿Cómo se controla que sea una imagen de verdad?

### Personas y RRHH

25. ¿Dónde pide un empleado una licencia?
26. ¿Dónde se aprueba una licencia?
27. ¿Dónde se ficha la entrada y la salida?
28. ¿Dónde habilita el administrador a alguien que pidió acceso? ¿Dónde se le crea el legajo?
29. ¿Dónde se borra un usuario?

### Códigos QR

30. ¿Dónde se genera el código QR de una máquina?
31. ¿Qué texto lleva adentro el QR y dónde se arma?
32. ¿Dónde se escanea un QR con la cámara?
33. ¿Dónde decide la API si el código escaneado es una máquina, una pieza o una orden?

### Inventario, compras, ventas y finanzas

34. ¿Dónde se suma el stock cuando llega una orden de compra?
35. ¿Dónde se reporta la falla de una máquina?
36. ¿Dónde se aprueba un presupuesto? ¿Qué pasa al aprobarlo?
37. ¿Dónde se hace la inspección de calidad?
38. ¿Dónde se calcula la liquidación de sueldos?
39. ¿Dónde se descarga la planilla CSV de la liquidación?
40. ¿De dónde salen los números del tablero de gerencia?

### Inicio e interfaz

41. ¿Dónde se publica un aviso en el tablón?
42. ¿Dónde está el buscador general?
43. ¿Cómo se actualiza sola la pantalla cuando otra persona cambia algo?
44. ¿Dónde está el calendario para elegir fechas?
45. ¿Dónde se cambia entre modo claro y oscuro?
46. ¿Dónde se llama a la API desde la app (la función que usan todas las pantallas)?
47. ¿Dónde se guarda el estado global de la sesión (quién está conectado)?

### Base de datos

48. ¿Dónde se crean las tablas?
49. ¿Dónde se ve que el stock nunca puede ser negativo?
50. ¿Dónde se cargan los datos de prueba (los 30 empleados)?

---

## Respuestas

**1.** `backend/src/services/auth.js` → `login()`, línea 129 (compara la contraseña con `bcrypt.compare` en la línea 140). La ruta es `routes/auth.js` línea 23 (`POST /auth/login`). La pantalla es `app/(auth)/login.tsx`.

**2.** `services/auth.js` → `registrar()`, línea 103; la contraseña se encripta con `bcrypt.hash` en la línea 105, con costo 12 (línea 14). bcrypt es un hash lento y con sal: no se puede revertir.

**3.** `services/codigos.js` → `generarCodigo()`, línea 18. El número sale de `crypto.randomInt` (línea 29), que es aleatorio y seguro. En la base se guarda solo su hash; se compara en `verificarCodigo()` (línea 42).

**4.** `services/email.js` → `enviarCodigo()`, línea 139 (sale por la API de Brevo, `enviarPorBrevo()`, línea 43).

**5.** `services/dosPasos.js` → `completarLogin()`, línea 112. La ruta es `routes/auth.js` línea 99 y la pantalla `app/dos-pasos.tsx`.

**6.** `services/intentos.js` → `exigirNoBloqueado()` (línea 31) y `registrarFallo()` (línea 37). Bloquea 15 minutos.

**7.** `services/tokens.js` → `firmarAcceso()` (línea 20) lo crea; `verificarAcceso()` (línea 31) lo verifica aceptando solo HS256. El middleware que lo exige en cada ruta es `middlewares/auth.js` → `autenticar()` (línea 7).

**8.** El refresh token se guarda cifrado en el teléfono con SecureStore (`mobile/src/lib/almacen.ts`, línea 36). Cuando el token de acceso vence, `lib/api.ts` → `renovarSesion()` (línea 118) pide uno nuevo, y la API lo rota en `services/tokens.js` → `rotarRefresh()` (línea 118).

**9.** Botón: `componentes/BotonesSociales.tsx`; inicio del ingreso: `lib/social.ts` → `iniciarIngreso()` (línea 90). En la API: `services/social.js` → `loginSocial()` (línea 223), y el perfil de Google se valida en `perfilGoogle()` (línea 70).

**10.** `mobile/src/app/_layout.tsx`, líneas 65 a 79: `Stack.Protected` muestra cada grupo de pantallas solo si hay sesión (y si no, redirige al login).

**11.** `middlewares/permisos.js` → `requierePermiso()` (línea 10), que se pone en cada ruta (por ejemplo `requierePermiso('TAR', 'aprobar')`). El cálculo está en `services/permisos.js` → `resolverPermiso()` (línea 47), con la tabla `permisos_rol`.

**12.** `services/permisos.js` → `filtroAlcance()` (línea 98) arma el filtro por área, y cada servicio lo aplica en su `condicionAlcance()` (por ejemplo `services/tareas.js` línea 46).

**13.** `middlewares/validar.js` → `validar()` (línea 5), con esquemas **zod** de la carpeta `validators/`. Por ejemplo, `validators/comunes.js`: `email` (línea 28) y `nombrePersona` (línea 40).

**14.** `middlewares/limites.js`: general (línea 26), login (línea 31) y registro (línea 34).

**15.** `middlewares/seguridad.js`: `cabeceras` con helmet y CSP (línea 8) y `exigirJson()` contra CSRF (línea 39).

**16.** `services/auditoria.js` → `auditar()` (línea 10), que escribe en la tabla `auditoria`.

**17.** Todas las consultas usan parámetros `?` a través de `config/db.js` → `query()` (línea 29): los datos nunca se pegan dentro del SQL.

**18.** `config/db.js` → `transaccion()` (línea 44). Se usa, por ejemplo, al recibir una compra o al crear una tarea.

**19.** `utils/secuencias.js` → `siguienteNumero()` (línea 4), con la tabla `secuencias`.

**20.** Pantalla `app/(app)/modulos/tareas/nueva.tsx` → ruta `routes/produccion.js` línea 44 → `services/tareas.js` → `crear()` (línea 217).

**21.** Diálogo `componentes/DetalleTarea.tsx` → `DialogoAsignar()` (línea 36) → ruta `routes/produccion.js` línea 55 → `services/tareas.js` → `asignar()` (línea 419). Que la persona sea del área y tenga la habilidad se controla en `validarAsignable()` (línea 392).

**22.** `services/tareas.js` → `iniciar()` (línea 483), `pausar()` (línea 503) y `terminar()` (línea 517). Las rutas están en `routes/produccion.js`, líneas 64, 67 y 70.

**23.** `services/tareas.js` → `aprobar()` (línea 549); rechazar está en `rechazar()` (línea 558).

**24.** `componentes/Fotos.tsx` (abre la cámara en la línea 71) → `services/adjuntos.js` → `subir()` (línea 104). Que sea una imagen real se comprueba mirando los primeros bytes del archivo en `detectarTipo()` (línea 56), no confiando en la extensión.

**25.** Pantalla `app/(app)/modulos/rrhh/licencias.tsx` → ruta `routes/rrhh.js` línea 134 → `services/licencias.js` → `solicitar()` (línea 29).

**26.** `services/licencias.js` → `aprobar()` (línea 136). Se aprueba desde `modulos/rrhh/aprobaciones.tsx` o desde Pendientes en Inicio.

**27.** `componentes/Fichaje.tsx` → `services/asistencias.js` → `ficharEntrada()` (línea 34) y `ficharSalida()` (línea 45).

**28.** Pantalla `app/(app)/modulos/usuarios/solicitudes.tsx` → ruta `routes/usuarios.js` línea 282 (`/habilitar`). El legajo se crea en `services/legajos.js` → `crearLegajo()` (línea 134).

**29.** `routes/usuarios.js`, línea 252 (`DELETE /usuarios/:id`), con permiso `SEG borrar`.

**30.** `mobile/src/componentes/EtiquetaQR.tsx`, línea 38: `<QRCode value={enlaceDeCodigo(codigo)}>` (librería `react-native-qrcode-svg`). La ficha de la máquina la usa en `modulos/mantenimiento/maquina/[id].tsx`, línea 76.

**31.** `mobile/src/lib/qr.ts` → `enlaceDeCodigo()` (línea 11): un enlace a la web con el código interno, por ejemplo `.../qr?c=BC:MAQ:CNC-02`.

**32.** `componentes/Escaner.tsx`: `abrirLector()` (línea 66) abre el lector del sistema y `resolver()` (línea 75) procesa lo leído. Que el QR sea nuestro se valida en `lib/qr.ts` → `codigoDeQR()` (línea 16).

**33.** Ruta `routes/inventario.js` línea 50 (`GET /escaneo`) → `services/escaneo.js` → `resolver()` (línea 61).

**34.** `services/compras.js` → `recibir()` (línea 275), que suma al stock con `stock.ingresar()` y deja el movimiento registrado.

**35.** Pantalla `app/(app)/modulos/mantenimiento/nueva.tsx` → `services/mantenimiento.js` → `crear()` (línea 133).

**36.** `services/ventas.js` → `aprobarPresupuesto()` (línea 333). Al aprobarlo se crea automáticamente la orden de trabajo.

**37.** Pantalla `app/(app)/modulos/calidad/inspeccionar/[otId].tsx` → `services/calidad.js` → `inspeccionar()` (línea 96).

**38.** `services/liquidacion.js` → `liquidar()` (línea 143); el cálculo de cada persona está en `calcularEmpleado()` (línea 49).

**39.** `app/(app)/modulos/finanzas/liquidacion.tsx`, línea 187 → `lib/archivos.ts` → `descargarCsv()` (línea 29). En el teléfono abre "Compartir" para guardarla o mandarla.

**40.** `services/tablero.js` → `obtener()` (línea 89), que junta producción, ventas, calidad, mantenimiento, inventario y facturación. La ruta es `routes/finanzas.js` línea 40.

**41.** `componentes/Tablon.tsx` → `Tablon()` (línea 113) → ruta `routes/inicio.js` línea 71 (`POST /tablon`).

**42.** Pantalla `app/(app)/buscar.tsx` → `routes/buscar.js` línea 78 (busca solo en lo que el rol puede ver).

**43.** `mobile/src/lib/cambios.ts` → `VigiaCambios()` (línea 53) pregunta cada 15 segundos a `GET /cambios` (`routes/inicio.js` línea 123) si hubo cambios, y recarga lo que estás mirando.

**44.** `mobile/src/componentes/CampoFecha.tsx`, línea 53: muestra DD/MM/AAAA y guarda AAAA-MM-DD.

**45.** `mobile/src/tema.tsx` → `TemaProvider()` (línea 106) y el botón en `componentes/SelectorTema.tsx`.

**46.** `mobile/src/lib/api.ts` → `api()` (línea 149): agrega el token, convierte los errores y renueva la sesión si venció.

**47.** `mobile/src/contexto/sesion.tsx` → `SesionProvider()` (línea 40), con Context API y `useReducer`.

**48.** `backend/db/schema.sql` (por módulo, comentado). Las tablas agregadas después están en `backend/scripts/migraciones.js`.

**49.** `backend/db/schema.sql`, línea 485: `CHECK (cantidad >= 0)` en la tabla `stock`.

**50.** `backend/scripts/seed.js` (los datos fijos, como roles y áreas, están en `backend/db/seed.sql`).
