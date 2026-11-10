import { enviarFormulario, pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarAdjuntos(filtros = {}) {
  return pedir(`/adjuntos${aConsulta(filtros)}`);
}

// El archivo viaja en el campo "archivo" y los vínculos como texto, porque
// FormData no admite números.
export function subirAdjunto({ archivo, pacienteId, visitaId, estudioId }) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);

  if (pacienteId) formulario.append('pacienteId', String(pacienteId));
  if (visitaId) formulario.append('visitaId', String(visitaId));
  if (estudioId) formulario.append('estudioId', String(estudioId));

  return enviarFormulario('/adjuntos', formulario);
}

export function anularAdjunto(id, datos) {
  return pedir(`/adjuntos/${id}/anular`, { metodo: 'POST', cuerpo: datos });
}

export function subirFotoPaciente(pacienteId, archivo) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);

  return enviarFormulario(`/pacientes/${pacienteId}/foto`, formulario);
}

export function quitarFotoPaciente(pacienteId) {
  return pedir(`/pacientes/${pacienteId}/foto/quitar`, { metodo: 'POST', cuerpo: {} });
}

export function urlDescargaAdjunto(id) {
  return `/api/adjuntos/${id}/descargar`;
}
