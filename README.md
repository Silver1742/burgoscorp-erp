# BurgosCorp ERP

Sistema de gestión empresarial (ERP tipo SAP R/3) para **BurgosCorp S.A.**, un taller industrial
que trabaja a pedido: reparación, diseño, prototipos, fabricación y mecanizado de piezas con
impresión 3D, torneado, CNC, soldadura y herrería.

- **App:** React Native con Expo (Android y web) en **TypeScript (TSX)**, Context API, Expo Router.
- **API:** Node.js + Express 5, REST en `/api/v1`, JWT de acceso + refresh rotativo.
- **Base de datos:** MySQL 8 / MariaDB 10.4+.

## Probarlo

| Qué | Dónde |
|---|---|
| Versión web | <https://burgoscorp-erp.onrender.com> |
| APK de Android | El link del último APK está en [`docs/publicar.md`](docs/publicar.md#5-apk-con-eas-build) (EAS Build) |
| API | <https://burgoscorp-api.onrender.com/api/v1/health> |

> El servidor es gratuito: la primera consulta del día puede tardar unos 30 segundos.

**Cuentas de prueba** (una por rol; la contraseña la da el autor):

| Rol | Email |
|---|---|
| Administrador | `admin@burgoscorp.test` |
| Gerencia | `gerencia@burgoscorp.test` |
| Jefe de área (Mecanizado) | `jorge.dominguez@burgoscorp.test` |
| Empleado (Mecanizado) | `empleado@burgoscorp.test` |

También se puede **pedir acceso** desde la app (con email y contraseña, o con **Google, GitHub o
Discord**): la cuenta queda pendiente hasta que la habilita el administrador.

## Qué hace

| Módulo | Equivalente SAP | Qué gestiona |
|---|---|---|
| Usuarios y organización | — | Solicitudes de acceso, roles, áreas, puestos, un jefe por área, organigrama |
| Recursos Humanos | HR | Legajos, habilidades y certificaciones, fichaje, licencias, EPP |
| Ventas | SD | Clientes, pedidos con fotos, presupuestos → orden de trabajo automática |
| Producción | PP | Órdenes de trabajo, operaciones por máquina, centros de trabajo |
| Tareas | PS | Asignación por habilidad (la hace el jefe de cada área), estados, horas, fotos, revisión |
| Inventario y Compras | MM | Stock, reservas, órdenes de compra, recepción con QR |
| Mantenimiento | PM | Fallas con foto, reparaciones, preventivos |
| Calidad | QM | Inspecciones con mediciones y tolerancias, retrabajos |
| Finanzas | FI | Facturas, cobros y pagos, liquidación de sueldos con planilla |
| Tablero | — | Indicadores por rol |

Cada rol tiene **su propia interfaz** (color, pestañas e Inicio): Empleado (Mi día), Jefe de área
(Mi área y Mi equipo), Gerencia (La empresa y Áreas) y Administrador (Administración y Áreas). Una
búsqueda general encuentra personas, pedidos, OT, tareas, máquinas, materiales y pantallas.

## Cómo cumple la consigna

| Requisito | Dónde |
|---|---|
| Registro e inicio de sesión | `POST /auth/registro`, `/auth/login`; pantallas `app/(auth)` |
| 3 redes sociales (Google obligatorio) | Google, GitHub y Discord: [`docs/guia-oauth.md`](docs/guia-oauth.md) |
| Otra verificación | Verificación en dos pasos con código por email; confirmación del email |
| 3 roles distintos | 4 roles (Administrador, Gerencia, Jefe de área, Empleado) con permisos por módulo y área |
| CRUD por API REST | [`backend/README.md`](backend/README.md) |
| Manejo de errores | Campo en rojo con el mensaje, avisos con el campo a revisar, sin conexión / tiempo agotado |
| Navegación y UX | Expo Router (pestañas por rol y pilas), toasts, modo claro/oscuro |
| Estado global (Context API) | `mobile/src/contexto/` (sesión, tema, avisos) |
| Sesión persistente | SecureStore en el teléfono; en la web sobrevive a recargar |
| Responsive | Celular, tablet y escritorio; orientación libre |
| JWT de acceso y renovación | Access de 15 min; refresh rotativo con detección de reuso |
| MySQL y middlewares | `backend/db/schema.sql`; autenticación, permisos, validación, límites, cabeceras, errores |
| Documentación de la API | [`backend/README.md`](backend/README.md) |
| Manual de usuario | [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md) (también en PDF, llega por email al habilitar la cuenta) |
| Tutorial: un pedido de punta a punta | [`docs/tutorial-pedido.md`](docs/tutorial-pedido.md) (con qué cuenta se hace cada paso) |
| Guía de instalación | [`docs/guia-instalacion.md`](docs/guia-instalacion.md) |
| APK | EAS Build, perfil `preview` |

## Estructura

```
.
├── backend/            API REST (Express)
│   ├── db/             schema.sql y seed.sql
│   ├── scripts/        init-db, migraciones, seed, cuentas de prueba
│   ├── src/            config, routes, middlewares, services, validators, utils
│   ├── assets/         manual de usuario en PDF (adjunto del email de bienvenida)
│   └── tests/          tests de la API (node --test + supertest)
├── mobile/             App React Native (Expo) en TypeScript: componentes .tsx, lógica .ts
│   └── src/            app (pantallas), componentes, contexto, lib, tema
└── docs/               manual, guía de instalación, guía OAuth, publicación y cómo está hecho
```

## Instalar y ejecutar

Resumen (el paso a paso, con las variables de entorno, está en
[`docs/guia-instalacion.md`](docs/guia-instalacion.md)):

```bash
# API
cd backend
cp .env.example .env      # completar con tus datos (nunca subir el .env)
npm install
npm run db:init           # crea las tablas y aplica las migraciones
npm run seed              # datos de prueba
npm run dev               # http://localhost:3000/api/v1

# App
cd mobile
cp .env.example .env
npm install
npx expo start            # w = navegador, o Expo Go en el celular
```

Tests de la API: `cd backend && npm test`.

## Documentación

- [Manual de usuario](docs/manual-de-usuario.md)
- [Tutorial: un pedido de punta a punta](docs/tutorial-pedido.md)
- [Qué puede hacer cada área, rol y habilidad](docs/capacidades-por-area.md)
- [Documentación de la API](backend/README.md)
- [Guía de instalación](docs/guia-instalacion.md)
- [Ingreso con Google, GitHub y Discord](docs/guia-oauth.md)
- [Publicación (Render, Aiven, Brevo, EAS)](docs/publicar.md)
- [Cómo está hecho](docs/como-esta-hecho.md)

## Seguridad

Desarrollado siguiendo OWASP: contraseñas con bcrypt, JWT cortos con refresh rotativo, permisos
validados en el servidor por rol, módulo y área, consultas parametrizadas, validación de entrada
con zod, límite de intentos, cabeceras de seguridad (helmet), auditoría de acciones sensibles y
secretos solo en variables de entorno (el repositorio trae `.env.example`, nunca `.env`).
