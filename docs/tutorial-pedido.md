# Tutorial · Un pedido de punta a punta

Este recorrido sigue **un pedido real del taller desde que llega hasta que se cobra**, pasando por
seis áreas y cambiando de cuenta en cada paso. Sirve para mostrar el sistema en la defensa: cada
persona ve y hace solo lo que le toca, y el trabajo pasa de un área a otra solo, con avisos.

**El ejemplo:** el cliente *Agro del Sur* necesita **un eje de transmisión mecanizado y una brida
soldada** para una cosechadora.

```
Comercial ─▶ Ingeniería ─▶ (cliente acepta) ─▶ OT ─▶ Mecanizado + Soldadura ─▶ Calidad ─▶ Finanzas
 Florencia    Sebastián       Florencia              Jorge/Ramón  Marcelo/Claudio  Leandro    Natalia
              Valentina
```

## Antes de empezar

- Las cuentas son las de ejemplo (`nombre.apellido@burgoscorp.test`). La contraseña es la de las
  cuentas de ejemplo: en tu compu, la de `SEED_PASSWORD` del `.env` del backend; en la web publicada,
  la que configuraste para las cuentas de prueba.
- Para cambiar de persona: **avatar (arriba a la derecha) → Cerrar sesión** y entrar con la otra.
  Más rápido: una persona en la web y otra en el celular, o dos navegadores (uno en incógnito).
- La **campana** de Inicio muestra los avisos; casi todos los pasos se abren desde ahí o desde
  **Pendientes**, sin buscar nada.

| Paso | Quién | Cuenta | Rol |
|---|---|---|---|
| 1 | Florencia Ríos | `florencia.rios@burgoscorp.test` | Empleada de Comercial |
| 2 | Sebastián Molina | `sebastian.molina@burgoscorp.test` | Jefe de Ingeniería |
| 3 | Valentina Castro | `valentina.castro@burgoscorp.test` | Diseñadora CAD (Ingeniería) |
| 4 | Florencia Ríos | (otra vez) | Comercial |
| 5 | Jorge Domínguez / Marcelo Ibáñez | `jorge.dominguez@…` / `marcelo.ibanez@…` | Jefes de Mecanizado y de Soldadura |
| 6 | Ramón Giménez / Claudio Ortiz | `ramon.gimenez@…` / `claudio.ortiz@…` | Tornero y soldador |
| 7 | Jorge / Marcelo | (otra vez) | Jefes: aprueban |
| 8 | Leandro Paz | `leandro.paz@burgoscorp.test` | Inspector de Calidad |
| 9 | Natalia Quiroga | `natalia.quiroga@burgoscorp.test` | Jefa de Administración y Finanzas |
| — | Ricardo Ferreyra | `ricardo.ferreyra@burgoscorp.test` | Gerencia: mira todo en el Tablero |

---

## 1. Llega el pedido · Comercial (Florencia)

1. Entrá como **Florencia**. **Buscar → "Ventas"** (o el acceso de Ventas en Inicio).
2. **Nueva solicitud**:
   - **Cliente**: Agro del Sur.
   - **Qué pide**: "Eje de transmisión Ø40 x 600 mm en SAE 1045 + brida soldada", tipo de trabajo
     *Fabricación*, cantidad 2, fecha requerida.
3. **Crear y agregar fotos**: sacale una foto a la pieza vieja o al plano que mandó el cliente.

> Qué pasa solo: el pedido **le llega al jefe de Ingeniería** con el aviso *"Pedido nuevo para
> asignar"*. Florencia no tiene que avisarle a nadie.

## 2. El jefe de Ingeniería lo asigna (Sebastián)

1. Entrá como **Sebastián**. En Inicio, **Pendientes** (o la campana) muestra el pedido nuevo.
2. Abrilo (o **Ventas → Para asignar**). En **"Analiza"** elegí a **Valentina**: la lista muestra
   primero a quien tiene menos pedidos abiertos.

> El jefe asigna gente de su área (y no ve las de otras áreas). El administrador también puede
> asignar cualquier tarea, siempre a alguien del área de la tarea.

## 3. Ingeniería presupuesta (Valentina)

1. Entrá como **Valentina**. Le llegó el aviso; el pedido está en **Ventas → A mi cargo**.
2. **Presupuestar → Nuevo presupuesto**. Cargá las **líneas** (**Agregar línea**):
   - Torneado del eje: 3 h de torno (TOR-01).
   - Fresado de chaveta: 1,5 h de CNC.
   - Soldadura MIG de la brida: 2 h (área Soldadura y Herrería).
   - Material: barra SAE 1045 Ø45, 1,3 m.
3. En **Condiciones**: validez, plazo de entrega. **Crear presupuesto**.
4. **Marcar enviado** cuando se lo mandás al cliente.

## 4. El cliente acepta → se crea la orden de trabajo (Florencia)

1. Entrá otra vez como **Florencia** (Comercial es quien habla con el cliente).
2. Abrí el presupuesto y tocá **Aceptado: crear OT**.

