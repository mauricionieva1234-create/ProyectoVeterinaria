import { NOMBRE_COOKIE, verificarSesion } from '../utils/jwt.js';
import { errorNoAutenticado } from '../utils/errores.js';
import { buscarUsuarioPorId } from '../modulos/usuarios/repositorio.js';

// Valida el JWT de la cookie y vuelve a cargar el usuario desde la base.
// Así, si un admin lo desactiva, la sesión deja de servir de inmediato.
export async function requiereAutenticacion(req, res, next) {
  const token = req.cookies?.[NOMBRE_COOKIE];

  if (!token) {
    throw errorNoAutenticado();
  }

  let datos;

  try {
    datos = verificarSesion(token);
  } catch {
    throw errorNoAutenticado();
  }

  const usuario = await buscarUsuarioPorId(datos.sub);

  if (!usuario || !usuario.activo) {
    throw errorNoAutenticado();
  }

  req.usuario = usuario;
  next();
}
