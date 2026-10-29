// /api/v1/usuarios · administración de cuentas (módulo SEG, en la práctica solo ADMIN).
import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, transaccion } from '../config/db.js';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import { auditar } from '../services/auditoria.js';
import { revocarTodas } from '../services/tokens.js';
import { notificar } from '../services/notificaciones.js';
import { enviarAviso, enviarCodigo } from '../services/email.js';
import { generarCodigo } from '../services/codigos.js';
import { crearLegajo, actualizarLegajo } from '../services/legajos.js';
import { paramsId, consultaListado, email, nombrePersona } from '../validators/comunes.js';
import { usuarioAdmin } from '../validators/catalogos.js';
import { errores } from '../utils/errores.js';

const router = Router();
router.use(autenticado);

// Nunca se devuelven password_hash ni totp_secret_cifrado.
const SELECT = `
  SELECT u.id, u.email, u.nombre, u.apellido, r.codigo AS rol, u.empleado_id, u.activo, u.estado_cuenta, u.motivo_rechazo,
         u.email_verificado_at IS NOT NULL AS email_verificado, u.totp_habilitado AS dos_pasos,
         u.ultimo_login_at, u.created_at, u.habilitada_at, e.legajo, a.id AS area_id, a.nombre AS area_nombre,
         e.puesto_id, p.nombre AS puesto_nombre,
         (SELECT GROUP_CONCAT(cs.proveedor) FROM cuentas_sociales cs WHERE cs.usuario_id = u.id) AS redes
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN empleados e ON e.id = u.empleado_id
  LEFT JOIN areas a ON a.id = e.area_id
  LEFT JOIN puestos p ON p.id = e.puesto_id`;

// Estado que ve el administrador (como en R3): solicitudes pendientes o rechazadas, o cuentas activas o dadas de baja.
const ESTADOS = {
  activos: "u.estado_cuenta = 'habilitada' AND u.activo = 1",
  inactivos: "u.estado_cuenta = 'habilitada' AND u.activo = 0",
  pendientes: "u.estado_cuenta = 'pendiente'",
  rechazados: "u.estado_cuenta = 'rechazada'",
};
const ORDENES = {
  nombre: 'u.apellido, u.nombre',
  rol: 'r.id, u.apellido, u.nombre',
  area: 'a.nombre IS NULL, a.nombre, u.apellido',
  ultimo_ingreso: 'u.ultimo_login_at IS NULL, u.ultimo_login_at DESC',
  alta: 'u.created_at DESC',
};

// Dónde trabaja la persona: al habilitarla (o crearle la cuenta) se le arma el legajo con su área,
// puesto y habilidades. `empleado_id` queda solo para vincular un legajo que RRHH ya había cargado.
const ROL = z.enum(['ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO']);
const ubicacion = {
  area_id: z.coerce.number().int().positive().optional(),
  puesto_id: z.coerce.number().int().positive().nullable().optional(),
  habilidades: z.array(z.object({
    habilidad_id: z.coerce.number().int().positive(),
    nivel: z.enum(['basico', 'intermedio', 'avanzado']).default('basico'),
  }).strict()).max(20).optional(),
  dni: z.string().trim().regex(/^\d{7,8}$/, 'DNI de 7 u 8 dígitos, sin puntos').optional(),
  empleado_id: z.coerce.number().int().positive().nullable().optional(),
};

/**
 * Devuelve el id del legajo de la persona: el existente que se eligió o uno nuevo con el área,
 * puesto y habilidades. El administrador del sistema no lleva legajo: no pertenece a un área y
 * ve todo igual.
 */
async function legajoPara(conn, persona, datos, rol) {
  if (rol === 'ADMIN') return null;
  if (datos.empleado_id) {
    const [[emp]] = await conn.execute(
      `SELECT e.id, (SELECT u2.id FROM usuarios u2 WHERE u2.empleado_id = e.id) AS usuario_id
       FROM empleados e WHERE e.id = ? AND e.estado <> 'baja'`, [datos.empleado_id]);
    if (!emp) throw errores.validacion([{ campo: 'body.empleado_id', mensaje: 'El legajo no existe o está dado de baja' }]);
    if (emp.usuario_id && emp.usuario_id !== persona.id) throw errores.conflicto('Ese legajo ya tiene una cuenta vinculada');
    return emp.id;
  }
  if (!datos.area_id) throw errores.validacion([{ campo: 'body.area_id', mensaje: 'Elegí el área donde va a trabajar' }]);
  const nuevo = await crearLegajo(conn, { ...datos, nombre: persona.nombre, apellido: persona.apellido, email: persona.email }, rol);
  return nuevo.id;
}

