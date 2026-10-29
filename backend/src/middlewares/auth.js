// Autenticación: exige `Authorization: Bearer <accessToken>` y carga el usuario actualizado.
import { verificarAcceso } from '../services/tokens.js';
import { buscarUsuarioPorId } from '../services/usuarios.js';
import { errores, AppError } from '../utils/errores.js';
import { auditar } from '../services/auditoria.js';

export async function autenticar(req, res, next) {
  const [esquema, token] = (req.get('authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) return next(errores.noAutenticado());

  let payload;
  try {
    payload = verificarAcceso(token);
  } catch (err) {
    if (err.codigo !== 'TOKEN_EXPIRADO') await auditar(req, { accion: 'token_invalido', usuarioId: null });
    return next(err);
  }

  // Se lee de la base en cada petición: si un admin desactiva la cuenta o
  // cambia el rol, el cambio rige de inmediato y no recién cuando vence el token.
  const usuario = await buscarUsuarioPorId(Number(payload.sub));
  if (!usuario || !usuario.activo || usuario.estado_cuenta !== 'habilitada') return next(errores.noAutenticado('Tu cuenta no está activa'));

  req.usuario = usuario;
  next();
}

/** Para todo lo que no sea /auth: hasta confirmar el email no se accede a los módulos. */
export function requiereEmailVerificado(req, res, next) {
  if (!req.usuario.email_verificado_at) {
    return next(new AppError(403, 'EMAIL_NO_VERIFICADO', 'Confirmá tu email con el código que te enviamos para continuar'));
  }
  next();
}

/** autenticar + email verificado: la cadena estándar de los endpoints de negocio. */
export const autenticado = [autenticar, requiereEmailVerificado];
