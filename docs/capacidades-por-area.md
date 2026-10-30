# Qué puede hacer cada persona en BurgosCorp ERP

Lo que alguien puede hacer en el sistema depende de tres cosas:

| | Qué define | Ejemplo |
|---|---|---|
| **Rol** | Cuánto puede hacer: ver, crear, aprobar | Un **jefe** aprueba licencias; un **empleado** las pide |
| **Área** (en su legajo) | En qué módulos puede cargar datos | Abastecimiento carga compras; Calidad, inspecciones |
| **Habilidades** (en su legajo) | Qué máquinas puede usar y qué tareas se le pueden asignar | Solo quien tiene *Soldadura TIG* vigente recibe tareas en la soldadora TIG |

## ¿Qué es un legajo?

Es la **ficha de la persona como empleado**: número (L0031), área, puesto, jefe, habilidades,
fecha de ingreso, costo por hora y datos de contacto. La **cuenta** es solo el usuario y la
contraseña para entrar; el **legajo** es lo que la ubica en la empresa. Sin legajo una cuenta entra
pero no ve ningún módulo, porque no se sabe a qué área pertenece.

**Cuando el administrador habilita a alguien (o le crea la cuenta) elige área, puesto y
habilidades, y el legajo se crea solo** con el número siguiente y con el jefe del área como
supervisor. Si RRHH ya había cargado el legajo antes (por ejemplo, un empleado de años que recién
ahora usa la app), se puede vincular ese en lugar de crear otro.

---

## 1. Acciones de la app y quién las hace

| Acción | Quién | Dónde |
|---|---|---|
| **Fichar** entrada y salida | Toda persona con legajo | Inicio → Fichaje |
| **Ver y avanzar sus tareas**: iniciar, pausar, terminar | Empleados y jefes | Mis tareas |
| **Sacar fotos del trabajo** en una tarea | Quien tiene la tarea asignada y su jefe | Tarea → Fotos del trabajo |
| **Escribir comentarios** y marcar la **lista de control** de una tarea | Quien tiene la tarea y su jefe | Tarea |
| **Pedir licencias y vacaciones** | Toda persona con legajo | Recursos humanos → Mis licencias |
| **Subir la foto del certificado** médico | Quien pide la licencia por enfermedad | La licencia |
| **Aprobar licencias** | Jefe del área, después RRHH | Recursos humanos → Aprobar licencias |
| **Escanear QR** de piezas, máquinas, materiales y órdenes de compra | Todos (cada uno ve lo que su rol permite) | Botón QR arriba, o la cámara del teléfono |
| **Reportar una falla** de máquina con **descripción y foto** | Todos | Mantenimiento → Reportar una falla, o el QR de la máquina |
| **Tomar un pedido de cliente** con la **descripción** de lo que necesita y **fotos de la pieza** | Comercial e Ingeniería | Ventas → Nueva solicitud |
| **Llamar o mandar WhatsApp** al cliente o proveedor | Quien ve el pedido o la compra | Botones de contacto |
| **Asignar un pedido nuevo** a quien lo analiza y presupuesta (le llega el aviso solo) | Jefe de Ingeniería (sin jefe: el administrador) | Ventas → Para asignar |
| **Presupuestar** (horas de máquina y materiales) | Comercial e Ingeniería | Ventas → Presupuestar |
| **Crear órdenes de trabajo** y **asignar tareas** según habilidades | Jefes de las áreas productivas | Producción / Tareas |
| **Mandar tareas a una o varias áreas** (la app sugiere el área por la máquina o la habilidad) | Administrador; las asigna el jefe de cada área | Tareas → Nueva tarea |
| **Reservar material** para una OT | Jefes de las áreas productivas | La OT → Materiales |
| **Registrar el material usado** | Quien trabaja la OT | La OT → Registrar material usado |
| **Hacer órdenes de compra** y **recibir mercadería** (con QR y foto del remito) | Abastecimiento; la aprueba otra persona, nunca quien la pidió | Compras |
| **Mover stock** (entradas, salidas, transferencias) | Abastecimiento | Inventario |
| **Inspeccionar** con **mediciones, tolerancias y fotos**; mandar a retrabajo | Calidad | Calidad → Para inspeccionar |
| **Resolver fallas** y planes preventivos, con fotos de la reparación y repuestos usados | Mantenimiento | Mantenimiento |
| **Facturar, cobrar y pagar**, con **foto o PDF** de la factura del proveedor | Administración y Finanzas | Finanzas |
| **Liquidar sueldos**: llegadas tarde, horas trabajadas, horas extra, faltantes y ausencias; **descargar la planilla** | Administración y Finanzas (y gerencia y el admin, para consultar) | Finanzas → Liquidación de sueldos |
| **Configurar la jornada** (hora de entrada, tolerancia, horas por día, recargos) | Administración y Finanzas | Liquidación → Cambiar |
| **Ver el tablero** | Todos: cada uno el suyo; jefes, su área; gerencia y admin, toda la empresa | Tablero |
| **Ver el personal** (cuántos son, quién vino hoy, por área) | Admin, gerencia (toda la empresa) y jefes (su área) | Recursos humanos → Personal |
| **Habilitar cuentas**, crear usuarios, cambiar área y habilidades, dar de baja | Administrador | Usuarios |

**Archivos que se pueden subir:** fotos (JPG, PNG, WEBP) y PDF. Se reconocen por su contenido,
no por el nombre, se les borra la ubicación GPS y tienen tope de tamaño y cantidad por día.

---

## 2. Por área

