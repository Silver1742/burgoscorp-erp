# Guía de instalación y configuración

> En construcción: cubre la API, la base de datos y la app en desarrollo. El despliegue en la
> nube y el APK se suman en los próximos pasos.

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
- Correo (opcional en desarrollo): sin `SMTP_HOST`, los códigos de verificación se muestran en
  la consola donde corre `npm run dev`. Para mandarlos de verdad con Gmail: `SMTP_HOST=smtp.gmail.com`,
  `SMTP_USER` = tu Gmail y `SMTP_PASS` = una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords) (requiere tener 2FA en Google).
- `CODIGOS_HMAC_KEY`: otro valor aleatorio largo (protege los códigos que se mandan por email).
- Redes sociales (opcional): `GOOGLE_CLIENT_IDS`, `GITHUB_CLIENT_ID/SECRET`, `DISCORD_CLIENT_ID/SECRET`
  y `OAUTH_REDIRECT_URIS`; ver [guia-oauth.md](guia-oauth.md). Sin ellas los botones no aparecen.
- Opcionales: `EMAIL_AVISOS` (correos que reciben cada solicitud de acceso), `WEB_URL` (para los
  enlaces de los emails) y `PASSWORD_PRUEBA` (cuentas de prueba por rol, ver más abajo).

Crear las tablas, cargar los datos de prueba y arrancar:

```bash
npm run db:init   # crea la base si no existe y aplica las migraciones (también corre en cada arranque en la nube)
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

Con `PASSWORD_PRUEBA` (12+ caracteres, letras y números) se crean además `gerencia@burgoscorp.test`
y `empleado@burgoscorp.test`, y `jorge.dominguez@burgoscorp.test` recibe esa contraseña: es lo que se
usa en la versión publicada, donde la contraseña de desarrollo no sirve.

## 4. App móvil

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

- **En el navegador:** con la tecla `w`. En `backend/.env` hay que agregar
  `CORS_ORIGINS=http://localhost:8081`.
- **En el celular con Expo Go:** celular y PC en la misma WiFi, `HOST=0.0.0.0` en
  `backend/.env` y `EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:3000/api/v1` en `mobile/.env`.
  Escanear el QR con Expo Go.

Más detalles en [mobile/README.md](../mobile/README.md).

## 5. Tests

Los tests modifican datos: correrlos contra una base de prueba. Los tests de login social no se
conectan a Google, GitHub ni Facebook (los simulan), pero necesitan valores de prueba en las
variables `GOOGLE_CLIENT_IDS`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `FACEBOOK_APP_ID`,
`FACEBOOK_APP_SECRET` y `OAUTH_REDIRECT_URIS=burgoscorp://oauth`.

```bash
npm test
```
