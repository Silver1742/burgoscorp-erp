// Envío de correos. Con SMTP configurado usa ese servidor; sin SMTP:
//   - en desarrollo muestra el correo en la consola (para probar sin cuenta de correo),
//   - en test lo guarda en memoria (`bandejaDePrueba`) para que los tests lean el código.
import nodemailer from 'nodemailer';
import env from '../config/env.js';

export const bandejaDePrueba = [];

const transporte = env.SMTP_HOST
  ? nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    requireTLS: env.SMTP_SECURE !== 'true', // STARTTLS obligatorio en el puerto 587
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  })
  : null;

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function enviar({ para, asunto, texto, html }) {
  if (env.NODE_ENV === 'test' && !transporte) {
    bandejaDePrueba.push({ para, asunto, texto });
    return;
  }
  if (!transporte) {
    // Solo en desarrollo: no hay servidor de correo, se muestra en consola.
    console.log(`\n[email de desarrollo] Para: ${para}\nAsunto: ${asunto}\n${texto}\n`);
    return;
  }
  await transporte.sendMail({ from: env.SMTP_FROM, to: para, subject: asunto, text: texto, html });
}

const TEXTOS = {
  verificar_email: {
    asunto: 'Confirmá tu email',
    intro: 'Usá este código para confirmar tu email en',
  },
  recuperar_password: {
    asunto: 'Restablecer contraseña',
    intro: 'Pediste restablecer tu contraseña en',
  },
  login_email: {
    asunto: 'Código de inicio de sesión',
    intro: 'Tu código para completar el inicio de sesión en',
  },
};

/** Aviso de texto simple (cuenta habilitada o rechazada). */
export async function enviarAviso({ para, nombre, asunto, lineas }) {
  const texto = `Hola ${nombre}:\n\n${lineas.join('\n')}\n`;
  const html = `<p>Hola ${escapar(nombre)}:</p>${lineas.map((l) => `<p>${escapar(l)}</p>`).join('')}`;
  await enviar({ para, asunto: `${asunto} · ${env.APP_NOMBRE}`, texto, html });
}

/** Manda un código de 6 dígitos. El código nunca se guarda ni se registra en logs de producción. */
export async function enviarCodigo({ para, nombre, tipo, codigo }) {
  const t = TEXTOS[tipo];
  const texto = `Hola ${nombre}:\n\n${t.intro} ${env.APP_NOMBRE}:\n\n    ${codigo}\n\n`
    + 'Vence en 10 minutos y sirve una sola vez.\n'
    + 'Si no fuiste vos, ignorá este mensaje y, si se repite, cambiá tu contraseña.\n';
  const html = `<p>Hola ${escapar(nombre)}:</p><p>${escapar(t.intro)} ${escapar(env.APP_NOMBRE)}:</p>`
    + `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escapar(codigo)}</p>`
    + '<p>Vence en 10 minutos y sirve una sola vez.</p>'
    + '<p style="color:#666">Si no fuiste vos, ignorá este mensaje y, si se repite, cambiá tu contraseña.</p>';
  await enviar({ para, asunto: `${t.asunto} · ${env.APP_NOMBRE}`, texto, html });
}
