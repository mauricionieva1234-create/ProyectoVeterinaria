import { pedir } from './cliente.js';

// Convierte un objeto de filtros en query string, omitiendo valores vacíos.
export function aConsulta(filtros) {
  const parametros = new URLSearchParams();

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      parametros.set(clave, String(valor));
    }
  }

  const cadena = parametros.toString();
  return cadena ? `?${cadena}` : '';
}

export function listarUsuarios(filtros = {}) {
  return pedir(`/usuarios${aConsulta(filtros)}`);
}

export function obtenerUsuario(id) {
  return pedir(`/usuarios/${id}`);
}

export function crearUsuario(datos) {
  return pedir('/usuarios', { metodo: 'POST', cuerpo: datos });
}

export function actualizarUsuario(id, datos) {
  return pedir(`/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos });
}

export function cambiarEstadoUsuario(id, activo) {
  return pedir(`/usuarios/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } });
}