/** Que nunca quede el sistema sin un administrador activo. */
async function exigirOtroAdmin(id, conn) {
  const [[{ otros }]] = await conn.execute(
    `SELECT COUNT(*) AS otros FROM usuarios u JOIN roles r ON r.id = u.rol_id
     WHERE r.codigo = 'ADMIN' AND u.activo = 1 AND u.estado_cuenta = 'habilitada' AND u.id <> ?`, [id]);
  if (otros === 0) throw errores.conflicto('Es el único administrador activo: primero habilitá a otro');
}

router.get('/roles', requierePermiso('SEG', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await query('SELECT id, codigo, nombre, descripcion FROM roles ORDER BY id') });
});

router.get('/', requierePermiso('SEG', 'ver'),
  validar({ query: consultaListado.extend({
    rol: z.enum(['ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO']).optional(),
    estado_cuenta: z.enum(['pendiente', 'habilitada', 'rechazada']).optional(),
    estado: z.enum(['activos', 'inactivos', 'pendientes', 'rechazados']).optional(),
    area_id: z.coerce.number().int().positive().optional(),
    orden: z.enum(['nombre', 'rol', 'area', 'ultimo_ingreso', 'alta']).optional(),
  }) }),
  async (req, res) => {
    const { pagina, limite, q, rol, estado_cuenta: estadoCuenta, estado, area_id: areaId, orden } = req.validado.query;
    const where = ['1=1'];
    const params = [];
    if (q) {
      where.push("(u.email LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ? OR e.legajo LIKE ?)");
      const patron = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      params.push(patron, patron, patron, patron, patron);
    }
    if (rol) { where.push('r.codigo = ?'); params.push(rol); }
    if (estadoCuenta) { where.push('u.estado_cuenta = ?'); params.push(estadoCuenta); }
    if (estado) where.push(ESTADOS[estado]); // texto de la lista blanca, nunca del usuario
    if (areaId) { where.push('e.area_id = ?'); params.push(areaId); }
    const condicion = where.join(' AND ');
    const ordenSql = orden ? ORDENES[orden] : "u.estado_cuenta = 'pendiente' DESC, u.apellido, u.nombre";
    const [filas] = await pool.query(
      `${SELECT} WHERE ${condicion} ORDER BY ${ordenSql} LIMIT ${Number(limite)} OFFSET ${Number((pagina - 1) * limite)}`,
      params,
    );
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM usuarios u JOIN roles r ON r.id = u.rol_id LEFT JOIN empleados e ON e.id = u.empleado_id
       WHERE ${condicion}`, params);
    res.json({ ok: true, data: filas, meta: { pagina, limite, total } });
  });

router.get('/:id', requierePermiso('SEG', 'ver'), validar({ params: paramsId }), async (req, res) => {
  const usuario = await queryOne(`${SELECT} WHERE u.id = ?`, [req.validado.params.id]);
  if (!usuario) throw errores.noEncontrado();
  usuario.habilidades = usuario.empleado_id ? await query(
    `SELECT h.id AS habilidad_id, h.nombre, h.requiere_certificacion, eh.nivel, eh.certificado_vence
     FROM empleado_habilidades eh JOIN habilidades h ON h.id = eh.habilidad_id WHERE eh.empleado_id = ? ORDER BY h.nombre`,
    [usuario.empleado_id]) : [];
  res.json({ ok: true, data: usuario });
});

// Alta de una cuenta para un empleado. Queda sin contraseña: entra con Google/GitHub/Facebook
// usando ese email, o define su contraseña con "Olvidé mi contraseña".
router.post('/', requierePermiso('SEG', 'crear'), validar({
  body: z.object({ email, nombre: nombrePersona, apellido: nombrePersona, rol: ROL, ...ubicacion }).strict(),
}), async (req, res) => {
  const { email: mail, nombre, apellido, rol } = req.validado.body;
  const id = await transaccion(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO usuarios (email, nombre, apellido, rol_id, email_verificado_at)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), UTC_TIMESTAMP())`,
      [mail, nombre, apellido, rol],
    );
    const empleadoId = await legajoPara(conn, { id: r.insertId, nombre, apellido, email: mail }, req.validado.body, rol);
    if (empleadoId) await conn.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [empleadoId, r.insertId]);
    return r.insertId;
  });
  await auditar(req, { accion: 'crear', entidad: 'usuario', entidadId: id, detalle: { rol } });
  res.status(201).json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [id]) });
});