> Qué pasa solo:
> - Se crea la **orden de trabajo (OT-2026-…)** con una **tarea por cada operación** y el
>   **material reservado** en el depósito.
> - **A cada jefe le llegan las tareas de su área**: Jorge (Mecanizado) recibe el torneado y el
>   fresado; Marcelo (Soldadura) recibe la soldadura de la brida.
> - Si el cliente no acepta: **Rechazado** (el pedido queda cerrado, con el motivo).

## 5. Cada jefe asigna a su gente (Jorge y Marcelo)

1. Entrá como **Jorge**. En **Pendientes → "Tareas para asignar"** está el torneado.
2. Abrí la tarea → **Asignar**: solo aparece la gente de Mecanizado **con la habilidad que pide la
   máquina y la certificación vigente**, primero los menos cargados. Elegí a **Ramón** (se puede
   marcar a varias personas).
3. Lo mismo con **Marcelo** → la soldadura → **Claudio**.

## 6. Se hace el trabajo (Ramón y Claudio)

1. Entrá como **Ramón**. **Mis tareas** muestra el torneado. Abrila → **Iniciar**.
   - Desde el celular también se puede **escanear el QR de la máquina** (botón QR arriba).
   - Tildá la **lista de control**, agregá **fotos del trabajo** y comentarios si hace falta.
   - **Pausar** si se corta; las horas se registran solas.
2. Al terminar: **Terminar** → la tarea pasa **a revisión del jefe**.
3. Lo mismo con **Claudio** en la soldadura.

> La OT pasa sola a **"En proceso"** cuando alguien inicia la primera tarea.

## 7. Los jefes aprueban (Jorge y Marcelo)

1. **Jorge**: en **Pendientes → "Tareas para revisar"** abre el torneado → **Aprobar** (o
   **Rechazar** con el motivo: vuelve a Ramón para corregir).
2. **Marcelo** hace lo mismo con la soldadura.

> Cuando **todas** las tareas de la OT están aprobadas, la OT pasa sola a **Control de calidad** y
> le aparece a Calidad.

## 8. Calidad inspecciona (Leandro)

1. Entrá como **Leandro**. **Buscar → "Calidad" → Para inspeccionar** (o **Escanear la pieza**
   con el QR de la OT).
2. **Agregar medición**: diámetro nominal 40,00 mm, tolerancia ±0,05, medido 40,02.
   Agregá **fotos de la inspección**.
3. **Resultado**:
   - **Aprobada** (o *Con observaciones*) → **Guardar inspección**. La OT queda **terminada** y le
     llega el aviso a Comercial y a Finanzas: *"Lista para entregar y facturar"*.
   - **No conforme** → elegís **qué operación hay que rehacer**: esa tarea vuelve a quien la hizo
     ("para rehacer") y la OT vuelve a *En proceso*. Cuando el jefe la aprueba de nuevo, la OT vuelve
     sola a Calidad (pasos 6 a 8 otra vez, solo para esa operación).
   - El sistema no deja aprobar una pieza con mediciones fuera de tolerancia.

## 9. Se factura y se cobra (Natalia)

1. Entrá como **Natalia** (Administración y Finanzas). **Buscar → "Finanzas"**.
2. En **Para facturar o cargar** está la OT terminada → **Facturar** → revisá los **ítems** (salen
   del presupuesto aceptado) → **Emitir factura**. Una OT se factura una sola vez.
3. Cuando el cliente paga: abrí la factura (**A cobrar**) → **Registrar cobro** (monto, fecha,
   medio). Si paga en partes, se registra cada cobro y la factura muestra **Falta cobrar**.
4. Con el saldo en cero, la factura queda **cobrada**. Si hubo un error: **Anular comprobante**.

> Los comprobantes son internos (no van a AFIP).

## 10. Entrega y cierre

- Con la pieza lista, desde la OT (Producción) el jefe del área marca **Marcar entregada**: se
  libera el material reservado que no se usó.
- **Ricardo (Gerencia)** ve todo el recorrido en el **Tablero**: OT abiertas y atrasadas, a cobrar,
  horas por área.

---

## Resumen: quién hace qué y qué pasa solo

| Paso | Lo hace | Lo que el sistema hace solo |
|---|---|---|
| Pedido nuevo | Comercial | Avisa al jefe de Ingeniería |
| Asignar analista | Jefe de Ingeniería | Avisa al analista elegido |
| Presupuesto | Analista de Ingeniería | — |
| Aceptado: crear OT | Comercial | Crea la OT, las tareas y reserva material; avisa a cada jefe |
| Asignar tareas | Cada jefe, a su gente | Muestra solo a quien sabe y está habilitado |
| Trabajar | Empleados | Registra horas; pasa la OT a "En proceso" |
| Aprobar tareas | Cada jefe | Con todas aprobadas, manda la OT a Calidad |
| Inspección | Calidad | Aprobada → OT terminada, avisa a Comercial y Finanzas |
| Factura y cobro | Finanzas | Calcula el saldo |
