import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarRegistros(pacienteId, filtros = {}) {
  return pedir(`/pacientes/${pacienteId}/registros${aConsulta(filtros)}`);
}

export function crearRegistro(tipo, datos) {
  return pedir(`/registros/${tipo}`, { metodo: 'POST', cuerpo: datos });
}

export function actualizarRegistro(tipo, id, datos) {
  return pedir(`/registros/${tipo}/${id}`, { metodo: 'PATCH', cuerpo: datos });
}

export function anularRegistro(tipo, id, datos) {
  return pedir(`/registros/${tipo}/${id}/anular`, { metodo: 'POST', cuerpo: datos });
}
