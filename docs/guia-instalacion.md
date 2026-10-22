# Guía de instalación y configuración

> En construcción: por ahora cubre la API y la base de datos. La app móvil y el despliegue
> en la nube se suman en los próximos pasos.

## Requisitos

- Node.js 20 o superior (probado con 24)
- MySQL 8 o MariaDB 10.4+ (sirve el de XAMPP)
- Git

## 1. Base de datos

Con MySQL corriendo (en XAMPP: *Start* en MySQL), desde la carpeta del proyecto:

```bash
mysql -u root -p < backend/db/schema.sql
mysql -u root -p < backend/db/seed.sql
```

En XAMPP el cliente está en `C:\xampp\mysql\bin\mysql.exe` y `root` no tiene contraseña por defecto.

Crear un usuario solo para la API (con permisos mínimos, sin poder borrar tablas):

```sql
CREATE USER 'burgoscorp_app'@'localhost' IDENTIFIED BY 'elegí-una-contraseña-larga';
GRANT SELECT, INSERT, UPDATE, DELETE ON burgoscorp_erp.* TO 'burgoscorp_app'@'localhost';
```

## 2. API

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env`:

- `DB_USER` / `DB_PASSWORD`: el usuario creado en el paso anterior.
- `JWT_ACCESS_SECRET` y `JWT_TEMP_SECRET`: dos valores distintos generados con
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

Cargar los datos de prueba y arrancar:

```bash
npm run seed
npm run dev
```

Comprobar que responde: <http://127.0.0.1:3000/api/v1/health>

## 3. Cuentas de prueba

`npm run seed` crea 29 usuarios. Todas las cuentas usan la contraseña de desarrollo
**`BurgosCorp2026`**, salvo que se defina otra en `SEED_PASSWORD` dentro del `.env`.
Son datos de prueba: no usar esta contraseña en un servidor público.

| Rol | Email | Área |
|---|---|---|
| Administrador | `admin@burgoscorp.test` | — |
| Gerencia | `ricardo.ferreyra@burgoscorp.test` | Dirección |
| Jefe | `jorge.dominguez@burgoscorp.test` | Mecanizado |
| Jefe | `marcelo.ibanez@burgoscorp.test` | Soldadura y Herrería |
| Jefe | `mariana.ledesma@burgoscorp.test` | Abastecimiento (compras y depósito) |
| Jefe | `carolina.mendez@burgoscorp.test` | Recursos Humanos |
| Jefe | `natalia.quiroga@burgoscorp.test` | Administración y Finanzas |
| Empleado | `ramon.gimenez@burgoscorp.test` | Mecanizado (tornero) |
| Empleado | `claudio.ortiz@burgoscorp.test` | Soldadura (soldador MIG certificado) |
| Empleado | `walter.medina@burgoscorp.test` | Soldadura (certificación MIG **vencida**) |
| Empleado | `julian.cabrera@burgoscorp.test` | Impresión 3D |

La lista completa se imprime al correr `npm run seed`.

## 4. Tests

Los tests modifican datos: correrlos contra una base de prueba.

```bash
npm test
```
