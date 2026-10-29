# Publicar BurgosCorp ERP

Cómo está publicado el sistema y cómo repetirlo desde cero. Todo usa planes **gratis**.

| Pieza | Dónde | Dirección |
|---|---|---|
| Código | GitHub (público) | <https://github.com/Silver1742/burgoscorp-erp> |
| API | Render (Web Service) | <https://burgoscorp-api.onrender.com/api/v1> |
| Base de datos | Aiven (MySQL) | solo la ve la API, con TLS y certificado verificado |
| Correo | Brevo (API HTTPS) | remitente: el Gmail del dueño, verificado en Brevo |
| App web | Render (Static Site) | <https://burgoscorp-erp.onrender.com> |
| App Android | EAS Build (APK) | enlace de descarga en la página del proyecto en expo.dev |

Lo que dice **Vos** lo hace el dueño de las cuentas. **Ninguna contraseña ni clave se pega en el
chat ni en el repositorio**: se cargan directamente en el panel del proveedor.

> Render gratis "duerme" la API después de 15 minutos sin uso: el primer pedido tarda unos 30 a
> 50 segundos en despertarla. Después responde normal.

## 1. Base de datos en Aiven

1. **Vos:** cuenta en <https://aiven.io> → **Create service → MySQL → Free plan**.
2. En el servicio, pestaña *Overview*: anotar **Host**, **Port**, **User** (`avnadmin`) y descargar el
   **CA certificate**. La contraseña se copia solo al panel de Render (paso 3).
3. Aiven exige clave primaria en todas las tablas (`sql_require_primary_key`): el esquema ya cumple.

## 2. Correo con Brevo

Render gratis **bloquea los puertos SMTP** (25, 465, 587), así que la API manda los correos por la
API HTTPS de Brevo cuando tiene `BREVO_API_KEY` (sin la clave, usa SMTP como en desarrollo).

1. **Vos:** cuenta en <https://www.brevo.com> (con Google es lo más rápido: el Gmail queda como
   remitente verificado). Si no, *Senders → Add sender* y confirmar el mail que llega.
2. *SMTP & API → API keys → Generate*: acceso **restringido**, solo **Emails transaccionales**.
   Brevo pide verificar el teléfono la primera vez. La clave se muestra una sola vez.

## 3. API en Render

El archivo [`render.yaml`](../render.yaml) describe los dos servicios (API y web). Se puede usar
como *Blueprint* (**New → Blueprint** en Render) o crear el Web Service a mano con:

- **Build:** `cd backend && npm ci --omit=dev`
- **Start:** `cd backend && npm run db:init && node scripts/seed.js --forzar --opcional && npm start`
  - `db:init` crea las tablas si la base está vacía (y reintenta si una carga quedó cortada).
  - el seed carga las cuentas de prueba **solo** si existe `SEED_PASSWORD` (12+ caracteres).
  - `npm start` corre antes `restablecer-admin.js`, que solo actúa si existe `ADMIN_RESET_PASSWORD`.

**Variables** (*Environment*):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `TRUST_PROXY` | `0.0.0.0` / `1` |
| `DB_HOST`, `DB_PORT`, `DB_USER` | los de Aiven |
| `DB_PASSWORD` | **Vos**, la de Aiven |
| `DB_NAME` / `DB_SSL` | `defaultdb` / `true` |
| `DB_SSL_CA` | el certificado CA de Aiven (texto PEM completo) |
| `JWT_ACCESS_SECRET`, `JWT_TEMP_SECRET`, `CODIGOS_HMAC_KEY`, `TOTP_ENC_KEY` | botón **Generate** de Render. **No cambiar `TOTP_ENC_KEY` después**: cifra los secretos del 2FA |
| `BREVO_API_KEY` | **Vos**, la clave de Brevo |
| `SMTP_FROM` | `BurgosCorp ERP <tu.cuenta@gmail.com>` (el remitente verificado en Brevo) |
| `CORS_ORIGINS` | `https://burgoscorp-erp.onrender.com` (la app web) |
| `SEED_PASSWORD` | **Vos**, solo para el primer arranque. **Borrarla después** |

Probar `https://burgoscorp-api.onrender.com/api/v1/health` → `{"ok":true,…}`.

**Después del primer arranque:**
- borrar `SEED_PASSWORD` (las cuentas ya quedaron creadas con esa contraseña);
- entrar con `admin@burgoscorp.test`, **cambiar la contraseña y activar el 2FA** en Perfil.

**Si se olvida la contraseña del admin** (su email es ficticio, no le llega la recuperación):
agregar `ADMIN_RESET_PASSWORD` con la nueva (12+ caracteres, letras y números), guardar, esperar
el arranque (el log dice *"Contraseña de admin@burgoscorp.test restablecida"*) y **borrar la
variable**.

Quien pide acceso desde la app queda **pendiente** hasta que el administrador lo habilita en
*Usuarios → Solicitudes de acceso*; en ese momento le llega el aviso por email.

## 4. App web en Render

Static Site con:

- **Build:** `cd mobile && npm ci && npm run build:web` (exporta Expo para la web y renombra el
  runtime de Metro, que Render no servía con su nombre original).
- **Publish directory:** `mobile/dist`
- **Variable:** `EXPO_PUBLIC_API_URL=https://burgoscorp-api.onrender.com/api/v1`
- **Redirects/Rewrites:** `/*` → `/index.html`, acción **Rewrite** (para poder recargar cualquier
  pantalla).

En la web la sesión vive en memoria (no se guardan tokens en el navegador): al recargar la página
hay que volver a entrar.

## 5. APK con EAS Build

1. `mobile/eas.json` ya apunta a la API publicada (`EXPO_PUBLIC_API_URL`). La app se niega a usar
   `http://` en producción.
2. **Vos (una sola vez):** `npx eas-cli login` con la cuenta de Expo.
3. Desde `mobile/`:

   ```bash
   npx eas-cli build -p android --profile preview
   ```

   La primera vez crea el proyecto en Expo y la clave de firma (la guarda EAS, no se sube al repo).
   Al terminar da el enlace del `.apk`.
4. Instalar el APK en el teléfono (permitir "instalar apps de origen desconocido").

Los cambios de ícono, splash o del comportamiento del teclado (`app.json`) solo se ven en un APK
nuevo; los cambios de pantallas también, porque el APK lleva el código adentro.

## 6. Antes de entregar

- [ ] `/api/v1/health` responde, y el login funciona desde el APK y desde la web.
- [ ] `SEED_PASSWORD` y `ADMIN_RESET_PASSWORD` ya no están en Render.
- [ ] La contraseña del admin no es la del seed y tiene 2FA.
- [ ] `npm audit` en `backend/` (0 vulnerabilidades) y en `mobile/` (las alertas de `@expo/cli`
      son de la herramienta de compilación y no van en el APK).
- [ ] El `.zip` de entrega se arma **sin** `.env`, `node_modules`, `uploads/`, `dist/` ni `.expo/`.
