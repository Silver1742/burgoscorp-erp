# Guía de la base de datos en MySQL Workbench

Cómo conectarse a la base de BurgosCorp ERP, recorrerla, mostrarla y cargar datos a mano.
Las consultas listas para copiar están en [`docs/sql/presentacion.sql`](sql/presentacion.sql).

---

## 1. Dónde está la base

| | Publicada (la que usa la app) | Local (para probar) |
|---|---|---|
| Servidor | Aiven, MySQL 8 | XAMPP, MariaDB |
| Host | `mysql-d93ae04-utgarda1011-edaf.b.aivencloud.com` | `127.0.0.1` |
| Puerto | `18997` | `3306` |
| Usuario | `avnadmin` | `root` |
| Base (schema) | `defaultdb` | `burgoscorp_erp` |
| Contraseña | En la consola de Aiven: servicio **mysql-d93ae04 → Overview → Connection information** | La de tu XAMPP (por defecto, vacía) |

> **Plan gratis de Aiven:** si nadie la usa por un tiempo, Aiven **apaga** la base. Si Workbench
> dice *"Unable to connect"* o el nombre del servidor no existe, entrá a https://console.aiven.io,
> abrí el servicio y tocá **Power on**. En unos minutos queda en **Running**.

La contraseña **nunca** va en el código ni en este documento: en el servidor está en la variable
`DB_PASSWORD` de Render, y en la compu, en `backend/.env` (que no se sube a GitHub).

---

## 2. Conectarse desde Workbench (una sola vez)

1. Workbench → **Database → Manage Connections… → New**.
2. Pestaña **Parameters**:
   - **Hostname:** `mysql-d93ae04-utgarda1011-edaf.b.aivencloud.com`
   - **Port:** `18997`
   - **Username:** `avnadmin`
   - **Password → Store in Vault…** → pegar la de Aiven.
   - **Default Schema:** `defaultdb`
3. Pestaña **SSL** (Aiven exige conexión cifrada):
   - **Use SSL:** `Require`
   - **SSL Key File**, **SSL CERT File** y **SSL CA File:** vacíos.
   - **SSL Cipher:** `ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256`
4. **Test Connection** → **OK** → **Close**.

### Si aparece un error

| Mensaje | Qué pasa | Solución |
|---|---|---|
| *Unable to connect to …* | La base está apagada o el host está mal | Encenderla en Aiven (Power on) y revisar host y puerto |
| *Failed to set ciphers to use* | Workbench en Windows no negocia el cifrado solo | Completar **SSL Cipher** (paso 3) |
| *Unable to get certificate* | Algún campo de archivo SSL tiene texto (aunque se vea vacío) | Borrar el contenido de Key, CERT y CA |
| *Access denied for user 'avnadmin'* | Contraseña equivocada | Copiarla de nuevo desde Aiven |

---

## 3. Recorrer la base

- **Ver las tablas:** panel izquierdo → pestaña **Schemas** → `defaultdb` → **Tables**.
- **Ver los datos de una tabla:** pasar el mouse sobre la tabla → ícono de grilla (o clic derecho →
  **Select Rows - Limit 1000**).
- **Ver cómo está armada una tabla** (columnas, tipos, claves, reglas): clic derecho → **Table
  Inspector**, o **Alter Table…** (solo mirar; no guardar cambios).
- **Diagrama entidad-relación:** **Database → Reverse Engineer…** → la conexión → `defaultdb` →
  **Next** hasta el final. Workbench dibuja todas las tablas con sus relaciones (claves foráneas).
- **Ejecutar una consulta:** abrir una pestaña SQL (ícono **SQL+**), escribirla y **Ctrl+Enter**
  (la línea del cursor) o **Ctrl+Shift+Enter** (todo lo seleccionado).

### Las tablas por módulo

La base tiene **57 tablas**. El detalle de cada una, comentado, está en
[`backend/db/schema.sql`](../backend/db/schema.sql); las que se agregaron después, en
[`backend/scripts/migraciones.js`](../backend/scripts/migraciones.js).

| Módulo (como SAP) | Tablas principales |
|---|---|
| Seguridad | `usuarios`, `roles`, `modulos`, `permisos_rol`, `cuentas_sociales`, `refresh_tokens`, `intentos_login`, `codigos_verificacion`, `auditoria` |
| Organización | `areas`, `area_modulos`, `puestos`, `secuencias` |
| RRHH | `empleados`, `habilidades`, `empleado_habilidades`, `asistencias`, `jornada_laboral`, `solicitudes_licencia`, `epp_entregas` |
| Ventas | `clientes`, `servicios`, `solicitudes`, `presupuestos`, `presupuesto_items` |
| Producción y Tareas | `centros_trabajo` (máquinas), `ordenes_trabajo`, `tareas`, `tarea_asignaciones`, `tarea_checklist`, `tarea_comentarios`, `tarea_historial`, `registros_horas` |
| Inventario y Compras | `productos`, `categorias_producto`, `depositos`, `stock`, `movimientos_stock`, `reservas_material`, `consumos_material`, `proveedores`, `ordenes_compra`, `orden_compra_items` |
| Mantenimiento y Calidad | `planes_mantenimiento`, `ordenes_mantenimiento`, `inspecciones`, `inspeccion_mediciones` |
| Finanzas | `comprobantes`, `comprobante_items`, `pagos` |
| Inicio | `avisos_tablon`, `avisos_leidos`, `notificaciones`, `adjuntos` |

