// Fechas en la zona horaria de la empresa (el servidor trabaja en UTC).
const ZONA = process.env.TZ_EMPRESA || 'America/Argentina/Buenos_Aires'; // validada en config/env.js
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Minutos desde la medianoche, en la hora de la empresa (ej. 08:15 → 495). */
export function minutosDelDia(instante) {
  const [h, m] = formatoHora.format(new Date(instante)).split(':').map(Number);
  return h * 60 + m;
}

/** Hora de la empresa como 'HH:MM'. */
export function horaEmpresa(instante) {
  return formatoHora.format(new Date(instante));
}

/** Fecha de hoy en la empresa, como 'AAAA-MM-DD'. */
export function hoy(ahora = new Date()) {
  return formato.format(ahora);
}

/** Suma días a una fecha 'AAAA-MM-DD'. */
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días hábiles (lunes a viernes) entre dos fechas, ambas incluidas. */
export function diasHabiles(desde, hasta) {
  let cuenta = 0;
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) cuenta++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return cuenta;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' (para mensajes). */
export function fechaAr(fecha) {
  return String(fecha).slice(0, 10).split('-').reverse().join('/');
}
