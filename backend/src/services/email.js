// Envío de correos. Con BREVO_API_KEY sale por la API HTTPS de Brevo; si no, con SMTP configurado
// usa ese servidor; sin ninguno de los dos:
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

/** "Nombre <correo@x>" → { name, email } para la API de Brevo. */
function remitente(from) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

async function enviarPorBrevo({ para, asunto, texto, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: remitente(env.SMTP_FROM),
      to: [{ email: para }],
      subject: asunto,
      textContent: texto,
      htmlContent: html ?? `<pre>${escapar(texto)}</pre>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // Solo el código HTTP: la respuesta puede repetir datos del envío y la clave nunca se registra.
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}`);
}

async function enviar({ para, asunto, texto, html }) {
  if (env.BREVO_API_KEY) {
    await enviarPorBrevo({ para, asunto, texto, html });
    return;
  }
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
    asunto: 'Tu código para ingresar',
    intro: 'Alguien ingresó tu contraseña. Para terminar de entrar, escribí este código en',
  },
  activar_2fa: {
    asunto: 'Activá la verificación en dos pasos',
    intro: 'Escribí este código en la app para activar la verificación en dos pasos en',
    pasos: 'Desde que la actives, cada vez que ingreses con tu contraseña te vamos a mandar un código como este.',
  },
  desactivar_2fa: {
    asunto: 'Desactivar la verificación en dos pasos',
    intro: 'Pediste desactivar la verificación en dos pasos en',
  },
  // Lo manda el administrador (el código es de tipo recuperar_password).
  crear_password: {
    asunto: 'Creá tu contraseña',
    intro: 'Un administrador te mandó este código para que crees tu contraseña en',
    pasos: 'En la app tocá "¿Olvidaste tu contraseña?" → "Ya tengo un código" e ingresá tu email, este código y tu nueva contraseña.',
  },
};

/** Aviso de texto simple (cuenta habilitada o rechazada). */
export async function enviarAviso({ para, nombre, asunto, lineas }) {
  const texto = `Hola ${nombre}:\n\n${lineas.join('\n')}\n`;
  const html = `<p>Hola ${escapar(nombre)}:</p>${lineas.map((l) => `<p>${escapar(l)}</p>`).join('')}`;
  await enviar({ para, asunto: `${asunto} · ${env.APP_NOMBRE}`, texto, html });
}

/**
 * Manda un código de 6 dígitos. El código nunca se guarda ni se registra en logs de producción.
 * `plantilla` elige el texto cuando no es el del tipo (ej. el admin manda un código de recuperación
 * para que la persona cree su contraseña).
 */
export async function enviarCodigo({ para, nombre, tipo, codigo, plantilla = tipo }) {
  const t = TEXTOS[plantilla];
  const texto = `Hola ${nombre}:\n\n${t.intro} ${env.APP_NOMBRE}:\n\n    ${codigo}\n\n`
    + (t.pasos ? `${t.pasos}\n` : '')
    + 'Vence en 10 minutos y sirve una sola vez.\n'
    + 'Si no fuiste vos, ignorá este mensaje y, si se repite, cambiá tu contraseña.\n';
  const html = `<p>Hola ${escapar(nombre)}:</p><p>${escapar(t.intro)} ${escapar(env.APP_NOMBRE)}:</p>`
    + `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${escapar(codigo)}</p>`
    + (t.pasos ? `<p>${escapar(t.pasos)}</p>` : '')
    + '<p>Vence en 10 minutos y sirve una sola vez.</p>'
    + '<p style="color:#666">Si no fuiste vos, ignorá este mensaje y, si se repite, cambiá tu contraseña.</p>';
  await enviar({ para, asunto: `${t.asunto} · ${env.APP_NOMBRE}`, texto, html });
}
