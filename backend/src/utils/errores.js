// Error controlado de la aplicación. El middleware de errores lo traduce
// al formato uniforme { error: { codigo, mensaje, detalles } }.
export class ErrorHttp extends Error {
  constructor(estado, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export function errorNoEncontrado(mensaje = 'No se encontró el recurso solicitado') {
  return new ErrorHttp(404, 'NO_ENCONTRADO', mensaje);
}

export function errorDatosInvalidos(detalles = []) {
  return new ErrorHttp(400, 'DATOS_INVALIDOS', 'Los datos enviados no son válidos', detalles);
}

export function errorNoAutenticado() {
  return new ErrorHttp(401, 'NO_AUTENTICADO', 'Tenés que iniciar sesión');
}

export function errorSinPermiso() {
  return new ErrorHttp(403, 'SIN_PERMISO', 'No tenés permiso para realizar esta acción');
}

export function errorCredencialesInvalidas() {
  return new ErrorHttp(401, 'CREDENCIALES_INVALIDAS', 'El email o la contraseña no son correctos');
}

export function errorUsuarioInactivo() {
  return new ErrorHttp(403, 'USUARIO_INACTIVO', 'Tu usuario está desactivado');
}

export function errorConflicto(mensaje) {
  return new ErrorHttp(409, 'CONFLICTO', mensaje);
}