| Área | Qué hace en el sistema | Jefe (datos de prueba) |
|---|---|---|
| **Dirección** | Ve el tablero de toda la empresa | Ricardo Ferreyra (gerente general) |
| **Administración y Finanzas** | Facturas, cobros, pagos y comprobantes con foto/PDF; liquidación de sueldos con la planilla para descargar | Natalia Quiroga |
| **Recursos Humanos** | Legajos, habilidades y certificaciones, fichajes, aprobación final de licencias, EPP, organigrama | Carolina Méndez |
| **Comercial** | Clientes, pedidos con descripción y fotos, presupuestos, contacto por WhatsApp | Diego Acosta |
| **Ingeniería y Diseño** | Pedidos y presupuestos técnicos, planificación de órdenes de trabajo, diseño CAD | Sebastián Molina |
| **Mecanizado** | Órdenes de trabajo y tareas en tornos, CNC, corte y plegado | Jorge Domínguez |
| **Soldadura y Herrería** | Órdenes de trabajo y tareas de soldadura, herrería, pintura y servicio en planta | Marcelo Ibáñez |
| **Impresión 3D y Prototipos** | Órdenes de trabajo y tareas de impresión FDM, resina y maquetas | Camila Navarro |
| **Calidad** | Inspecciones con mediciones y fotos, no conformidades y retrabajos | Silvia Aguirre |
| **Mantenimiento** | Fallas, reparaciones con repuestos, planes preventivos | Oscar Figueroa |
| **Abastecimiento** | Proveedores, órdenes de compra, recepción de mercadería, stock y depósito | Mariana Ledesma |

**Todas las áreas**, además: fichar, sus tareas, licencias, escanear QR, reportar fallas, ver el
organigrama y consultar el stock.

---

## 3. Por habilidad

Las habilidades deciden **qué máquinas puede operar** alguien y **a quién se le puede asignar una
tarea**: al asignar, la app solo ofrece personas con la habilidad que pide la máquina. Las que dicen
**certificada** necesitan la fecha de vencimiento del certificado cargada por RRHH y vigente.

| Habilidad | Para qué sirve | Máquinas o trabajos | Área típica |
|---|---|---|---|
| Diseño CAD 2D/3D | Diseñar y modelar piezas | Estaciones de diseño DIS-01 y DIS-02 | Ingeniería, Impresión 3D |
| Ingeniería inversa y relevamiento | Medir y redibujar piezas que trae el cliente | Tareas de relevamiento | Ingeniería |
| Programación CAM / CNC | Preparar los programas de las máquinas CNC | Tareas de programación | Ingeniería |
| Impresión 3D FDM | Imprimir en filamento | Impresoras I3D-01 e I3D-02 | Impresión 3D |
| Impresión 3D en resina | Imprimir en resina | Impresora I3D-03 | Impresión 3D |
| Maquetismo y terminación | Terminar prototipos y maquetas | Tareas de terminación | Impresión 3D |
| Tornería convencional | Tornear piezas | Torno paralelo TOR-01 | Mecanizado |
| Operación de torno CNC | Operar el torno CNC | Torno CNC TOR-02 | Mecanizado |
| Operación de centro de mecanizado CNC | Fresar en CNC | CNC-01 y router CNC-02 | Mecanizado |
| Corte por plasma CNC | Cortar chapa | Mesa de plasma COR-01 | Mecanizado |
| Plegado de chapa | Plegar | Plegadora PLE-01 | Mecanizado |
| Soldadura MIG/MAG · **certificada** | Soldar con MIG | Soldadoras SOL-01 y SOL-02 | Soldadura |
| Soldadura TIG · **certificada** | Soldar con TIG | Soldadora SOL-03 | Soldadura |
| Herrería y estructuras | Armar estructuras | Banco de herrería HER-01 | Soldadura |
| Pintura industrial | Pintar piezas terminadas | Cabina de pintura TER-01 | Soldadura |
| Trabajo en altura · **certificada** | Trabajos en planta del cliente, en altura | Unidad de servicio SRV-01 | Soldadura, Mantenimiento |
| Metrología e inspección dimensional | Medir y aprobar piezas | Inspecciones de Calidad | Calidad |
| Mantenimiento mecánico | Reparar máquinas | Órdenes de mantenimiento | Mantenimiento |
| Mantenimiento eléctrico · **certificada** | Reparaciones eléctricas | Órdenes de mantenimiento | Mantenimiento |
| Manejo de autoelevador · **certificada** | Mover cargas en el depósito | Recepción y depósito | Abastecimiento |

El **banco de montaje MON-01** no pide ninguna habilidad: cualquiera del área puede trabajar ahí.

---

## 4. Por rol

| | Empleado | Jefe de área | Gerencia | Administrador |
|---|---|---|---|---|
| Sus tareas, fichaje, licencias, QR, reportar fallas | ✅ | ✅ | ✅ (sin modificar) | ✅ |
| Cargar datos en los módulos de su área | ✅ | ✅ | — | ✅ |
| Asignar tareas, aprobar tareas y licencias del equipo | — | ✅ | — | ✅ |
| Aprobar compras e inspecciones | — | ✅ (Abastecimiento y Calidad) | — | ✅ |
| Ver el personal y el tablero | El suyo | Su área | Toda la empresa | Toda la empresa |
| Ver todos los módulos | — | Los de su área y consultas | ✅ solo lectura | ✅ |
| Usuarios: habilitar, crear, editar, dar de baja | — | — | — | ✅ |

El **administrador del sistema** no pertenece a ningún área ni lleva legajo: administra todo desde
afuera de la estructura de la empresa.
