# BurgosCorp ERP · Estado del proyecto y lo que falta

> Resumen para retomar el trabajo en otra sesión de Claude. Escrito el 2026-10-30.
> **Entrega: alrededor del 2026-11-01.** Todo lo que se le escribe al usuario va **en español**.

## 1. Qué es

ERP tipo SAP R/3 para **BurgosCorp S.A.** (empresa ficticia): taller industrial a pedido
(reparación, diseño, fabricación y mecanizado con impresión 3D, torno, CNC, soldadura, herrería).
Argentina, ARS, IVA. Es el **proyecto final de una materia**.

- **App:** React Native con Expo SDK 58 (`mobile/`). Sirve como web y como APK de Android.
- **API:** Node.js + Express 5 (`backend/`), REST en `/api/v1`, JWT de acceso + refresh rotativo.
- **Base:** MySQL 8 / MariaDB (`backend/db/schema.sql`, `seed.sql`, migraciones idempotentes en
  `backend/scripts/migraciones.js` que corren en cada arranque).
- Módulos: Organización, RRHH (legajos, fichaje, licencias, liquidación de sueldos), Ventas,
  Producción (OT), Tareas, Inventario, Compras, Mantenimiento, Calidad, Finanzas, Tablero, Usuarios.
- Roles: `ADMIN`, `GERENCIA` (ve todo, no modifica), `JEFE` (su área), `EMPLEADO`.

### Consigna de la materia (lo que se evalúa)

| Requisito | Estado |
|---|---|
| Login social con 3 redes, **Google obligatorio** | ⚠️ **Falta en la app** (la API ya lo tiene) |
| 2FA | ✅ TOTP (Google Authenticator) o código por email, con códigos de respaldo |
| 3 roles | ✅ (hay 4) |
| JWT con access y refresh | ✅ refresh rotativo con detección de reuso |
| CRUD | ✅ |
| Context API | ✅ `mobile/src/contexto/` (sesión, tema, toasts) |
| Diseño responsive | ✅ celular, tablet y web |
| README con la API, manual, guía de instalación y APK | ⚠️ README raíz dice "en construcción"; guía de instalación desactualizada |

## 2. Dónde está publicado

| Qué | Dónde |
|---|---|
| Web | https://burgoscorp-erp.onrender.com (Render, sitio estático `srv-dbhq9hqfngtc73cao54g`, build `cd mobile && npm ci && npm run build:web`, rewrite `/*` → `/index.html`) |
| API | https://burgoscorp-api.onrender.com/api/v1 (Render, servicio `srv-dbho4f5g1s2s73airsk0`, workspace `tea-dajv6c0jo6nc73fdmh80`) |
| Base | Aiven MySQL (`defaultdb`; **exige clave primaria en todas las tablas**) |
| Correo | Brevo por API HTTPS (`BREVO_API_KEY`); Render gratis bloquea SMTP |
| APK | EAS, proyecto `@silver1011/burgoscorp-erp`, perfil `preview`. Último: https://expo.dev/artifacts/eas/HPXfZRT_XdgOHDpG-kWYr7eCw8VEhZzwN1wkd2F8EB4.apk |
| Repo | https://github.com/Silver1742/burgoscorp-erp (público, rama `main`; Render publica solo al hacer push) |

Variables de Render documentadas en `docs/publicar.md`. **Las claves las carga el usuario en el
panel; nunca van en el chat ni en el repo.**

## 3. Reglas de trabajo (las pidió el usuario)

1. **Siempre en español**, también las preguntas. Se enojó cuando se le escribió en inglés.
2. **OWASP siempre:** antes de tocar código, cargar la skill `seguridad-owasp`. Al terminar, decir
   en una línea qué medidas quedaron aplicadas. "Revisar/auditar" = solo informar (agente
   `revisor-owasp`), no editar.
3. **Web y APK iguales:** todo cambio de la app se publica en la web (push) **y** en un APK nuevo:
   en `mobile/`, `eas build -p android --profile preview --non-interactive --no-wait`. `npx eas-cli`
   falla dentro de `mobile/` ("Invalid Version"): usar un eas-cli instalado aparte.
4. **Nunca** commitear ni zipear `.env`; mantener `.env.example` al día.
5. Estilo visual copiado del portal R3 del usuario: paleta roja, escudo "BC", **toasts en vez de
   alerts**, errores debajo de cada campo.
6. Todo usable desde el celular (cámara y QR según el área).
7. Al terminar cada día del plan, avisar "✅ Día N terminado".
8. Commits terminan con `Co-Authored-By: Claude …`. Commit/push solo cuando corresponde al pedido.

## 4. Cómo probar en local

- `backend/`: copiar `.env.example` a `.env`, `npm run db:init`, `npm run seed`, `npm run dev`.
- Tests: `npm test` (155 pasando; usan las cuentas del seed con `SEED_PASSWORD` o la de desarrollo
  de `docs/guia-instalacion.md`). El usuario de la app de la base local no tiene ALTER/CREATE: las
  migraciones se corren con root.
- `mobile/`: `npm install`, `npx expo start --web` (puerto 8081). `API_URL` en `src/lib/config.js`.
- Detalles de código útiles:
  - `api()` en la app devuelve `data` directo, salvo listados (`{ data, meta }`).
  - mysql2: para `IN (?)` con listas usar `pool.query`/`conn.query`, no `execute` ni el helper `query()`.
  - Errores de validación: la API responde `detalles: [{ campo: 'body.x', mensaje }]`, los mensajes
    de zod están en castellano (`validators/comunes.js`), y la app nombra el campo en el aviso
    (`mobile/src/lib/campos.js`) y lleva la pantalla al primer campo en rojo (`useMostrarError`).

