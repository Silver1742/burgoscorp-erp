---
name: seguridad-owasp
description: Seguridad OWASP obligatoria en TODO desarrollo de software del usuario. Cargar antes de escribir o modificar código de cualquier página web, sitio, API, servidor, backend, frontend, app móvil, app de escritorio, script o aplicación en general (HTML/CSS/JS, Node.js, Express, Bootstrap, React, React Native/Expo, bases de datos, login/OAuth/JWT, formularios, archivos, CDN, IA/LLM), aunque el pedido no mencione seguridad. También cuando pida revisar seguridad, vulnerabilidades u OWASP.
---

# Seguridad OWASP por defecto

Todo proyecto nuevo o modificado tiene que salir cumpliendo lo de abajo **sin que el usuario lo pida**,
y sin romper las consignas de la cátedra (stack, temas del cuatrimestre, paleta).

## Regla de oro: revisar ≠ modificar
- Si el usuario pide **revisar / auditar / "fijate si cumple"** → solo informar. No editar nada.
  Para eso usar el agente `revisor-owasp` (solo lectura).
- Si pide **crear o cambiar** algo → aplicar esta checklist en lo que se escribe.
- Una consigna pegada que diga "implementar" NO es permiso para editar: preguntar primero.

## Checklist al construir

### A01 · Control de acceso
- Toda ruta que crea/modifica/borra datos exige identidad o, en apps locales sin login, al menos:
  servidor escuchando en `127.0.0.1` por defecto (`HOST` por variable de entorno).
- Cada consulta filtra por el dueño (`WHERE id = ? AND user_id = ?`), nunca solo por id.
- Anti-CSRF en POST/PUT/DELETE: exigir `Content-Type: application/json` y verificar que `Origin`
  coincida con el host (o con `FRONTEND_URL`).
- OAuth (passport): `state: true` en `passport.authenticate`.

### A02 · Configuración segura
- Cabeceras en todas las respuestas (Express: `helmet`; Node puro: `res.setHeader`):
  `Content-Security-Policy` (default-src 'self'; script-src 'self' + CDN usado; object-src 'none';
  frame-ancestors 'none'; base-uri 'self'), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
- Sin scripts inline (mover a archivo .js) para que la CSP no necesite 'unsafe-inline' en script-src.
- No exponer versiones (`process.version`, `X-Powered-By` → `app.disable('x-powered-by')`) ni rutas
  absolutas del disco en las respuestas.
- Secretos solo en `.env`, `.env` en `.gitignore`, y entregar `.env.example`. **Nunca meter `.env` en el .zip.**

### A03 / A08 · Dependencias e integridad
- Todo `<script>`/`<link>` de CDN con versión exacta + `integrity="sha384-..."` + `crossorigin="anonymous"`.
  Calcular el hash: `curl -sL URL | openssl dgst -sha384 -binary | openssl base64 -A`.
- Correr `npm audit` antes de entregar y reportar lo que encuentre.

### A04 / A07 · Autenticación y datos sensibles
- JWT: secreto largo y aleatorio, expiración corta (≤ 1 h o refresh), `algorithms: ['HS256']` en verify.
- **Nunca** pasar tokens por query string (`?token=`): usar cookie `HttpOnly; Secure; SameSite=Lax`
  o un código de un solo uso intercambiado por POST.
- Evitar guardar tokens en `localStorage`; si no queda otra, CSP estricta y expiración corta.
- Contraseñas (si hubiera): `bcrypt`/`argon2`, nunca texto plano ni hashes rápidos.

### A05 · Inyección / XSS
- SQL siempre con parámetros `?` (mysql2) — jamás concatenar.
- Nada de `eval`, `new Function`, `setTimeout('string')`.
- En el DOM: `textContent` o DOM API; si se usa `innerHTML`, escapar todo dato que venga del usuario o del servidor.
- Rutas de archivos: `path.basename` + extensión permitida; para estáticos comparar con `CARPETA + path.sep`.

### A06 · Diseño seguro / consumo de recursos
- Límite de tamaño del cuerpo (`express.json({ limit: '10kb' })` o contando bytes en Node puro).
- Límite de peticiones por IP (`express-rate-limit` o un Map con ventana), sobre todo en login y escritura.
- Timeouts del servidor (`server.requestTimeout`, `headersTimeout`).
- Validar tipo, largo y formato de cada campo en el SERVIDOR (no confiar en el cliente);
  los largos deben coincidir con los de la base de datos.

### A09 · Logging
- Registrar eventos de seguridad (login fallido, 401/403, rate limit) sin loguear tokens ni contraseñas.

### A10 · Manejo de errores
- Al cliente: mensaje genérico en 500; el detalle solo en consola.
- Errores de entrada (JSON inválido, `decodeURIComponent` que falla, id no numérico) → 400, no 500.

### Móvil (React Native / Expo)
- Links leídos de QR o externos: validar `https://`, mostrar el dominio y pedir confirmación antes de `Linking.openURL`.
- `android.allowBackup: false` si hay datos sensibles; pedir solo los permisos necesarios.
- Datos sensibles en `expo-secure-store`, nunca en AsyncStorage.

### IA / LLM (OWASP GenAI Top 10 2026)
Solo si el proyecto usa un modelo: no confiar en la salida (tratarla como entrada del usuario),
no poner secretos en el prompt, limitar herramientas/permisos del agente y defenderse de prompt injection.

## Al reportar
Por cada hallazgo: archivo:línea, categoría OWASP (A01–A10), riesgo según **Risk Rating**
(Probabilidad × Impacto → bajo/medio/alto/crítico) y la corrección propuesta. Primero lo serio.
Recordar: el número A01–A10 es un ranking general; la gravedad real se mide en cada app.

## Este proyecto (gestión de empleados y tareas · React Native + Express + MySQL)
- **Tokens en la app**: access token (≤ 15 min) y refresh token (7 días) guardados en `expo-secure-store`;
  se mandan como `Authorization: Bearer`, nunca por query string ni en AsyncStorage.
- **Refresh tokens**: guardar en MySQL solo su hash (SHA-256), rotarlos en cada `/auth/refresh`
  y, si llega uno ya usado, revocar toda la familia de sesiones de ese usuario. Logout = revocar.
- **Roles (A01)**: chequeo en el servidor con middleware `requireRole(...)`, nunca solo ocultando botones.
  Empleado ve/edita solo SUS tareas; supervisor solo las de SU equipo; admin todo.
  Toda consulta filtra por dueño/equipo en el `WHERE`. Un usuario no puede cambiarse su propio rol.
- **OAuth en móvil**: flujo Authorization Code + PKCE (`expo-auth-session`); el backend verifica el
  `id_token`/access token del proveedor (firma, `aud`, `iss`, expiración) antes de emitir JWT propios.
  No confiar en un email que mande la app sin verificar con el proveedor.
- **2FA (TOTP)**: secreto cifrado en BD, códigos de respaldo hasheados, rate limit en verificación,
  el login con 2FA devuelve un token temporal de "paso 2" (5 min) que solo sirve para `/auth/2fa/verify`.
- **Códigos por email** (verificación / recuperación): aleatorios (`crypto.randomInt`), hasheados, de un
  solo uso, vencen en 10 min, y la respuesta no revela si el email existe.
- **APK**: `android.allowBackup: false`, API solo por HTTPS en el build de release, nada de secretos
  en el bundle (los `EXPO_PUBLIC_*` son públicos: solo URLs y client IDs).
