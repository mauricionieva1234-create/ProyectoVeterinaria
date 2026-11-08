import { tienePermiso } from '../config/permisos.js';
import { errorNoAutenticado, errorSinPermiso } from '../utils/errores.js';

// Se usa siempre después de requiereAutenticacion.
export function requierePermiso(accion) {
  return (req, res, next) => {
    if (!req.usuario) {
      throw errorNoAutenticado();
    }

    if (!tienePermiso(req.usuario.rol, accion)) {
      throw errorSinPermiso();
    }

    next();
  };
}