## 5. Lo que falta (en orden de prioridad)

### 5.1 Login social en la app — **obligatorio para la consigna**
- La API ya tiene `POST /auth/social/:proveedor` (Google, GitHub, Facebook), `GET /auth/social/proveedores`
  y `services/social.js`; el contexto de sesión ya tiene `loginSocial(proveedor, datos)`.
- **Falta:** los botones en `mobile/src/app/(auth)/login.js` (y registro) con `expo-auth-session`,
  y probarlo de verdad.
- **Depende del usuario:** tiene que crear las apps OAuth siguiendo `docs/guia-oauth.md` y cargar
  los ids en Render (`GOOGLE_CLIENT_IDS`, `GITHUB_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`,
  `OAUTH_REDIRECT_URIS`). Pedírselo primero. Quien entra con una red social queda **pendiente**
  hasta que lo habilita el administrador (igual que el registro).
- Ojo: el manual y la Ayuda **no** mencionan el botón de Google porque todavía no existe. Agregarlo
  cuando esté.

### 5.2 La cuenta del usuario no tiene área
- En la base publicada, la cuenta 31 **"Uriel Burgos"** (rol JEFE) no tiene legajo/área, así que no
  ve módulos. Es la única (lo dice el log de Render al arrancar: "la cuenta 31 … no tiene área").
- **Preguntarle al usuario** qué área (y puesto y habilidades) le corresponde, o si prefiere ser
  ADMIN. Se arregla desde la app: Usuarios → su ficha → "Área, puesto y habilidades" (o una
  migración puntual si él lo pide).

### 5.3 Cuentas de prueba en la web publicada
- Ya existe el script `backend/scripts/usuarios-prueba.js` (corre en `npm start`): crea
  `gerencia@`, `jefe@` y `empleado@burgoscorp.test` (Mecanizado) con la contraseña de la variable
  `PASSWORD_PRUEBA`. **El usuario tiene que cargar esa variable en Render** (12+ caracteres, letras y
  números); hasta entonces las cuentas no existen en la publicada. El admin es `admin@burgoscorp.test`.

### 5.4 Documentación final
- `README.md` raíz: sacar "Proyecto en construcción"; dejar descripción, capturas, links (web, APK,
  API), cuentas de prueba, cómo instalar y enlaces a `docs/` y `backend/README.md`.
- `docs/guia-instalacion.md`: actualizar (migraciones automáticas, `PASSWORD_PRUEBA`,
  `EMAIL_AVISOS`, `WEB_URL`, expo-file-system/expo-sharing, build web).
- `docs/como-esta-hecho.md`: sumar lo nuevo — legajos automáticos al habilitar, QR como enlace a la
  web, liquidación de sueldos, sesión web persistente, email a admins por solicitud, tareas del
  administrador derivadas a los jefes, mensajes de error por campo.
- `backend/README.md` ya documenta los endpoints nuevos (revisar que esté completo).

### 5.5 Pruebas que faltan
- Probar en un **teléfono real** el APK: cámara/QR, fotos, descarga de la planilla de sueldos
  (menú compartir), sesión que se mantiene, desplazamiento al campo con error.
- Abrir la **versión publicada** y recorrer las pantallas nuevas (solo se probaron en local).
- Probar el email real de "Nueva solicitud de acceso" (va a `EMAIL_AVISOS`, ya cargado en Render).
- `npm audit` en `backend/` y `mobile/` antes de entregar; reportar lo que aparezca.
- Pasar el agente `revisor-owasp` sobre todo el proyecto antes de la entrega (solo informe).

### 5.6 Mejoras conocidas (no bloquean)
- Liquidación de sueldos: no hay calendario de **feriados** ni aportes/retenciones (es el resumen
  para liquidar, no el recibo).
- En Inicio del jefe se podría mostrar "N tareas para asignar" (hoy está el aviso y el filtro
  "Para asignar" en Tareas del área).

### 5.7 Entrega
- Armar el .zip final **sin `.env`, sin `node_modules`, sin `.expo`/`dist`**, con `.env.example`.
- Incluir el link del último APK en el README.

## 6. Hecho en las últimas sesiones (para no repetirlo)

- Sesión web persistente (refresh en `localStorage`, rotativo y revocado al cerrar sesión).
- Email a los administradores con correo real y a `EMAIL_AVISOS` por cada solicitud de acceso.
- "Pedí acceso" alineado en el login.
- Tareas del administrador: elige área(s) con sugerencia por máquina o habilidad
  (`GET /tareas/destinos`), se crea una por área, avisa a los jefes (`tarea_para_asignar`);
  **asigna el jefe del área**, el admin solo si el área no tiene jefe. Filtro "Para asignar".
- Errores de formularios: campo en rojo, aviso con el nombre del campo, la pantalla va al error.
- El administrador no tiene área ni legajo.
- Liquidación de sueldos (Finanzas) con planilla CSV para Excel; 600 fichajes de ejemplo.
- Usuarios como en R3, legajo automático al habilitar, pantalla Personal, QR como enlace a la web,
  manual de usuario (`docs/manual-de-usuario.md`), capacidades por área (`docs/capacidades-por-area.md`),
  Ayuda dentro de la app.
