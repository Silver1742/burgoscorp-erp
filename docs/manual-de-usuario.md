# Manual de usuario · BurgosCorp ERP

Guía simple para usar el sistema desde el celular o el navegador. La misma guía, resumida, está
dentro de la app en **Perfil → Ayuda** (y en Inicio, "¿Cómo se usa?").

| Dónde | Dirección |
|---|---|
| En el navegador | <https://burgoscorp-erp.onrender.com> |
| En el celular (Android) | El APK que te pasa el administrador. Al instalarlo, permití "instalar apps de origen desconocido". |

> **La primera vez del día puede tardar unos 30 segundos** en cargar: el servidor es gratuito y se
> "despierta" con el primer uso. Después anda normal.

---

## 1. Entrar al sistema

### Si no tenés cuenta
1. En la pantalla de ingreso tocá **"Pedí acceso"**.
2. Completá nombre, apellido, email y una contraseña (10 caracteres o más, con letras y números).
3. Tu cuenta queda **pendiente**. Un administrador la revisa y la habilita; **te avisamos por email**
   y en ese correo te llega **este manual en PDF**.
4. Cuando entres por primera vez te llega un **código de 6 dígitos** al email para confirmarlo.

### Con Google, GitHub o Discord
En el ingreso tocá **"Ingresar con Google"** (o GitHub, o Discord) y elegí tu cuenta. La primera
vez tu cuenta queda **pendiente** hasta que un administrador la habilita, igual que con "Pedí
acceso". Desde el celular se abre el navegador para elegir la cuenta y después vuelve a la app.

### Si el administrador te creó la cuenta
Te llega un email **"Creá tu contraseña"** con un código. En la app tocá
**"¿Olvidaste tu contraseña?" → "Ya tengo un código"** y escribí tu email, el código y tu nueva
contraseña. El código vence a los 10 minutos.

### Si te olvidaste la contraseña
**"¿Olvidaste tu contraseña?"** → escribí tu email → te llega un código → escribilo junto con la
contraseña nueva.

### Cuentas de prueba (una por rol)
Para mostrar el sistema sin usar cuentas reales:

| Rol | Email | Qué ve |
|---|---|---|
| Administrador | `admin@burgoscorp.test` | Todo, usuarios y tareas para mandar a las áreas |
| Gerencia | `gerencia@burgoscorp.test` | Todos los módulos, sin modificar |
| Jefe de área | `jefe@burgoscorp.test` | Mecanizado: asigna y aprueba tareas, aprueba licencias |
| Empleado | `empleado@burgoscorp.test` | Mecanizado (tornero): sus tareas, fichaje y licencias |

La contraseña de las tres últimas es la que se cargó en `PASSWORD_PRUEBA` en Render.

---

## 2. La pantalla de la app

| Parte | Para qué |
|---|---|
| **Inicio** | Saludo, **"¿Qué querés hacer?"** con botones a lo que más usás, fichaje, resumen y avisos. |
| **Mis tareas** | Las tareas que te asignaron. |
| **Módulos** | Todas las áreas del sistema que tu rol puede ver. |
| **Perfil** | Tus datos, verificación en dos pasos, avisos, **Ayuda**, modo claro/oscuro y cerrar sesión. |
| Botón **QR** (arriba) | Escanear la etiqueta de una orden de trabajo, máquina, material u orden de compra. |
| **Campanita** (arriba) | Tus avisos: tareas nuevas, aprobaciones, solicitudes. |

Los resultados de cada acción aparecen como un cartelito abajo de la pantalla (verde si salió
bien, rojo si hubo un problema). Antes de algo que no se puede deshacer, la app te pide confirmar.

---

## 3. Qué puede hacer cada rol

