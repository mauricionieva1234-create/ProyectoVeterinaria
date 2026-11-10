import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarCola() {
  return pedir('/cola');
}

export function crearIngreso(datos) {
  return pedir('/cola', { metodo: 'POST', cuerpo: datos });
}

export function marcarUrgenciaPosible(id) {
  return pedir(`/cola/${id}/urgencia-posible`, { metodo: 'PATCH' });
}

export function decidirUrgencia(id, decision) {
  return pedir(`/cola/${id}/urgencia`, { metodo: 'PATCH', cuerpo: { decision } });
}

export function pasarAlConsultorio(id) {
  return pedir(`/cola/${id}/consultorio`, { metodo: 'PATCH' });
}

export function cambiarEstadoIngreso(id, estado) {
  return pedir(`/cola/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
}

export function listarIngresosSinCerrar(filtros = {}) {
  return pedir(`/cola/sin-cerrar${aConsulta(filtros)}`);
}

export function crearAltaRapida(datos) {
  return pedir('/cola/alta-rapida', { metodo: 'POST', cuerpo: datos });
}
