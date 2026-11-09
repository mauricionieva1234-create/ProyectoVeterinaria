import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarPacientes(filtros = {}) {
  return pedir(`/pacientes${aConsulta(filtros)}`);
}

export function obtenerPaciente(id) {
  return pedir(`/pacientes/${id}`);
}

export function crearPaciente(datos) {
  return pedir('/pacientes', { metodo: 'POST', cuerpo: datos });
}

export function actualizarPaciente(id, datos) {
  return pedir(`/pacientes/${id}`, { metodo: 'PUT', cuerpo: datos });
}