// Área, puesto y habilidades de la persona: si no tiene legajo se le crea; si tiene, se actualiza.
router.put('/:id/legajo', requierePermiso('SEG', 'editar'), validar({
  params: paramsId,
  body: z.object({ ...ubicacion, area_id: z.coerce.number().int().positive() }).omit({ empleado_id: true }).strict(),
}), async (req, res) => {
  const { id } = req.validado.params;
  await transaccion(async (conn) => {
    const [[u]] = await conn.execute(
      'SELECT u.id, u.nombre, u.apellido, u.email, u.empleado_id, r.codigo AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ? FOR UPDATE', [id]);
    if (!u) throw errores.noEncontrado();
    if (u.rol === 'ADMIN') throw errores.conflicto('El administrador del sistema no lleva área ni legajo');
    if (u.empleado_id) {
      await actualizarLegajo(conn, u.empleado_id, req.validado.body, u.rol);
    } else {
      const nuevo = await crearLegajo(conn, { ...req.validado.body, nombre: u.nombre, apellido: u.apellido, email: u.email }, u.rol);
      await conn.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [nuevo.id, id]);
    }
  });
  await auditar(req, { accion: 'editar', entidad: 'legajo', entidadId: id, detalle: { area_id: req.validado.body.area_id } });
  res.json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [id]) });
});

// Cambiar nombre, rol, legajo vinculado o activar/desactivar (dar de baja).
router.put('/:id', requierePermiso('SEG', 'editar'), validar({ params: paramsId, body: usuarioAdmin }), async (req, res) => {
  const { id } = req.validado.params;
  const { nombre, apellido, rol, empleado_id: empleadoId, activo } = req.validado.body;

  // Nadie puede cambiarse su propio rol ni desactivarse (evita escalar privilegios o quedar sin admin).
  if (id === req.usuario.id && (rol !== undefined || activo !== undefined)) {
    throw errores.prohibido('No podés cambiar tu propio rol ni desactivar tu cuenta');
  }

  const actual = await queryOne('SELECT u.id, r.codigo AS rol, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [id]);
  if (!actual) throw errores.noEncontrado();

  await transaccion(async (conn) => {
    // Quitarle el rol de administrador o darlo de baja no puede dejar el sistema sin ninguno.
    if (actual.rol === 'ADMIN' && ((rol !== undefined && rol !== 'ADMIN') || activo === false)) await exigirOtroAdmin(id, conn);
    if (nombre !== undefined) await conn.execute('UPDATE usuarios SET nombre = ? WHERE id = ?', [nombre, id]);
    if (apellido !== undefined) await conn.execute('UPDATE usuarios SET apellido = ? WHERE id = ?', [apellido, id]);
    if (rol !== undefined) {
      await conn.execute('UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE codigo = ?) WHERE id = ?', [rol, id]);
    }
    if (empleadoId !== undefined) await conn.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [empleadoId, id]);
    if (activo !== undefined) await conn.execute('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, id]);
    // Si cambió el rol o se desactivó, se cierran sus sesiones para que el cambio rija ya.
    if ((rol !== undefined && rol !== actual.rol) || activo === false) await revocarTodas(id, conn);
  });

  await auditar(req, { accion: rol !== undefined && rol !== actual.rol ? 'cambio_rol' : 'editar', entidad: 'usuario', entidadId: id,
    detalle: { rolAnterior: actual.rol, rolNuevo: rol, activo, empleadoId } });
  res.json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [id]) });
});

// Le manda a la persona un código para crear o restablecer su contraseña (el admin nunca la ve).
router.post('/:id/restablecer-password', requierePermiso('SEG', 'editar'), validar({ params: paramsId }), async (req, res) => {
  const { id } = req.validado.params;
  const u = await queryOne('SELECT id, email, nombre, activo, estado_cuenta FROM usuarios WHERE id = ?', [id]);
  if (!u) throw errores.noEncontrado();
  if (!u.activo || u.estado_cuenta !== 'habilitada') throw errores.conflicto('La cuenta no está activa');
  const codigo = await generarCodigo(u.id, 'recuperar_password');
  await enviarCodigo({ para: u.email, nombre: u.nombre, tipo: 'recuperar_password', codigo, plantilla: 'crear_password' });
  await auditar(req, { accion: 'recuperacion_enviada_admin', entidad: 'usuario', entidadId: id });
  res.json({ ok: true, data: { mensaje: `Le mandamos a ${u.email} un código para crear su contraseña` } });
});

