import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

// Lista de precios de servicios. La consulta sin filtros devuelve solo los
// activos; la pantalla de administración pide también los inactivos.

export function listarPrecios(filtros = {}) {
  return pedir(`/precios${aConsulta(filtros)}`);
}

export function obtenerPrecio(id) {
  return pedir(`/precios/${id}`);
}

export function crearPrecio(datos) {
  return pedir('/precios', { metodo: 'POST', cuerpo: datos });
}

export function actualizarPrecio(id, datos) {
  return pedir(`/precios/${id}`, { metodo: 'PATCH', cuerpo: datos });
}
