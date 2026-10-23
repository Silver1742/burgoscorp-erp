// /api/v1/usuarios · administración de cuentas (módulo SEG, en la práctica solo ADMIN).
import { Router } from 'express';
import { z } from 'zod';
import { pool, query, queryOne, transaccion } from '../config/db.js';
import { autenticado } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import { auditar } from '../services/auditoria.js';
import { revocarTodas } from '../services/tokens.js';
import { paramsId, consultaListado, email, nombrePersona } from '../validators/comunes.js';
import { usuarioAdmin } from '../validators/catalogos.js';
import { errores } from '../utils/errores.js';

const router = Router();
router.use(autenticado);

// Nunca se devuelven password_hash ni totp_secret_cifrado.
const SELECT = `
  SELECT u.id, u.email, u.nombre, u.apellido, r.codigo AS rol, u.empleado_id, u.activo,
         u.email_verificado_at IS NOT NULL AS email_verificado, u.totp_habilitado AS dos_pasos,
         u.ultimo_login_at, u.created_at, e.legajo, a.nombre AS area_nombre,
         (SELECT GROUP_CONCAT(cs.proveedor) FROM cuentas_sociales cs WHERE cs.usuario_id = u.id) AS redes
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN empleados e ON e.id = u.empleado_id
  LEFT JOIN areas a ON a.id = e.area_id`;

router.get('/roles', requierePermiso('SEG', 'ver'), async (req, res) => {
  res.json({ ok: true, data: await query('SELECT id, codigo, nombre, descripcion FROM roles ORDER BY id') });
});

router.get('/', requierePermiso('SEG', 'ver'),
  validar({ query: consultaListado.extend({ rol: z.enum(['ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO']).optional() }) }),
  async (req, res) => {
    const { pagina, limite, q, rol } = req.validado.query;
    const where = ['1=1'];
    const params = [];
    if (q) {
      where.push('(u.email LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)');
      const patron = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      params.push(patron, patron, patron);
    }
    if (rol) { where.push('r.codigo = ?'); params.push(rol); }
    const condicion = where.join(' AND ');
    const [filas] = await pool.query(
      `${SELECT} WHERE ${condicion} ORDER BY u.apellido, u.nombre LIMIT ${Number(limite)} OFFSET ${Number((pagina - 1) * limite)}`,
      params,
    );
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE ${condicion}`, params);
    res.json({ ok: true, data: filas, meta: { pagina, limite, total } });
  });

router.get('/:id', requierePermiso('SEG', 'ver'), validar({ params: paramsId }), async (req, res) => {
  const usuario = await queryOne(`${SELECT} WHERE u.id = ?`, [req.validado.params.id]);
  if (!usuario) throw errores.noEncontrado();
  res.json({ ok: true, data: usuario });
});

// Alta de una cuenta para un empleado. Queda sin contraseña: entra con Google/GitHub/Facebook
// usando ese email, o define su contraseña con "Olvidé mi contraseña".
router.post('/', requierePermiso('SEG', 'crear'), validar({
  body: z.object({
    email,
    nombre: nombrePersona,
    apellido: nombrePersona,
    rol: z.enum(['ADMIN', 'GERENCIA', 'JEFE', 'EMPLEADO']),
    empleado_id: z.coerce.number().int().positive().nullable().optional(),
  }).strict(),
}), async (req, res) => {
  const { email: mail, nombre, apellido, rol, empleado_id: empleadoId = null } = req.validado.body;
  const [r] = await pool.execute(
    `INSERT INTO usuarios (email, nombre, apellido, rol_id, empleado_id, email_verificado_at)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE codigo = ?), ?, UTC_TIMESTAMP())`,
    [mail, nombre, apellido, rol, empleadoId],
  );
  await auditar(req, { accion: 'crear', entidad: 'usuario', entidadId: r.insertId, detalle: { rol } });
  res.status(201).json({ ok: true, data: await queryOne(`${SELECT} WHERE u.id = ?`, [r.insertId]) });
});

// Cambiar rol, legajo vinculado o activar/desactivar.
router.put('/:id', requierePermiso('SEG', 'editar'), validar({ params: paramsId, body: usuarioAdmin }), async (req, res) => {
  const { id } = req.validado.params;
  const { rol, empleado_id: empleadoId, activo } = req.validado.body;

  // Nadie puede cambiarse su propio rol ni desactivarse (evita escalar privilegios o quedar sin admin).
  if (id === req.usuario.id && (rol !== undefined || activo !== undefined)) {
    throw errores.prohibido('No podés cambiar tu propio rol ni desactivar tu cuenta');
  }

  const actual = await queryOne('SELECT u.id, r.codigo AS rol, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [id]);
  if (!actual) throw errores.noEncontrado();

  await transaccion(async (conn) => {
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

export default router;