| Rol | Puede |
|---|---|
| **Empleado** | Ver y avanzar **sus tareas**, fichar, pedir licencias, ver su legajo, reportar fallas, escanear QR y cargar datos en los módulos de su área. |
| **Jefe de área** | Todo lo del empleado, y además **asignar tareas**, aprobar las tareas terminadas y las **licencias** de su equipo, manejar las órdenes de trabajo de su área, pedir y aprobar compras, ver el tablero de su área. |
| **Gerencia** | **Ver todo** (todos los módulos y el tablero de la empresa) sin modificar nada. |
| **Administrador** | Todo, más **usuarios**: habilitar solicitudes, crear cuentas, editarlas, darlas de baja. |

Si entrás y **no ves ningún módulo**, tu cuenta todavía no tiene área: pedíselo a un
administrador.

El **legajo** es tu ficha como empleado (número, área, puesto, jefe y habilidades). Se crea solo
cuando el administrador habilita tu cuenta. El detalle de qué puede hacer cada área y cada
habilidad está en [capacidades-por-area.md](capacidades-por-area.md).

---

## 4. Tareas del día a día

### Mis tareas
1. Abrí **Mis tareas** (abajo) y entrá a una tarea.
2. Tocá **Iniciar**: empieza a contar el tiempo. Para frenar, **Pausar**; para seguir, **Reanudar**.
3. Marcá la **lista de control**, sacá **fotos del trabajo** y dejá **comentarios** si hace falta.
4. Al terminar, **Terminar**. Tu jefe la aprueba o te la devuelve con un motivo.

### Fichar
En **Inicio**, tarjeta **Fichaje**: **Registrar entrada** al llegar y **Registrar salida** al irte.

### Pedir licencia o vacaciones
1. **Inicio → Pedir licencia** (o Módulos → Recursos humanos → Mis licencias y vacaciones).
2. Elegí tipo y fechas → **Enviar solicitud**. Si es por enfermedad, adjuntá el certificado con una foto.
3. La aprueba tu jefe y después RRHH. Te llega un aviso con el resultado.

### Escanear un QR
Botón **QR** arriba → permití la cámara → apuntá a la etiqueta. Se abre lo que corresponde
(orden de trabajo, máquina, material, orden de compra). Si no lee, escribí el código a mano.

También sirve **la cámara común del teléfono**: la etiqueta es un enlace a la web de BurgosCorp.
Si no entraste, te pide iniciar sesión y después abre la máquina o la pieza.

### Reportar una falla de máquina
Escaneá el QR de la máquina o **Inicio → Reportar falla**. Contá qué pasa, sacá una foto y
marcá si la máquina quedó parada. Mantenimiento recibe el aviso.

---

## 5. Para jefes de área

- **Asignar tarea**: creá la tarea y elegí a alguien con la habilidad necesaria.
- **Tareas que te llegan**: del administrador, o de una orden de trabajo de otra área que usa
  máquinas tuyas. Te llega el aviso *"Tarea para asignar"*: tocalo (o entrá a **Tareas del área →
  Para asignar**) y asignala a alguien de tu equipo con **Asignar**.
- **Jefe de Ingeniería**: te llega cada **pedido nuevo** de los clientes. Asignalo a alguien de tu
  equipo en **"Analiza"** (o desde **Ventas → Para asignar**).
- **Tareas del área**: aprobá o rechazá (con motivo) las tareas terminadas.
- **Aprobar licencias**: aceptá o rechazá los pedidos de tu equipo.
- **Órdenes de trabajo**: desde una OT podés reservar material y **pedir compras**.
  Una compra la aprueba otra persona, nunca quien la pidió.
- **Tablero**: los números de tu área.

## 6. Ventas, producción y calidad (el recorrido de un pedido)

1. **Nuevo pedido** (Comercial, en Ventas): cliente, qué necesita y fotos de la pieza.
2. **Le llega solo al jefe de Ingeniería** (aviso *"Pedido nuevo para asignar"*). El jefe lo abre
   (o entra a **Ventas → Para asignar**) y en **"Analiza"** elige a alguien de su equipo; primero
   aparecen los que tienen menos pedidos abiertos.
