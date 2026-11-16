import { pedir } from './cliente.js';

export function obtenerHistoriaClinica(pacienteId) {
  return pedir(`/pacientes/${pacienteId}/historia-clinica`);
}

export function exportarHistoriaClinica(pacienteId, datos) {
  return pedir(`/pacientes/${pacienteId}/historia-clinica/exportar`, {
    metodo: 'POST',
    cuerpo: datos,
  });
}
