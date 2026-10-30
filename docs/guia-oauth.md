# Guía: ingreso con Google, GitHub y Discord

Para que funcione "Ingresar con Google / GitHub / Discord" hay que registrar la app en cada
proveedor (lo hace el dueño del proyecto con su cuenta) y cargar los datos en el servidor.

> Las consolas de los proveedores cambian de nombre y de lugar los menús con frecuencia.
> Si algo no aparece exactamente así, buscá la opción equivalente.

## Cómo funciona

Los tres proveedores vuelven a **una sola dirección**: la página `/oauth` de la versión web.

```
https://burgoscorp-erp.onrender.com/oauth
```

- **En la web:** el botón lleva a la pantalla del proveedor y este vuelve a `/oauth`, que termina el
  ingreso con la API.
- **En el APK:** el botón abre el navegador del teléfono. Al volver a `/oauth`, la página ve que el
  pedido salió de la app (el `state` empieza con `a.`) y le pasa la respuesta por
  `burgoscorp://oauth`, que la app recibe.

Así no hace falta registrar la huella SHA-1 del APK ni una configuración distinta por plataforma.
La app **le pide los ids públicos a la API** (`GET /auth/social/proveedores`): un botón aparece
solo si su proveedor está configurado en el servidor, y para cambiarlos no hace falta otro APK.

## 1. Google (obligatorio)

1. <https://console.cloud.google.com> → crear el proyecto **BurgosCorp ERP**.
2. **Google Auth Platform → Comenzar**: nombre `BurgosCorp ERP`, email de asistencia, público
   **Externo**, email de contacto y aceptar la política de datos de Google.
3. **Público → Usuarios de prueba**: agregar los Gmail que van a poder entrar (el tuyo y el del
   profesor). Mientras la app esté "en prueba", solo esas cuentas pueden ingresar con Google.
4. **Clientes → Crear cliente → Aplicación web** (`BurgosCorp web`):
   - Orígenes de JavaScript autorizados: `https://burgoscorp-erp.onrender.com`
   - URI de redireccionamiento autorizados: `https://burgoscorp-erp.onrender.com/oauth`
5. Copiar el **ID de cliente** (termina en `.apps.googleusercontent.com`). El secreto no se usa.

## 2. GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Application name `BurgosCorp ERP`, Homepage `https://burgoscorp-erp.onrender.com`,
   Authorization callback URL `https://burgoscorp-erp.onrender.com/oauth`.
3. **Register application**, copiar el **Client ID** y tocar **Generate a new client secret**
   (se muestra una sola vez).

## 3. Discord

1. <https://discord.com/developers/applications> → **New Application** → `BurgosCorp ERP`.
2. **OAuth2**:
   - Copiar el **Client ID**.
   - **Reset Secret** y copiar el **Client Secret** (se muestra una sola vez).
   - **Redirects → Add Redirect**: `https://burgoscorp-erp.onrender.com/oauth` y **Save Changes**.
3. La app pide los permisos `identify` y `email`. Discord solo crea la cuenta si el email está
   verificado en Discord.

## 4. Cargar los datos en el servidor

En Render, servicio **burgoscorp-api → Environment** (o en `backend/.env` en desarrollo):

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_IDS` | el ID de cliente de Google |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | los de GitHub |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | los de Discord |
| `OAUTH_REDIRECT_URIS` | `https://burgoscorp-erp.onrender.com/oauth` |

(Facebook sigue soportado en la API con `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`, pero la app no
muestra su botón.)

## Cómo verificar que quedó bien

1. Abrir `https://burgoscorp-api.onrender.com/api/v1/auth/social/proveedores`: tienen que aparecer
   `google`, `github` y `discord` con su id (no `null`) y `redirectUri`. Los secretos nunca se muestran.
2. En el login aparecen los botones. La primera vez que alguien entra con una red social su cuenta
   queda **pendiente** hasta que un administrador la habilita, igual que con "Pedí acceso".

## Seguridad

- Los **secretos** (GitHub y Discord) van **solo** en el servidor: nunca en la app ni en el
  repositorio. La app solo conoce ids públicos.
- El backend no confía en lo que manda la app:
  - de Google verifica la **firma** del `id_token`, la audiencia, el emisor, la expiración y el
    `nonce` que generó la app (un token de otra sesión no sirve);
  - de GitHub y Discord **canjea el código** con su secreto, PKCE y solo con la redirect registrada.
- La app comprueba el `state` de la respuesta: un ingreso que no empezó ella se descarta.
- La página `/oauth` borra el token de la barra de direcciones apenas lo lee.
- Si el proveedor no confirma el email, no se crea la cuenta ni se vincula a una existente.
