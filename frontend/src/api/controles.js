import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarControles(filtros = {}) {
  return pedir(`/controles${aConsulta(filtros)}`);
}

export function listarRecordatorios() {
  return pedir('/controles/recordar');
}

export function obtenerControl(id) {
  return pedir(`/controles/${id}`);
}

export function crearControl(datos) {
  return pedir('/controles', { metodo: 'POST', cuerpo: datos });
}

export function reprogramarControl(id, datos) {
  return pedir(`/controles/${id}/reprogramar`, { metodo: 'POST', cuerpo: datos });
}

export function cambiarEstadoControl(id, datos) {
  return pedir(`/controles/${id}/estado`, { metodo: 'PATCH', cuerpo: datos });
}

export function anularControl(id, datos) {
  return pedir(`/controles/${id}/anular`, { metodo: 'POST', cuerpo: datos });
}

export function listarAvisos(controlId) {
  return pedir(`/controles/${controlId}/avisos`);
}

export function crearAviso(controlId, datos) {
  return pedir(`/controles/${controlId}/avisos`, { metodo: 'POST', cuerpo: datos });
}
