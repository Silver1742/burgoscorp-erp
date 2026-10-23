// Fechas en la zona horaria de la empresa (el servidor trabaja en UTC).
const ZONA = process.env.TZ_EMPRESA || 'America/Argentina/Buenos_Aires';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

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
