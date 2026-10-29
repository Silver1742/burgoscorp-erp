// Liquidación de sueldos a partir del fichaje: llegadas tarde, horas trabajadas, horas extra, horas
// faltantes y ausencias sin justificar, en un período. Lo usa Administración y Finanzas.
//
// Reglas (la jornada se configura en jornada_laboral):
//  - Días hábiles: lunes a viernes. Todavía no hay calendario de feriados.
//  - Llegada tarde: la primera entrada del día después de la hora de entrada + la tolerancia.
//  - Día hábil con más horas que la jornada: el excedente es hora extra al recargo de días hábiles.
//  - Sábado o domingo: todas las horas son extra, al recargo de fin de semana.
//  - Las horas extra se cuentan en bloques completos de 30 minutos (quedarse 10 minutos no es extra).
//  - Día hábil con menos horas que la jornada: la diferencia es hora faltante (se descuenta).
//  - Día hábil ya pasado sin fichaje y sin licencia aprobada: ausencia sin justificar (se descuenta la jornada).
//  - Licencia aprobada: el día se paga como trabajado.
//  - Un fichaje sin salida de un día anterior queda como "incompleto" y no suma horas (lo corrige RRHH).
//  - Valor de la hora: el costo por hora del legajo. El sueldo base son los días hábiles del período × la
//    jornada × el valor hora.
import { pool, query, queryOne } from '../config/db.js';
import { errores } from '../utils/errores.js';
import { hoy, sumarDias, minutosDelDia, horaEmpresa } from '../utils/fechas.js';

const MAX_DIAS = 62;
const BLOQUE_EXTRA = 30; // las horas extra se cuentan en bloques completos de media hora
const enBloques = (min) => Math.floor(min / BLOQUE_EXTRA) * BLOQUE_EXTRA;
const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const diaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();
const esHabil = (fecha) => ![0, 6].includes(diaSemana(fecha));
const aFecha = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export async function jornada() {
  const j = await queryOne('SELECT hora_entrada, tolerancia_min, horas_diarias, recargo_extra_habil, recargo_extra_finde FROM jornada_laboral WHERE id = 1');
  if (!j) throw errores.conflicto('Falta configurar la jornada laboral');
  const [h, m] = String(j.hora_entrada).split(':').map(Number);
  return {
    hora_entrada: String(j.hora_entrada).slice(0, 5),
    minuto_entrada: h * 60 + m,
    tolerancia_min: Number(j.tolerancia_min),
    horas_diarias: Number(j.horas_diarias),
    recargo_extra_habil: Number(j.recargo_extra_habil),
    recargo_extra_finde: Number(j.recargo_extra_finde),
  };
}

