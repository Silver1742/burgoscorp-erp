# Publicar BurgosCorp ERP

Cómo poner la API en internet (Railway, con MySQL) y generar el APK de Android (EAS Build).
Lo que dice **Vos** lo hace el dueño de las cuentas: nunca se pegan contraseñas ni claves en el
chat ni en el repositorio.

## 1. Código en GitHub

1. **Vos:** en <https://github.com/new> creá el repositorio `burgoscorp-erp`, **público**, vacío
   (sin README, sin .gitignore, sin licencia).
2. Se conecta y se sube:

   ```bash
   git remote add origin https://github.com/USUARIO/burgoscorp-erp.git
   git push -u origin main
   ```

   La primera vez Windows abre el navegador para iniciar sesión en GitHub (Git Credential Manager).

El repositorio no tiene `.env`, claves ni archivos subidos (están en `.gitignore`); los secretos van
solo en el panel de Railway.

## 2. API y base de datos en Railway

1. **Vos:** entrá a <https://railway.com> con tu cuenta de GitHub.
2. **New Project → Deploy from GitHub repo →** `burgoscorp-erp`.
3. En el servicio creado: **Settings → Source → Root Directory:** `backend`. Railway lee
   `backend/railway.json`: al arrancar crea las tablas si la base está vacía (`npm run db:init`) y
   después levanta la API. La salud se controla en `/api/v1/health`.
4. **+ New → Database → MySQL** en el mismo proyecto.
5. En el servicio de la API, **+ Volume**, montado en `/data` (ahí se guardan las fotos).
6. **Variables** del servicio de la API (pestaña *Variables → Raw Editor*):

   ```
   NODE_ENV=production
   HOST=0.0.0.0
   TRUST_PROXY=1
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_ACCESS_SECRET=${{ secret(64) }}
   JWT_TEMP_SECRET=${{ secret(64) }}
   CODIGOS_HMAC_KEY=${{ secret(64) }}
   TOTP_ENC_KEY=${{ secret(64, "0123456789abcdef") }}
   UPLOADS_DIR=/data/uploads
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tu.cuenta@gmail.com
   SMTP_PASS=
   SMTP_FROM=BurgosCorp ERP <tu.cuenta@gmail.com>
   ```

   - `${{ secret(...) }}` lo genera Railway: las claves no pasan por ninguna PC ni por el chat.
     **No las cambies después**: `TOTP_ENC_KEY` cifra los secretos del 2FA.
   - `SMTP_PASS` es una **contraseña de aplicación** de Google (Cuenta de Google → Seguridad →
     Verificación en dos pasos → Contraseñas de aplicaciones). La cargás vos directamente acá.
   - El registro libre queda **cerrado** (`REGISTRO_ABIERTO` sin definir en producción): las
     cuentas las crea RRHH o el administrador.
7. **Cuentas de prueba (opcional, para mostrar el sistema):** agregá `SEED_PASSWORD` con una
   contraseña de 12 caracteres o más (que no sea la de desarrollo). En el próximo arranque se
   cargan los empleados, usuarios y datos de ejemplo. Después:
   - **borrá la variable `SEED_PASSWORD`** (el seed no vuelve a correr si ya hay usuarios, pero así
     no queda la contraseña en el panel);
   - entrá con `admin@burgoscorp.test`, **cambiá su contraseña y activá el 2FA** en Perfil.
8. **Settings → Networking → Generate Domain.** Queda algo como
   `https://burgoscorp-erp-production.up.railway.app`. Probá
   `https://…/api/v1/health` en el navegador: tiene que responder `{"ok":true,…}`.

## 3. APK con EAS Build

1. En `mobile/eas.json`, reemplazá `https://API-DE-RAILWAY` por el dominio del paso 2.8 (queda
   `https://…up.railway.app/api/v1`). La app se niega a usar `http://` en producción.
2. **Vos (una sola vez):** `npx eas-cli login` con tu cuenta de Expo.
3. Desde `mobile/`:

   ```bash
   npx eas-cli build -p android --profile preview
   ```

   La primera vez pregunta si crea el proyecto en Expo y la clave de firma (keystore): aceptá que
   EAS la genere y la guarde (no se sube al repo). Al terminar da un enlace para bajar el `.apk`.
4. Instalá el APK en el teléfono (hay que permitir "instalar apps de origen desconocido").

## 4. Antes de entregar

- [ ] `https://…/api/v1/health` responde y el login funciona desde el APK.
- [ ] La contraseña del admin ya no es la de `SEED_PASSWORD` y tiene 2FA.
- [ ] `npm audit` en `backend/` (0 vulnerabilidades) y en `mobile/` (las alertas de `@expo/cli`
      son de la herramienta de compilación y no van en el APK).
- [ ] El `.zip` de entrega se arma **sin** `.env`, `node_modules`, `uploads/` ni `.expo/`.
