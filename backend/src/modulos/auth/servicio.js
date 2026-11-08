import { permisosDeRol } from '../../config/permisos.js';
import { errorCredencialesInvalidas, errorUsuarioInactivo } from '../../utils/errores.js';
import { firmarSesion } from '../../utils/jwt.js';
import { verificarPassword } from '../../utils/password.js';
import { buscarUsuarioPorEmail } from '../usuarios/repositorio.js';
import { aUsuarioPublico } from '../usuarios/servicio.js';

export async function iniciarSesion({ email, password }) {
  const fila = await buscarUsuarioPorEmail(email);

  if (!fila) {
    throw errorCredencialesInvalidas();
  }

  // Primero se valida la contraseña y después el estado: así no se revela si
  // un email existe cuando quien intenta entrar no conoce la clave.
  const passwordValida = await verificarPassword(password, fila.password_hash);

  if (!passwordValida) {
    throw errorCredencialesInvalidas();
  }

  if (!fila.activo) {
    throw errorUsuarioInactivo();
  }

  const usuario = aUsuarioPublico(fila);

  return {
    token: firmarSesion(usuario),
    usuario,
    permisos: permisosDeRol(usuario.rol),
  };
}

export function datosDeSesion(usuario) {
  return {
    usuario,
    permisos: permisosDeRol(usuario.rol),
  };
}
