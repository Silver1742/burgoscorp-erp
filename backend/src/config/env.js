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

  // Secretos de firma: mínimo 32 caracteres. Generar con:
  // node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_TEMP_SECRET: z.string().min(32, 'JWT_TEMP_SECRET debe tener al menos 32 caracteres'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(60).default(7),

  // Orígenes web permitidos por CORS (la app nativa no envía Origin). Separados por coma.
  CORS_ORIGINS: z.string().default(''),

  // Clave AES-256 (32 bytes en base64) para cifrar los secretos 2FA en la base.
  TOTP_ENC_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32,
    'TOTP_ENC_KEY debe ser 32 bytes en base64'),
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

if (env.JWT_ACCESS_SECRET === env.JWT_TEMP_SECRET) {
  console.error('JWT_ACCESS_SECRET y JWT_TEMP_SECRET deben ser distintos.');
  process.exit(1);
}

if (env.NODE_ENV === 'production' && !env.SMTP_HOST) {
  console.error('En producción hace falta SMTP_HOST para enviar los códigos por email.');
  process.exit(1);
}

const lista = (v) => v.split(',').map((o) => o.trim()).filter(Boolean);

export default {
  ...env,
  esProduccion: env.NODE_ENV === 'production',
  corsOrigins: lista(env.CORS_ORIGINS),
  googleClientIds: lista(env.GOOGLE_CLIENT_IDS),
  oauthRedirectUris: lista(env.OAUTH_REDIRECT_URIS),
};
