# BurgosCorp ERP

Sistema de gestión empresarial (ERP tipo SAP R/3) para **BurgosCorp S.A.**, un taller industrial
que trabaja a pedido: reparación, diseño, prototipos, fabricación y mecanizado de piezas mediante
impresión 3D, torneado, CNC, soldadura MIG/TIG y herrería.

- **App móvil:** React Native (Expo)
- **API:** Node.js + Express (REST, JWT con tokens de acceso y renovación)
- **Base de datos:** MySQL 8 / MariaDB 10.4+

> Proyecto en construcción. Las guías de instalación, el manual de usuario y la documentación
> completa de la API se van a sumar en `docs/` y en `backend/README.md`.

## Módulos

| Módulo | Equivalente SAP | Qué gestiona |
|---|---|---|
| Organización | — | Áreas, puestos, organigrama |
| Recursos Humanos | HR | Legajos, habilidades y certificaciones, fichaje, licencias, EPP |
| Ventas y Presupuestos | SD | Clientes, solicitudes, presupuestos |
| Producción | PP | Órdenes de trabajo, operaciones, centros de trabajo (máquinas) |
| Tareas y Proyectos | PS | Asignación de tareas, estados, horas, comentarios, checklist |
| Inventario | MM | Productos, depósitos, stock, movimientos |
| Compras | MM | Proveedores, órdenes de compra, servicios tercerizados |
| Mantenimiento | PM | Planes preventivos, órdenes correctivas, estado de máquinas |
| Calidad | QM | Inspecciones y mediciones dimensionales |
| Finanzas | FI | Facturas, cobros y pagos, costo real por OT |
| Tablero | — | Indicadores por rol |

## Roles

| Rol | Alcance |
|---|---|
| Administrador | Todo, incluidos usuarios, roles y auditoría |
| Gerencia | Solo lectura de toda la empresa |
| Jefe de área | Administra los módulos de su área, asigna tareas a su equipo y aprueba |
| Empleado | Sus tareas, fichaje, solicitudes y la carga de datos de su área |

Los permisos se definen por **rol × módulo × acción** (ver, crear, editar, borrar, aprobar) en la
tabla `permisos_rol`, y se combinan con el área del usuario (`area_modulos`). Siempre se validan
en el servidor.

## Estructura del repositorio

```
.
├── backend/          API REST (Express)
│   ├── db/           schema.sql y seed.sql
│   └── src/          config, routes, controllers, middlewares, services, validators, utils
├── mobile/           App React Native (Expo)
├── docs/             Manual de usuario y guía de instalación
└── .claude/          Skill y agente de seguridad OWASP usados en el desarrollo
```

## Base de datos (desarrollo)

Con MySQL o MariaDB (por ejemplo el de XAMPP) corriendo:

```bash
mysql -u root -p < backend/db/schema.sql
mysql -u root -p < backend/db/seed.sql
```

Después, crear un usuario de base de datos propio para la API (no usar `root`):

```sql
CREATE USER 'burgoscorp_app'@'localhost' IDENTIFIED BY 'una-contraseña-larga';
GRANT SELECT, INSERT, UPDATE, DELETE ON burgoscorp_erp.* TO 'burgoscorp_app'@'localhost';
```

y copiar `backend/.env.example` a `backend/.env` con esos datos. El archivo `.env` nunca se sube al repositorio.
