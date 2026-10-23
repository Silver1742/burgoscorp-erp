# Guía: crear las apps de Google, GitHub y Facebook

Para que funcione "Ingresar con Google / GitHub / Facebook" hay que registrar la app en cada
proveedor. Eso lo hace el dueño del proyecto con su cuenta; después se copian los ids al `.env`.

> Las consolas de los proveedores cambian de nombre y de lugar los menús con frecuencia.
> Si algo no aparece exactamente así, buscá la opción equivalente.

## Datos que vas a necesitar

| Dato | Valor en este proyecto |
|---|---|
| Nombre de la app | `BurgosCorp ERP` |
| Paquete Android | `com.burgoscorp.erp` |
| Esquema de la app (deep link) | `burgoscorp` |
| Redirect de GitHub | `burgoscorp://oauth` |
| Huella SHA-1 del certificado Android | Se obtiene con `eas credentials` (ver abajo) |

### Cómo obtener la SHA-1

Google y Facebook piden la huella del certificado con el que se firma el APK.

- **Con EAS (lo que vamos a usar para el APK):** en `mobile/`, correr `npx eas credentials`,
  elegir *Android* y luego el perfil `preview`. EAS muestra `SHA1 Fingerprint`. Si todavía no
  existe un keystore, EAS ofrece crearlo.
- **Keystore de debug (para `npx expo run:android`):**
  ```bash
  keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
  ```

Facebook pide además la huella en base64 ("key hash"). Se calcula a partir de la SHA-1:
```bash
node -e "console.log(Buffer.from('AA:BB:CC:...'.replace(/:/g,''),'hex').toString('base64'))"
```
(reemplazá `AA:BB:CC:...` por tu SHA-1).

---

## 1. Google (obligatorio)

1. Entrar a <https://console.cloud.google.com> y crear un proyecto nuevo: **BurgosCorp ERP**.
2. Ir a **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva figura
   como **Google Auth Platform**).
   - Tipo de usuario: **Externo**.
   - Nombre de la app, email de asistencia y email de contacto del desarrollador.
   - Permisos (scopes): `openid`, `email`, `profile` (son los básicos, no requieren revisión).
   - **Usuarios de prueba:** agregar tu Gmail y el del profesor. Mientras la app esté "en
     prueba", solo esas cuentas pueden ingresar.
3. Ir a **Credenciales → Crear credenciales → ID de cliente de OAuth** y crear **dos**:
   - **Aplicación web.** Nombre: `BurgosCorp web`. No hace falta cargar orígenes. Este id
     sirve como audiencia para el servidor y para probar en Expo.
   - **Android.** Nombre: `BurgosCorp Android`, paquete `com.burgoscorp.erp` y la **SHA-1**
     del paso anterior. Si usás el keystore de debug y también el de EAS, creá un cliente
     Android por cada SHA-1.
4. Copiar los **ID de cliente**, que terminan en `.apps.googleusercontent.com`. Google
   también muestra un "secreto de cliente" para el cliente web: **no se usa** y no hay que
   copiarlo en ningún lado.

Dónde va cada cosa:

```ini
# backend/.env: todos los ids separados por coma
GOOGLE_CLIENT_IDS=1234-web.apps.googleusercontent.com,1234-android.apps.googleusercontent.com
```
```ini
# mobile/.env: son públicos, pueden ir en la app
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234-web.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=1234-android.apps.googleusercontent.com
```

## 2. GitHub

1. En GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Completar:
   - **Application name:** `BurgosCorp ERP`
   - **Homepage URL:** la URL del repositorio
   - **Authorization callback URL:** `burgoscorp://oauth`
   - Dejar sin marcar *Enable Device Flow*.
3. **Register application**. Copiar el **Client ID**.
4. **Generate a new client secret** y copiarlo en el momento, porque después no se vuelve a
   mostrar. **El secreto va solo en el backend**: nunca en la app ni en el repositorio.

```ini
# backend/.env
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=el-secreto-generado
OAUTH_REDIRECT_URIS=burgoscorp://oauth
```
```ini
# mobile/.env
EXPO_PUBLIC_GITHUB_CLIENT_ID=Ov23li...
```

GitHub no entrega un token verificable para la app: la app manda el código y el
`code_verifier` (PKCE), y el backend lo canjea usando el secreto.

## 3. Facebook (Meta)

1. Entrar a <https://developers.facebook.com>, **Mis apps → Crear app**.
   - Caso de uso: **Autenticar y solicitar datos a los usuarios con el inicio de sesión con Facebook**.
   - Nombre: `BurgosCorp ERP` y tu email de contacto.
2. En el panel de la app, **Casos de uso → Inicio de sesión con Facebook → Personalizar**:
   agregar el permiso **email** (`public_profile` ya viene incluido).
3. **Configuración de la app → Básica**:
   - Copiar el **Identificador de la app** (App ID) y la **Clave secreta de la app** (App Secret).
   - Agregar **URL de la política de privacidad**. Sirve cualquier página pública; podemos
     publicar una sencilla.
   - **Agregar plataforma → Android:** paquete `com.burgoscorp.erp`, clase
     `com.burgoscorp.erp.MainActivity` y el **key hash** (la SHA-1 en base64).
4. **Inicio de sesión con Facebook → Configuración → URI de redireccionamiento de OAuth válidos:**
   agregar `fb<APP_ID>://authorize` (por ejemplo `fb1234567890://authorize`).
5. **Roles → Evaluadores:** mientras la app esté en *modo desarrollo*, solo pueden ingresar las
   cuentas con un rol en la app. Agregá la cuenta del profesor como evaluador o publicá la app
   (pasarla a *Activa* requiere la política de privacidad).

```ini
# backend/.env: el secreto solo va acá
FACEBOOK_APP_ID=1234567890
FACEBOOK_APP_SECRET=la-clave-secreta
```
```ini
# mobile/.env
EXPO_PUBLIC_FACEBOOK_APP_ID=1234567890
```

---

## Cómo verificar que quedó bien

1. Reiniciar el backend y abrir `GET /api/v1/auth/social/proveedores`. Los tres proveedores
   tienen que aparecer con su id (no `null`). Los secretos nunca se muestran.
2. En la app, los botones de cada red aparecen solo si su proveedor está configurado.

## Seguridad

- Los **secretos** (GitHub client secret y Facebook app secret) van **solo** en `backend/.env`.
  Todo lo que empieza con `EXPO_PUBLIC_` queda dentro del APK y cualquiera puede leerlo: ahí
  solo van ids públicos.
- El backend no confía en lo que manda la app:
  - de Google verifica la **firma** del `id_token`, la audiencia (`aud`), el emisor (`iss`) y
    la expiración;
  - de GitHub **canjea el código** con PKCE y la redirect URI registrada;
  - de Facebook confirma con `debug_token` que el token fue emitido **para esta app**.
- Si el proveedor no confirma el email, no se crea la cuenta ni se vincula a una existente.
