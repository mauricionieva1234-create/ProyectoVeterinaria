import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarAuditoria(filtros = {}) {
  return pedir(`/auditoria${aConsulta(filtros)}`);
}
