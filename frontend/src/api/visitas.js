import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarVisitas(filtros = {}) {
  return pedir(`/visitas${aConsulta(filtros)}`);
}

export function obtenerVisita(id) {
  return pedir(`/visitas/${id}`);
}

export function crearVisita(datos) {
  return pedir('/visitas', { metodo: 'POST', cuerpo: datos });
}

export function actualizarVisita(id, datos) {
  return pedir(`/visitas/${id}`, { metodo: 'PATCH', cuerpo: datos });
}

export function cerrarVisita(id, datos) {
  return pedir(`/visitas/${id}/cerrar`, { metodo: 'POST', cuerpo: datos });
}

export function agregarNotaVisita(id, datos) {
  return pedir(`/visitas/${id}/notas`, { metodo: 'POST', cuerpo: datos });
}

export function anularVisita(id, datos) {
  return pedir(`/visitas/${id}/anular`, { metodo: 'POST', cuerpo: datos });
}

export function crearMedicacion(id, datos) {
  return pedir(`/visitas/${id}/medicacion`, { metodo: 'POST', cuerpo: datos });
}

export function actualizarMedicacion(id, medicacionId, datos) {
  return pedir(`/visitas/${id}/medicacion/${medicacionId}`, {
    metodo: 'PATCH',
    cuerpo: datos,
  });
}

export function anularMedicacion(id, medicacionId, datos) {
  return pedir(`/visitas/${id}/medicacion/${medicacionId}/anular`, {
    metodo: 'POST',
    cuerpo: datos,
  });
}
