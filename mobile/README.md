# BurgosCorp ERP · App móvil

App en React Native con Expo (SDK 58) y Expo Router.

## Ejecutar

```bash
cd mobile
npm install
cp .env.example .env     # y ajustar EXPO_PUBLIC_API_URL
npx expo start           # QR para Expo Go; tecla "w" abre la versión web
```

La API tiene que estar corriendo (ver `backend/README.md`). Para probar en el celular con Expo Go:

1. Celular y PC en la misma red WiFi.
2. En `backend/.env`: `HOST=0.0.0.0`.
3. En `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:3000/api/v1`.

> El login con Google, GitHub y Facebook necesita un *development build* o el APK:
> Expo Go no admite el esquema propio de la app (`burgoscorp://`).

## Estructura

```
mobile/
├── app.json                 nombre, paquete Android, esquema, allowBackup: false
└── src/
    ├── app/                 pantallas (cada archivo es una ruta de Expo Router)
    │   ├── _layout.js       sesión + rutas protegidas según el estado de la sesión
    │   ├── (auth)/          login, registro, olvidé / restablecer contraseña
    │   ├── dos-pasos.js     segundo paso del login (TOTP, email o código de respaldo)
    │   ├── verificar-email.js
    │   └── (app)/           pestañas: Inicio, Mis tareas, Módulos, Perfil
    │       ├── modulos/     grilla de módulos → recursos → listado genérico
    │       └── perfil/      datos de la cuenta, 2FA, cerrar sesión
    ├── contexto/sesion.js   estado global (Context API + useReducer): usuario, permisos, 2FA
    ├── lib/
    │   ├── api.js           cliente HTTP: token Bearer, renovación automática, errores en castellano
    │   ├── almacen.js       refresh token en SecureStore (Keystore de Android)
    │   ├── config.js        URL de la API (exige https:// en producción)
    │   └── validacion.js    reglas de formulario (las mismas que el servidor)
    ├── componentes/ui.js    Pantalla, Campo, Boton, Tarjeta, Aviso, Cargando, Vacio, Etiqueta
    ├── modulos.js           catálogo de módulos del ERP y cómo mostrar cada recurso
    └── tema.js              colores claro/oscuro y datos de pantalla (columnas según el ancho)
```

## Cómo funciona

- **Sesión persistente:** al iniciar sesión, el refresh token se guarda cifrado con
  `expo-secure-store` (en Android, el Keystore). Al abrir la app se renueva solo, sin volver a
  pedir la contraseña. El access token (15 min) vive solo en memoria.
- **Renovación automática:** si una petición responde `401 TOKEN_EXPIRADO`, el cliente pide un
  token nuevo y la repite. Si varias peticiones vencen a la vez, comparten una sola renovación.
- **Navegación por estado:** el layout raíz usa `Stack.Protected` para que solo se pueda ver el
  grupo de pantallas que corresponde (login, segundo paso, verificar email o la app). Los
  permisos reales siempre los valida la API.
- **Menú según el rol:** la pestaña Módulos muestra solo lo que permite `/auth/yo`. Por ejemplo,
  un jefe de Mecanizado no ve Ventas ni Finanzas, y un operario ve solo las máquinas de su área.
- **Responsive:** las grillas pasan de 2 a 4 columnas según el ancho, los listados se dividen en
  2 columnas en tablet o en horizontal, los formularios tienen ancho máximo, y se admiten las
  dos orientaciones.
- **Marca y modo claro/oscuro:** paleta BurgosCorp (rojo, negro, gris) con cabecera y pestañas
  negras; el usuario elige Sistema, Claro u Oscuro en Perfil (o con el botón del login) y queda
  guardado en el dispositivo.
- **Errores:** cada pantalla muestra mensajes claros para los errores de validación por campo,
  la falta de conexión, el timeout (15 s) y los 401/403/429/500, con botón de reintentar.

## Versión web (solo para desarrollo)

`npx expo start --web` sirve para probar rápido en el navegador. En la web no existe SecureStore
y, a propósito, el token **no** se guarda en `localStorage`: la sesión se pierde al recargar la
página. En el celular sí persiste.

## Seguridad

- Tokens en SecureStore, nunca en AsyncStorage ni en `localStorage`.
- `android.allowBackup: false` y ningún permiso de Android pedido.
- La versión de producción no arranca si la API no es `https://`.
- En `EXPO_PUBLIC_*` solo van datos públicos.
