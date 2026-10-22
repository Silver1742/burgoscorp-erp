// Registro, login con email y contraseña, sesiones y cambio de contraseña.
import bcrypt from 'bcryptjs';
import { query, queryOne, transaccion } from '../config/db.js';
import { errores, AppError } from '../utils/errores.js';
import { auditar } from './auditoria.js';
import { buscarUsuarioPorId, perfilPublico } from './usuarios.js';
import { firmarAcceso, firmarTemporal, emitirRefresh, rotarRefresh, revocarFamilia, revocarTodas } from './tokens.js';

const COSTO_BCRYPT = 12;
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
// Hash de relleno: si el email no existe se compara igual, para que el tiempo
// de respuesta no revele qué emails están registrados.
const HASH_FALSO = bcrypt.hashSync('contraseña-que-no-existe', COSTO_BCRYPT);

const credencialesInvalidas = () => errores.noAutenticado('Email o contraseña incorrectos');

/** Crea el par de tokens de una sesión nueva. */
export async function emitirSesion(usuario, req) {
  const refresh = await emitirRefresh(usuario.id, req);
  await query('UPDATE usuarios SET ultimo_login_at = UTC_TIMESTAMP() WHERE id = ?', [usuario.id]);
  return {
    accessToken: firmarAcceso(usuario),
    refreshToken: refresh.token,
    usuario: perfilPublico(usuario),
  };
}

export async function registrar({ email, password, nombre, apellido }, req) {
  const existe = await queryOne('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) throw errores.conflicto('No se pudo registrar con ese email. Si ya tenés cuenta, iniciá sesión.');

  const hash = await bcrypt.hash(password, COSTO_BCRYPT);
  // Toda cuenta nueva es EMPLEADO sin legajo: un administrador la vincula y le asigna el rol.
  const res = await query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id)
     VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE codigo = 'EMPLEADO'))`,
    [email, hash, nombre, apellido],
  );
  await auditar(req, { accion: 'registro', entidad: 'usuario', entidadId: res.insertId, usuarioId: res.insertId });

  const usuario = await buscarUsuarioPorId(res.insertId);
  return emitirSesion(usuario, req);
}

/**
 * Login con email y contraseña. Si el usuario tiene 2FA activo no se entrega la
 * sesión: se devuelve un token temporal para completar el segundo paso.
 */
export async function login({ email, password }, req) {
  const fila = await queryOne(
    'SELECT id, password_hash, activo, intentos_fallidos, bloqueado_hasta, totp_habilitado FROM usuarios WHERE email = ?',
    [email],
  );

  if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    await auditar(req, { accion: 'login_bloqueado', usuarioId: fila.id });
    throw new AppError(423, 'CUENTA_BLOQUEADA',
      `Demasiados intentos fallidos. Probá de nuevo en ${MINUTOS_BLOQUEO} minutos.`);
  }

  const passwordOk = await bcrypt.compare(password, fila?.password_hash ?? HASH_FALSO);
  if (!fila || !fila.password_hash || !passwordOk) {
    if (fila) await registrarIntentoFallido(fila);
    await auditar(req, { accion: 'login_fallido', usuarioId: fila?.id ?? null, detalle: { metodo: 'password' } });
    throw credencialesInvalidas();
  }

  if (!fila.activo) {
    await auditar(req, { accion: 'login_cuenta_inactiva', usuarioId: fila.id });
    throw errores.prohibido('Tu cuenta está desactivada. Contactá a un administrador.');
  }

  await query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [fila.id]);

  if (fila.totp_habilitado) {
    return { requiere2fa: true, tokenTemporal: firmarTemporal(fila.id, '2fa') };
  }

  await auditar(req, { accion: 'login_ok', usuarioId: fila.id, detalle: { metodo: 'password' } });
  return emitirSesion(await buscarUsuarioPorId(fila.id), req);
}

async function registrarIntentoFallido(fila) {
  const intentos = fila.intentos_fallidos + 1;
  if (intentos >= MAX_INTENTOS) {
    await query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?',
      [new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000), fila.id]);
  } else {
    await query('UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?', [intentos, fila.id]);
  }
}

/** Renueva la sesión. Vuelve a leer el usuario: si lo desactivaron, no renueva. */
export async function renovar(refreshToken, req) {
  const { usuarioId, refreshToken: nuevo } = await rotarRefresh(refreshToken, req);
  const usuario = await buscarUsuarioPorId(usuarioId);
  if (!usuario?.activo) {
    await revocarTodas(usuarioId);
    throw errores.noAutenticado('Tu cuenta está desactivada');
  }
  return { accessToken: firmarAcceso(usuario), refreshToken: nuevo, usuario: perfilPublico(usuario) };
}

export async function logout(refreshToken, req) {
  await revocarFamilia(refreshToken);
  await auditar(req, { accion: 'logout' });
}

export async function cerrarTodasLasSesiones(usuarioId, req) {
  await revocarTodas(usuarioId);
  await auditar(req, { accion: 'logout_todas' });
}

/**
 * Cambia la contraseña. Si la cuenta solo usaba redes sociales, `actual` no se pide
 * (es la forma de agregar una contraseña). Cierra todas las demás sesiones.
 */
export async function cambiarPassword(usuarioId, { actual, nueva }, req) {
  const fila = await queryOne('SELECT password_hash FROM usuarios WHERE id = ?', [usuarioId]);
  if (fila.password_hash) {
    if (!actual || !(await bcrypt.compare(actual, fila.password_hash))) {
      await auditar(req, { accion: 'cambio_password_fallido' });
      throw errores.validacion([{ campo: 'body.actual', mensaje: 'La contraseña actual no es correcta' }]);
    }
  }
  const hash = await bcrypt.hash(nueva, COSTO_BCRYPT);
  await transaccion(async (conn) => {
    await conn.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, usuarioId]);
    await revocarTodas(usuarioId, conn);
  });
  await auditar(req, { accion: 'cambio_password' });
  return emitirSesion(await buscarUsuarioPorId(usuarioId), req);
}