### Qué conviene mostrar y cómo se explica

- **Las contraseñas no se ven.** `usuarios.password_hash` guarda un hash **bcrypt** (empieza con
  `$2b$12$` o `$2a$12$`: el 12 es el costo): es una huella que no se puede revertir. Lo mismo con los tokens y los códigos por email.
- **Relaciones:** `usuarios.empleado_id → empleados.id → areas.id`; `tareas.orden_trabajo_id →
  ordenes_trabajo.id`; etc. Se ven en el diagrama o en **Table Inspector → Foreign keys**.
- **La base también valida:** tiene reglas `CHECK` (por ejemplo, stock que no puede ser negativo o
  licencias con fin antes del inicio). Si se intenta cargar algo imposible, MySQL lo rechaza
  aunque la API tuviera un error.
- **Nada se borra de verdad:** clientes, productos o máquinas se desactivan (`activo = 0`).
- **Numeración tipo SAP:** la tabla `secuencias` genera `OT-2026-0001`, `OC-2026-0003`, etc.
- **Auditoría:** cada acción sensible queda en `auditoria` (quién, qué, cuándo, desde qué IP).
- **Caracteres:** todo está en `utf8mb4` (acepta tildes, ñ y emojis sin romperse).

---

## 4. Consultas para la presentación

Abrí [`docs/sql/presentacion.sql`](sql/presentacion.sql) en Workbench (**File → Open SQL Script**).
Cada bloque se selecciona y se ejecuta con **Ctrl+Shift+Enter**:

1. Todas las tablas con cuántas filas tiene cada una.
2. Usuarios con su rol, legajo y área.
3. Áreas, su jefe y cuánta gente tienen.
4. La matriz de permisos (qué puede hacer cada rol en cada módulo).
5. Órdenes de trabajo con su cliente y cuántas tareas tiene cada una.
6. Los últimos 30 movimientos de la auditoría.

Algunas sueltas, por si el profesor pide algo puntual:

```sql
-- ¿Cuántas personas hay por rol?
SELECT r.nombre AS rol, COUNT(*) AS usuarios
FROM usuarios u JOIN roles r ON r.id = u.rol_id
GROUP BY r.nombre;

-- Tareas de una orden de trabajo, con quién las hace
SELECT t.id, t.titulo, t.estado, CONCAT(e.nombre, ' ', e.apellido) AS asignado
FROM tareas t
LEFT JOIN tarea_asignaciones ta ON ta.tarea_id = t.id
LEFT JOIN empleados e ON e.id = ta.empleado_id
WHERE t.orden_trabajo_id = 1;

-- Stock por producto y depósito
SELECT p.codigo, p.nombre, d.nombre AS deposito, s.cantidad
FROM stock s JOIN productos p ON p.id = s.producto_id JOIN depositos d ON d.id = s.deposito_id
ORDER BY p.codigo;

-- Licencias pedidas y en qué estado están
SELECT CONCAT(e.nombre, ' ', e.apellido) AS empleado, l.tipo, l.fecha_desde, l.fecha_hasta, l.estado
FROM solicitudes_licencia l JOIN empleados e ON e.id = l.empleado_id
ORDER BY l.id DESC;
```

---

## 5. Cargar un usuario a mano

Está explicado paso a paso en [`docs/sql/presentacion.sql`](sql/presentacion.sql). Hay dos formas:

**Forma simple (recomendada):** un `INSERT` en `usuarios` con `estado_cuenta = 'pendiente'`. El
usuario aparece en la app en **Inicio → Pendientes** y en **Personas → Solicitudes**; el
administrador lo habilita desde ahí (elige rol y área, y el legajo se crea solo).

**Forma completa:** crea el legajo en `empleados` y el usuario ya habilitado, dentro de una
transacción (`START TRANSACTION … COMMIT`: o se guarda todo o nada). La contraseña no se escribe
en texto: primero se genera su hash bcrypt desde la carpeta `backend`:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuClaveSegura2026', 12))"
```

y ese resultado se pega en `@hash`. Después se puede entrar a la app con ese email y esa contraseña.

**Comprobarlo:** la consulta del final de cada bloque muestra el usuario recién creado.

---

## 6. Cuidados

- **No borres ni edites filas a mano** en la base publicada salvo para la demostración: la app es la
  que mantiene la coherencia (stock, estados, auditoría). Para cambiar algo, usá la app.
- Workbench trae **Safe Updates** activado (no deja hacer `UPDATE`/`DELETE` sin `WHERE` por clave).
  Dejalo así.
- Para probar algo riesgoso: `START TRANSACTION;` … mirar el resultado … `ROLLBACK;` (deshace todo).
- Si se rompe la base local, se rearma con `npm run db:init` y `npm run seed` desde `backend/`
  (ver [guia-instalacion.md](guia-instalacion.md)).
