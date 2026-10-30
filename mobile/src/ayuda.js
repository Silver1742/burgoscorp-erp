// Guía rápida que se ve en la app (Perfil → Ayuda). Es un resumen del manual de usuario
// (docs/manual-de-usuario.md): cada tema dice para qué roles es, y la pantalla muestra primero los
// del rol de quien la abre. `roles` vacío = para todos.

export const TEMAS_AYUDA = [
  {
    id: 'empezar', titulo: 'Entrar por primera vez', icono: 'log-in-outline', roles: [],
    pasos: [
      'En la pantalla de ingreso tocá "Pedí acceso" y completá tus datos.',
      'Tu cuenta queda pendiente: un administrador la revisa y la habilita. Te avisamos por email.',
      'La primera vez que entrás te mandamos un código de 6 dígitos al email para confirmarlo.',
      'Si un administrador te creó la cuenta, te llega un email "Creá tu contraseña": tocá "¿Olvidaste tu contraseña?" → "Ya tengo un código".',
    ],
  },
  {
    id: 'moverse', titulo: 'Cómo moverse en la app', icono: 'compass-outline', roles: [],
    pasos: [
      'Abajo tenés cuatro pestañas: Inicio, Mis tareas, Módulos y Perfil.',
      'En Inicio, "¿Qué querés hacer?" te lleva directo a lo que más usás según tu rol.',
      'Arriba a la derecha está el botón del QR: escaneá la etiqueta de una OT, una máquina o un material.',
      'La campanita muestra tus avisos (aprobaciones, tareas nuevas, solicitudes).',
      'Si la primera vez tarda unos segundos en cargar, es normal: el servidor gratuito se "despierta".',
    ],
  },
  {
    id: 'tareas', titulo: 'Mis tareas', icono: 'checkbox-outline', roles: ['EMPLEADO', 'JEFE'],
    pasos: [
      'En "Mis tareas" están las tareas que te asignaron, primero las más urgentes.',
      'Entrá a una y tocá "Iniciar": empieza a contar el tiempo. Si parás, "Pausar"; para seguir, "Reanudar".',
      'Marcá la lista de control, sacá fotos del trabajo y dejá comentarios si hace falta.',
      'Cuando terminás, tocá "Terminar": tu jefe la revisa y la aprueba o te la devuelve con un motivo.',
    ],
  },
  {
    id: 'fichaje', titulo: 'Fichar entrada y salida', icono: 'time-outline', roles: ['EMPLEADO', 'JEFE'],
    pasos: [
      'En Inicio está la tarjeta "Fichaje".',
      'Al llegar tocá "Registrar entrada"; al irte, "Registrar salida".',
    ],
  },
  {
    id: 'licencias', titulo: 'Pedir licencia o vacaciones', icono: 'airplane-outline', roles: ['EMPLEADO', 'JEFE'],
    pasos: [
      'Módulos → Recursos humanos → "Mis licencias y vacaciones" (o "Pedir licencia" en Inicio).',
      'Elegí el tipo y las fechas, y tocá "Enviar solicitud". Si es por enfermedad, adjuntá el certificado con una foto.',
      'La aprueba tu jefe y después RRHH. Te llega un aviso con el resultado.',
    ],
  },
  {
    id: 'escanear', titulo: 'Escanear un QR', icono: 'qr-code-outline', roles: [],
    pasos: [
      'Tocá el botón del QR arriba a la derecha y permití usar la cámara.',
      'Apuntá a la etiqueta: se abre la orden de trabajo, la máquina, el material o la orden de compra.',
      'Si la cámara no lee, podés escribir el código a mano.',
      'También anda con la cámara común del teléfono: la etiqueta abre la web y, si no entraste, te pide iniciar sesión.',
    ],
  },
  {
    id: 'falla', titulo: 'Reportar una falla de máquina', icono: 'warning-outline', roles: ['EMPLEADO', 'JEFE'],
    pasos: [
      'Escaneá el QR de la máquina o entrá a Módulos → Mantenimiento → "Reportar una falla".',
      'Contá qué pasa, sacá una foto y decí si la máquina está parada. Mantenimiento recibe el aviso.',
    ],
  },
  {
    id: 'jefe', titulo: 'Si sos jefe de área', icono: 'id-card-outline', roles: ['JEFE'],
    pasos: [
      '"Asignar tarea": creá la tarea y elegí a alguien con la habilidad necesaria.',
      'Si te llega "Tarea para asignar" (del administrador o de una OT de otra área), abrila y tocá "Asignar".',
      'Si sos jefe de Ingeniería, te llega cada pedido nuevo: asignalo en "Analiza" o desde Ventas → Para asignar.',
      'En "Tareas del área" aprobás o rechazás las tareas terminadas.',
      '"Aprobar licencias": aceptá o rechazá los pedidos de tu equipo.',
      'Desde una orden de trabajo podés reservar material y pedir compras. Una compra la aprueba otra persona, nunca quien la pidió.',
      'El tablero te muestra los números de tu área.',
    ],
  },
  {
    id: 'ventas', titulo: 'Ventas: del pedido a la orden de trabajo', icono: 'briefcase-outline', roles: ['JEFE', 'EMPLEADO'],
    pasos: [
      '"Nuevo pedido": elegí el cliente, contá qué necesita y sacá fotos de la pieza.',
      'El pedido le llega solo al jefe de Ingeniería, que lo asigna a alguien de su equipo para presupuestarlo.',
      'Desde el pedido, "Presupuestar": cargá el trabajo de las máquinas y los materiales.',
      'Cuando el cliente acepta el presupuesto, se crea sola la orden de trabajo para producción.',
    ],
  },
  {
    id: 'calidad', titulo: 'Calidad: inspeccionar una pieza', icono: 'ribbon-outline', roles: ['JEFE', 'EMPLEADO'],
    pasos: [
      'Módulos → Calidad → "Para inspeccionar".',
      'Cargá las mediciones con sus tolerancias y el resultado. Si no pasa, se genera un retrabajo.',
    ],
  },
  {
    id: 'sueldos', titulo: 'Liquidación de sueldos (Administración)', icono: 'wallet-outline', roles: ['ADMIN', 'GERENCIA'],
    pasos: [
      'Módulos → Finanzas → "Liquidación de sueldos" (la ve Administración y Finanzas, gerencia y el administrador).',
      'Elegí el período (este mes, quincena, mes pasado o fechas) y, si querés, un área.',
      'Ves llegadas tarde, horas trabajadas, horas extra, ausencias sin justificar y el total a pagar de cada persona.',
      'Tocá una persona para ver el cálculo y sus días; "Descargar planilla" baja el archivo para Excel.',
      'La hora de entrada, la tolerancia y los recargos se cambian con "Cambiar".',
    ],
  },
  {
    id: 'gerencia', titulo: 'Si sos de gerencia', icono: 'stats-chart-outline', roles: ['GERENCIA'],
    pasos: [
      'Podés ver todos los módulos, pero no modificar nada.',
      'El "Tablero" resume ventas, producción, compras, calidad y finanzas de toda la empresa.',
    ],
  },
  {
    id: 'admin', titulo: 'Administrar usuarios', icono: 'people-outline', roles: ['ADMIN'],
    pasos: [
      '"Asignar tarea": elegí a qué área va (la app sugiere una por la máquina o la habilidad). El jefe de esa área recibe el aviso y la asigna a alguien de su equipo.',
      '"Solicitudes de acceso": revisá quién pidió entrar y elegí su rol, área, puesto y habilidades.',
      'Tocá "Habilitar": el legajo se crea solo. Si no corresponde, "Rechazar" con un motivo.',
      '"Personal": cuántas personas trabajan, quién vino hoy y cada área con su jefe.',
      '"Usuarios": buscá por nombre, email o legajo, y filtrá por estado o rol.',
      'En la ficha de cada usuario: editar nombre o rol; cambiar área, puesto y habilidades; mandarle un código para crear su contraseña; dar de baja o reactivar.',
      'Eliminar solo se puede con cuentas sin actividad; si tiene historia, dala de baja.',
    ],
  },
  {
    id: 'seguridad', titulo: 'Proteger tu cuenta', icono: 'shield-checkmark-outline', roles: [],
    pasos: [
      'Perfil → "Verificación en dos pasos" → "Mandarme el código": escribí el código que te llega al email y queda activada.',
      'Desde ahí, cada vez que entrás con tu contraseña te llega un código al email para terminar de entrar.',
      'Si perdiste el teléfono, Perfil → "Cerrar sesión en todos los dispositivos".',
    ],
  },
  {
    id: 'problemas', titulo: 'Problemas comunes', icono: 'help-buoy-outline', roles: [],
    pasos: [
      '"No veo ningún módulo": tu cuenta todavía no tiene área. Pedile a un administrador que te la asigne.',
      '"Olvidé mi contraseña": en el ingreso, "¿Olvidaste tu contraseña?". Te llega un código por email.',
      '"No me llega el email": revisá Spam. El código vence a los 10 minutos.',
      '"Tarda en cargar": la primera consulta del día puede tardar unos 30 segundos.',
      'Si un formulario no se guarda, el campo con problema queda en rojo y el aviso dice cuál es.',
    ],
  },
];