3. Esa persona **presupuesta** (horas de máquina y materiales) y lo manda al cliente.
4. Si el cliente acepta, **"Aceptado: crear OT"**: se crea sola la orden de trabajo con sus
   operaciones y materiales.
5. **A cada jefe le llegan las tareas de su área**: el del área de la OT recibe *"Nueva OT"*, y si
   hay operaciones en máquinas de otra área, a ese jefe le llega *"Tareas para tu área"*. Cada jefe
   las asigna a su equipo; nadie de afuera asigna gente de otra área.
6. Producción trabaja las tareas y el jefe las aprueba.
7. **Calidad → Para inspeccionar**: se cargan las mediciones. Si no pasa, se genera un retrabajo.
8. **Finanzas**: factura y cobro.

## 7. Liquidación de sueldos (Administración y Finanzas)

**Módulos → Finanzas → Liquidación de sueldos** (o **Sueldos** en Inicio). La ven Administración y
Finanzas, gerencia y el administrador; la jornada solo la cambia Administración.

1. Elegí el **período**: este mes, la quincena, el mes pasado o las fechas que quieras (hasta 62 días),
   y si querés, un **área**.
2. Arriba ves el total de **llegadas tarde**, **horas trabajadas**, **horas extra**, **ausencias sin
   justificar** y el **total a pagar**.
3. Abajo, cada persona con sus tardanzas, extras, ausencias y su total. **Tocala** para ver el
   cálculo y el detalle **día por día** (a qué hora entró y salió).
4. **Descargar planilla**: baja un archivo que abre Excel con el resumen de sueldos de todos (en el
   teléfono se abre el menú para guardarlo o mandarlo). En el detalle de una persona también podés
   descargar sus días.

**Cómo se calcula** (la jornada se cambia con **Cambiar**: hora de entrada, tolerancia, horas por
día y recargos):

| Concepto | Regla |
|---|---|
| Llegada tarde | Entró después de la hora de entrada + la tolerancia (por defecto 08:00 + 10 min) |
| Sueldo base | Días hábiles del período × horas de la jornada × valor hora del legajo |
| Horas extra | Lo trabajado de más en un día hábil (+50 %) y todo lo del fin de semana (+100 %), en bloques de media hora |
| Horas faltantes | Lo que faltó para completar la jornada en un día trabajado: se descuenta |
| Ausencia sin justificar | Día hábil sin fichaje y sin licencia aprobada: se descuenta la jornada |
| Licencia aprobada | Se paga como día trabajado |

No incluye feriados, aportes ni retenciones (es el resumen para liquidar, no el recibo legal).

## 8. Para gerencia

Todo se puede consultar y nada se modifica. El **Tablero** resume ventas, producción, compras,
calidad y finanzas de toda la empresa.

---

## 9. Para el administrador: tareas

El administrador **no asigna personas**: manda la tarea al área y la asigna el **jefe de esa área**,
que conoce a su equipo.

1. **Módulos → Tareas → Nueva tarea** (o **Asignar tarea** en Inicio). Escribí qué hay que hacer.
2. Si elegís una **máquina**, la tarea va al área de la máquina. Si elegís una **habilidad**, la app
   **sugiere** el área que más gente tiene con esa habilidad vigente.
3. En **"¿A qué área va?"** confirmá la sugerencia o elegí otras. Cada área muestra quién la va a
   asignar y cuántas personas pueden hacerla. **Todas las áreas** manda una copia a cada una (ej.
   "Orden y limpieza 5S").
4. Tocá **Enviar al jefe**: se crea una tarea por área y a cada jefe le llega el aviso.

Si un área **no tiene jefe**, la tarea la asignás vos desde su ficha.

## 10. Para el administrador: usuarios

Todo está en **Módulos → Usuarios** (o el botón **Usuarios** en Inicio).

