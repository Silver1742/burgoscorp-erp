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
3. Tu cuenta queda **pendiente**. Un administrador la revisa y la habilita; **te avisamos por email**.
4. Cuando entres por primera vez te llega un **código de 6 dígitos** al email para confirmarlo.

### Si el administrador te creó la cuenta
Te llega un email **"Creá tu contraseña"** con un código. En la app tocá
**"¿Olvidaste tu contraseña?" → "Ya tengo un código"** y escribí tu email, el código y tu nueva
contraseña. El código vence a los 10 minutos.

### Si te olvidaste la contraseña
**"¿Olvidaste tu contraseña?"** → escribí tu email → te llega un código → escribilo junto con la
contraseña nueva.

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
- **Tareas del área**: aprobá o rechazá (con motivo) las tareas terminadas.
- **Aprobar licencias**: aceptá o rechazá los pedidos de tu equipo.
- **Órdenes de trabajo**: desde una OT podés reservar material y **pedir compras**.
  Una compra la aprueba otra persona, nunca quien la pidió.
- **Tablero**: los números de tu área.

## 6. Ventas, producción y calidad (el recorrido de un pedido)

1. **Nuevo pedido** (Ventas): cliente, qué necesita y fotos de la pieza.
2. **Presupuestar**: trabajo de máquinas y materiales. Se envía al cliente.
3. Si el cliente acepta, **se crea sola la orden de trabajo** con sus operaciones y materiales.
4. Producción trabaja la OT con tareas.
5. **Calidad → Para inspeccionar**: se cargan las mediciones. Si no pasa, se genera un retrabajo.
6. **Finanzas**: factura y cobro.

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

## 9. Para el administrador: usuarios

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

## 10. Seguridad de tu cuenta

- **Perfil → Verificación en dos pasos**: activala con Google Authenticator o con código por email.
  Guardá los **códigos de respaldo** en un lugar seguro.
- Si perdiste el celular: **Perfil → Cerrar sesión en todos los dispositivos**.
- Después de varios intentos fallidos la cuenta se bloquea 15 minutos.

## 11. Problemas comunes

| Problema | Qué hacer |
|---|---|
| No veo ningún módulo | Tu cuenta no tiene área: pedile al administrador que te la asigne. |
| No me llega el email | Revisá **Spam**. Los códigos vencen a los 10 minutos: pedí otro. |
| "Tu cuenta está pendiente" | Un administrador todavía no la habilitó. |
| Tarda en cargar | La primera vez del día el servidor tarda unos 30 segundos en despertar. |
| En el navegador, al recargar me pide entrar de nuevo | Es a propósito: por seguridad la sesión no se guarda en el navegador. |
| La cámara no lee el QR | Más luz, más cerca, o escribí el código a mano. |