export function validarPeriodo(desde, hasta) {
  if (hasta < desde) throw errores.validacion([{ campo: 'query.hasta', mensaje: 'La fecha de fin no puede ser anterior a la de inicio' }]);
  const dias = (new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / 86400000 + 1;
  if (dias > MAX_DIAS) throw errores.validacion([{ campo: 'query.hasta', mensaje: `El período puede tener hasta ${MAX_DIAS} días` }]);
}

/** Calcula un empleado día por día. `registros` y `licencias` son solo los suyos. */
function calcularEmpleado(emp, registros, licencias, j, desde, hasta, conDetalle) {
  const hoyEmp = hoy();
  const jornadaMin = j.horas_diarias * 60;
  const inicio = aFecha(emp.fecha_ingreso) > desde ? aFecha(emp.fecha_ingreso) : desde;
  const porDia = new Map();
  for (const r of registros) {
    const f = aFecha(r.fecha);
    if (!porDia.has(f)) porDia.set(f, []);
    porDia.get(f).push(r);
  }
  const conLicencia = (f) => licencias.some((l) => aFecha(l.fecha_desde) <= f && aFecha(l.fecha_hasta) >= f);

  const t = {
    dias_habiles: 0, dias_trabajados: 0, dias_licencia: 0, ausencias: 0, llegadas_tarde: 0, minutos_tarde: 0,
    minutos_trabajados: 0, minutos_extra_habil: 0, minutos_extra_finde: 0, minutos_faltantes: 0, fichajes_incompletos: 0,
  };
  const dias = [];

  for (let f = inicio; f <= hasta; f = sumarDias(f, 1)) {
    const habil = esHabil(f);
    const regs = (porDia.get(f) ?? []).sort((a, b) => new Date(a.entrada_at) - new Date(b.entrada_at));
    const cerrados = regs.filter((r) => r.salida_at);
    const abierto = regs.some((r) => !r.salida_at);
    const trabajado = cerrados.reduce((a, r) => a + Math.max(0, (new Date(r.salida_at) - new Date(r.entrada_at)) / 60000), 0);
    if (abierto && f < hoyEmp) t.fichajes_incompletos += 1;
    t.minutos_trabajados += trabajado;

    const d = { fecha: f, habil, entrada: regs[0] ? horaEmpresa(regs[0].entrada_at) : null,
      salida: cerrados.length ? horaEmpresa(cerrados[cerrados.length - 1].salida_at) : null,
      horas: redondear(trabajado / 60), tarde_min: 0, extra_h: 0, faltante_h: 0, estado: 'futuro', incompleto: abierto && f < hoyEmp };

    if (!habil) {
      d.estado = regs.length ? 'trabajado' : 'franco';
      const extra = enBloques(trabajado);
      t.minutos_extra_finde += extra;
      d.extra_h = redondear(extra / 60);
    } else {
      t.dias_habiles += 1;
      if (f > hoyEmp) {
        d.estado = 'futuro';
      } else if (regs.length) {
        d.estado = 'trabajado';
        t.dias_trabajados += 1;
        const llegada = minutosDelDia(regs[0].entrada_at);
        const limite = j.minuto_entrada + j.tolerancia_min;
        if (llegada > limite) {
          t.llegadas_tarde += 1;
          d.tarde_min = llegada - j.minuto_entrada;
          t.minutos_tarde += d.tarde_min;
        }
        if (trabajado > jornadaMin) {
          const extra = enBloques(trabajado - jornadaMin);
          t.minutos_extra_habil += extra;
          d.extra_h = redondear(extra / 60);
        } else if (f < hoyEmp && !abierto && !conLicencia(f)) {
          t.minutos_faltantes += jornadaMin - trabajado;
          d.faltante_h = redondear((jornadaMin - trabajado) / 60);
        }
      } else if (conLicencia(f)) {
        d.estado = 'licencia';
        t.dias_licencia += 1;
      } else if (f < hoyEmp) {
        d.estado = 'ausente';
        t.ausencias += 1;
      } else {
        d.estado = 'hoy';
      }
    }
    if (conDetalle) dias.push(d);
  }

  const valorHora = Number(emp.costo_hora);
  const sueldoBase = t.dias_habiles * j.horas_diarias * valorHora;
  const extrasHabil = (t.minutos_extra_habil / 60) * valorHora * (1 + j.recargo_extra_habil / 100);
  const extrasFinde = (t.minutos_extra_finde / 60) * valorHora * (1 + j.recargo_extra_finde / 100);
  const descAusencias = t.ausencias * j.horas_diarias * valorHora;
  const descHoras = (t.minutos_faltantes / 60) * valorHora;

  return {
    empleado_id: emp.id, legajo: emp.legajo, nombre: emp.nombre, apellido: emp.apellido, area: emp.area_nombre,
    valor_hora: valorHora,
    dias_habiles: t.dias_habiles, dias_trabajados: t.dias_trabajados, dias_licencia: t.dias_licencia, ausencias: t.ausencias,
    llegadas_tarde: t.llegadas_tarde, minutos_tarde: Math.round(t.minutos_tarde),
    horas_trabajadas: redondear(t.minutos_trabajados / 60),
    horas_extra_habil: redondear(t.minutos_extra_habil / 60), horas_extra_finde: redondear(t.minutos_extra_finde / 60),
    horas_faltantes: redondear(t.minutos_faltantes / 60), fichajes_incompletos: t.fichajes_incompletos,
    sueldo_base: redondear(sueldoBase), adicional_extras: redondear(extrasHabil + extrasFinde),
    descuento_ausencias: redondear(descAusencias), descuento_horas: redondear(descHoras),
    total: redondear(sueldoBase + extrasHabil + extrasFinde - descAusencias - descHoras),
    ...(conDetalle ? { dias } : {}),
  };
}

/** Liquidación de todos los empleados (o de un área, o de una persona) en el período. */
export async function liquidar({ desde, hasta, areaId, empleadoId, conDetalle = false }) {
  validarPeriodo(desde, hasta);
  const j = await jornada();
  const where = ["e.estado <> 'baja'", 'e.fecha_ingreso <= ?'];
  const params = [hasta];
  if (areaId) { where.push('e.area_id = ?'); params.push(areaId); }
  if (empleadoId) { where.push('e.id = ?'); params.push(empleadoId); }
  const empleados = await query(
    `SELECT e.id, e.legajo, e.nombre, e.apellido, e.costo_hora, e.fecha_ingreso, a.nombre AS area_nombre
     FROM empleados e JOIN areas a ON a.id = e.area_id WHERE ${where.join(' AND ')} ORDER BY a.nombre, e.apellido, e.nombre`, params);
  if (empleadoId && !empleados.length) throw errores.noEncontrado();
  if (!empleados.length) return { desde, hasta, jornada: j, empleados: [], totales: null };

  // pool.query (no execute) para que mysql2 expanda la lista de IN (?); los valores van igual escapados.
  const ids = empleados.map((e) => e.id);
  const [registros] = await pool.query(
    'SELECT empleado_id, fecha, entrada_at, salida_at FROM asistencias WHERE empleado_id IN (?) AND fecha BETWEEN ? AND ?', [ids, desde, hasta]);
  const [licencias] = await pool.query(
    `SELECT empleado_id, fecha_desde, fecha_hasta FROM solicitudes_licencia
     WHERE empleado_id IN (?) AND estado = 'aprobada' AND fecha_desde <= ? AND fecha_hasta >= ?`, [ids, hasta, desde]);

  const filas = empleados.map((e) => calcularEmpleado(e,
    registros.filter((r) => r.empleado_id === e.id), licencias.filter((l) => l.empleado_id === e.id), j, desde, hasta, conDetalle));

  const suma = (k) => redondear(filas.reduce((a, f) => a + f[k], 0));
  const totales = {
    empleados: filas.length, llegadas_tarde: suma('llegadas_tarde'), ausencias: suma('ausencias'),
    horas_trabajadas: suma('horas_trabajadas'), horas_extra: redondear(suma('horas_extra_habil') + suma('horas_extra_finde')),
    horas_faltantes: suma('horas_faltantes'), sueldo_base: suma('sueldo_base'), adicional_extras: suma('adicional_extras'),
    descuentos: redondear(suma('descuento_ausencias') + suma('descuento_horas')), total: suma('total'),
  };
  return { desde, hasta, jornada: { ...j, minuto_entrada: undefined }, empleados: filas, totales };
}