// Eliminar del todo: solo cuentas sin actividad (solicitudes o cuentas que nunca se usaron).
// Una cuenta con historia (tareas, compras, movimientos...) se da de baja con activo = false.
router.delete('/:id', requierePermiso('SEG', 'borrar'), validar({ params: paramsId }), async (req, res) => {
  const { id } = req.validado.params;
  if (id === req.usuario.id) throw errores.prohibido('No podés eliminar tu propia cuenta');
  await transaccion(async (conn) => {
    const [[u]] = await conn.execute(
      'SELECT u.id, r.codigo AS rol, u.activo, u.estado_cuenta FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ? FOR UPDATE', [id]);
    if (!u) throw errores.noEncontrado();
    if (u.rol === 'ADMIN' && u.activo && u.estado_cuenta === 'habilitada') await exigirOtroAdmin(id, conn);
    try {
      await conn.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        throw errores.conflicto('Esta cuenta tiene actividad registrada: dala de baja en lugar de eliminarla');
      }
      throw err;
    }
  });
  await auditar(req, { accion: 'borrar', entidad: 'usuario', entidadId: id });
  res.json({ ok: true, data: { id } });
});

// ---------------------------------------------------------------- solicitudes de acceso (como en R3)
// Quien se registra queda pendiente: el administrador la habilita (con rol y, si corresponde, el
// legajo del empleado) o la rechaza con un motivo. En los dos casos se le avisa por email.

const paramsYHabilitar = {
  params: paramsId,
  body: z.object({ rol: ROL, ...ubicacion }).strict(),
};

router.post('/:id/habilitar', requierePermiso('SEG', 'aprobar'), validar(paramsYHabilitar), async (req, res) => {
  const { id } = req.validado.params;
  const { rol } = req.validado.body;
  let empleadoId = null;
  const u = await transaccion(async (conn) => {
    const [[actual]] = await conn.execute('SELECT id, email, nombre, apellido, estado_cuenta FROM usuarios WHERE id = ? FOR UPDATE', [id]);
    if (!actual) throw errores.noEncontrado();
    if (actual.estado_cuenta === 'habilitada') throw errores.conflicto('La cuenta ya está habilitada');
    empleadoId = await legajoPara(conn, actual, req.validado.body, rol);
    await conn.execute(
      `UPDATE usuarios SET estado_cuenta = 'habilitada', motivo_rechazo = NULL, habilitada_por = ?, habilitada_at = UTC_TIMESTAMP(),
         rol_id = (SELECT id FROM roles WHERE codigo = ?), empleado_id = ? WHERE id = ?`,
      [req.usuario.id, rol, empleadoId, id]);
    return actual;
  });
  await auditar(req, { accion: 'cuenta_habilitada', entidad: 'usuario', entidadId: id, detalle: { rol, empleadoId } });
  await query("UPDATE notificaciones SET leida_at = UTC_TIMESTAMP() WHERE tipo = 'cuenta_pendiente' AND entidad_id = ? AND leida_at IS NULL", [id]);
  try {
    await enviarAviso({
      para: u.email, nombre: u.nombre, asunto: 'Tu cuenta está habilitada',
      lineas: ['Un administrador habilitó tu cuenta. Ya podés iniciar sesión en la app.'],
    });
  } catch (err) {
    console.error('[usuarios] no se pudo avisar la habilitación', err.message);
  }
  res.json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [id]) });
});

router.post('/:id/rechazar', requierePermiso('SEG', 'aprobar'), validar({
  params: paramsId,
  body: z.object({ motivo: z.string().trim().max(255).optional() }).strict(),
}), async (req, res) => {
  const { id } = req.validado.params;
  if (id === req.usuario.id) throw errores.prohibido('No podés rechazar tu propia cuenta');
  const u = await queryOne('SELECT id, email, nombre, estado_cuenta FROM usuarios WHERE id = ?', [id]);
  if (!u) throw errores.noEncontrado();
  // Solo se rechazan solicitudes: a una cuenta ya habilitada se la desactiva (activo = false).
  if (u.estado_cuenta !== 'pendiente') throw errores.conflicto('Solo se rechazan solicitudes pendientes');
  await transaccion(async (conn) => {
    await conn.execute("UPDATE usuarios SET estado_cuenta = 'rechazada', motivo_rechazo = ? WHERE id = ?", [req.validado.body.motivo || null, id]);
    await revocarTodas(id, conn);
  });
  await auditar(req, { accion: 'cuenta_rechazada', entidad: 'usuario', entidadId: id });
  await query("UPDATE notificaciones SET leida_at = UTC_TIMESTAMP() WHERE tipo = 'cuenta_pendiente' AND entidad_id = ? AND leida_at IS NULL", [id]);
  try {
    await enviarAviso({
      para: u.email, nombre: u.nombre, asunto: 'Tu solicitud de acceso',
      lineas: ['Tu solicitud de acceso no fue aprobada.', ...(req.validado.body.motivo ? [`Motivo: ${req.validado.body.motivo}`] : []),
        'Si creés que es un error, hablá con un administrador.'],
    });
  } catch (err) {
    console.error('[usuarios] no se pudo avisar el rechazo', err.message);
  }
  res.json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [id]) });
});

export default router;
