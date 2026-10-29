// Carga y valida las variables de entorno una sola vez.
// Si falta algo obligatorio, la API no arranca (mejor fallar al inicio que en producción).
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  // Cantidad de proxies delante de la API (Render/Railway = 1). 0 en desarrollo.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  // Certificado (PEM) de la autoridad del proveedor, si no es una pública (ej. Aiven). Se puede pegar
  // con saltos de línea reales o con \n.
  DB_SSL_CA: z.string().default(''),

  // Secretos de firma: mínimo 32 caracteres. Generar con:
  // node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  // Duración del token de acceso en minutos ("15m"), como máximo una hora.
  JWT_ACCESS_EXPIRES: z.string().regex(/^\d{1,2}m$/, 'JWT_ACCESS_EXPIRES va en minutos, por ejemplo 15m')
    .refine((v) => Number.parseInt(v, 10) >= 1 && Number.parseInt(v, 10) <= 60, 'JWT_ACCESS_EXPIRES: entre 1m y 60m')
    .default('15m'),
  JWT_TEMP_SECRET: z.string().min(32, 'JWT_TEMP_SECRET debe tener al menos 32 caracteres'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  // Clave propia para el HMAC de los códigos por email y de respaldo (no se reutiliza la de los JWT).
  CODIGOS_HMAC_KEY: z.string().min(32, 'CODIGOS_HMAC_KEY debe tener al menos 32 caracteres'),
  // Solicitudes de acceso desde la app (quedan pendientes hasta que las habilita un administrador).
  // false: solo el administrador crea cuentas.
  REGISTRO_ABIERTO: z.enum(['true', 'false']).default('true'),
  // Zona horaria de la empresa (fechas de "hoy", vencimientos, fichaje).
  TZ_EMPRESA: z.string().default('America/Argentina/Buenos_Aires')
    .refine((v) => { try { new Intl.DateTimeFormat('es-AR', { timeZone: v }); return true; } catch { return false; } }, 'TZ_EMPRESA no es una zona horaria válida'),

  // Orígenes web permitidos por CORS (la app nativa no envía Origin). Separados por coma.
  CORS_ORIGINS: z.string().default(''),

  // Clave AES-256 para cifrar los secretos 2FA en la base: 32 bytes en base64, 64 caracteres
  // hexadecimales, o un valor aleatorio de 32+ caracteres (ej. "Generate" de Render), del que se
  // deriva la clave con SHA-256.
  TOTP_ENC_KEY: z.string().min(32, 'TOTP_ENC_KEY debe tener al menos 32 caracteres'),
  APP_NOMBRE: z.string().max(40).default('BurgosCorp ERP'),
  // Carpeta de las fotos y archivos subidos (fuera de cualquier carpeta pública).
  UPLOADS_DIR: z.string().default('uploads'),

  // Correo saliente. Sin SMTP_HOST, en desarrollo los correos se muestran en la consola.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('BurgosCorp ERP <no-responder@burgoscorp.test>'),
  // Clave de la API de Brevo: si está, los correos salen por HTTPS en vez de SMTP (Render gratis
  // bloquea los puertos SMTP). El remitente es el de SMTP_FROM, verificado en Brevo.
  BREVO_API_KEY: z.string().default(''),

  // Login social (vacío = proveedor deshabilitado)
  GOOGLE_CLIENT_IDS: z.string().default(''),   // ids de cliente web/android/ios separados por coma
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),
  // Redirect URIs aceptadas en el canje de código (GitHub). Separadas por coma.
  OAUTH_REDIRECT_URIS: z.string().default(''),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const faltantes = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Configuración inválida en .env:\n${faltantes.join('\n')}`);
  process.exit(1);
}

const env = resultado.data;

if (new Set([env.JWT_ACCESS_SECRET, env.JWT_TEMP_SECRET, env.CODIGOS_HMAC_KEY]).size !== 3) {
  console.error('JWT_ACCESS_SECRET, JWT_TEMP_SECRET y CODIGOS_HMAC_KEY deben ser distintos.');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && env.TRUST_PROXY === 0 && process.env.SIN_PROXY !== 'true') {
  console.error('En producción definí TRUST_PROXY (1 en Railway o Render): si no, todos los usuarios cuentan como una sola IP'
    + ' para los límites de intentos. Si de verdad no hay proxy delante, definí SIN_PROXY=true.');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && !env.SMTP_HOST && !env.BREVO_API_KEY) {
  console.error('En producción hace falta SMTP_HOST o BREVO_API_KEY para enviar los códigos por email.');
  process.exit(1);
}

const lista = (v) => v.split(',').map((o) => o.trim()).filter(Boolean);

/** Opciones TLS de MySQL: siempre se verifica el certificado del servidor. */
const dbSsl = env.DB_SSL === 'true'
  ? { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) }
  : undefined;

export default {
  ...env,
  dbSsl,
  esProduccion: env.NODE_ENV === 'production',
  registroAbierto: env.REGISTRO_ABIERTO === 'true',
  corsOrigins: lista(env.CORS_ORIGINS),
  googleClientIds: lista(env.GOOGLE_CLIENT_IDS),
  oauthRedirectUris: lista(env.OAUTH_REDIRECT_URIS),
};