### Solicitudes de acceso
Cuando alguien pide entrar, en Inicio aparece **"Hay N personas esperando acceso"**.
1. Tocá **Habilitar** en la solicitud. Arriba ves quién es: su email, cómo pidió acceso y cuándo.
2. Elegí el **rol** y **dónde va a trabajar**: el **área**, el **puesto** y sus **habilidades**
   (primero aparecen las de esa área) con el nivel de cada una.
3. Tocá **Habilitar**: se le **crea el legajo solo**, con el número siguiente y el jefe del área
   como supervisor. Si es jefe y el área no tiene jefe, queda a cargo. Le llega un email avisándole.
4. Si RRHH ya le había cargado el legajo, marcá **"RRHH ya le cargó el legajo"** y elegilo: la app
   avisa si el nombre o el email no coinciden y no deja usar uno que ya tiene cuenta.
5. Si no corresponde: **Rechazar**, con un motivo opcional (también le llega por email).

### Lista de usuarios
- **Buscar** por nombre, email o legajo.
- **Filtrar** por estado (Activos, Pendientes, De baja, Rechazados) y por rol.
- Tocá una persona para ver su **ficha**: legajo, área, puesto, cómo entra, último ingreso.

### Acciones en la ficha
| Acción | Qué hace |
|---|---|
| **Editar nombre o rol** | Cambia nombre, apellido o rol. Si cambia el rol, se cierran sus sesiones. |
| **Área, puesto y habilidades** | Lo cambia de área o de puesto y le agrega o quita habilidades. Si no tenía legajo, se le crea. |
| **Mandarle un código para crear su contraseña** | Le llega un email con un código. Vos nunca ves su contraseña. |
| **Dar de baja** | No puede entrar más y se cierran sus sesiones. Su historia se conserva. Se puede **Reactivar**. |
| **Eliminar** | Borra la cuenta del todo. Solo si **no tiene actividad** (si la tiene, dala de baja). |

### Nuevo usuario
**Usuarios → Nuevo**: nombre, apellido, email y rol; después **área, puesto y habilidades** (el
legajo se crea solo). Dejá marcado **"Mandarle un email…"** para que cree su contraseña.

### Personal
**Recursos humanos → Personal** (o la tarjeta de Inicio): cuántas personas trabajan, cuántas
ficharon hoy y están trabajando, quién está de licencia, cada área con su jefe, y las **cuentas sin
área** para ubicarlas. Los jefes ven solo su área.

El **administrador del sistema no pertenece a ningún área** ni lleva legajo: ve y administra todo.
Al habilitar o crear a alguien con el rol Administrador no se le pide área.

No podés cambiarte el rol, darte de baja ni eliminarte a vos mismo, y el sistema nunca queda sin
un administrador activo.

---

## 11. Seguridad de tu cuenta

- **Perfil → Verificación en dos pasos**: tocá **"Mandarme el código"**, escribí el código que te
  llega al email y queda activada. Desde ahí, cada vez que ingresás con tu contraseña te llega un
  código nuevo al email para terminar de entrar (vence en 10 minutos; si no lo ves, revisá Spam).
- Para desactivarla te pedimos otro código del email y tu contraseña.
- Si perdiste el celular: **Perfil → Cerrar sesión en todos los dispositivos**.
- Después de varios intentos fallidos la cuenta se bloquea 15 minutos.

## 12. Problemas comunes

| Problema | Qué hacer |
|---|---|
| No veo ningún módulo | Tu cuenta no tiene área: pedile al administrador que te la asigne. |
| No me llega el email | Revisá **Spam**. Los códigos vencen a los 10 minutos: pedí otro. |
| "Tu cuenta está pendiente" | Un administrador todavía no la habilitó. |
| Tarda en cargar | La primera vez del día el servidor tarda unos 30 segundos en despertar. |
| No me llega el código para entrar | Revisá Spam. Si pasó un minuto, tocá **Reenviar código**. |
| La cámara no lee el QR | Más luz, más cerca, o escribí el código a mano. |
