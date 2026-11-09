import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarEspecies(filtros = {}) {
  return pedir(`/catalogos/especies${aConsulta(filtros)}`);
}

export function listarRazas(filtros = {}) {
  return pedir(`/catalogos/razas${aConsulta(filtros)}`);
}

export function crearEspecie(datos) {
  return pedir('/catalogos/especies', { metodo: 'POST', cuerpo: datos });
}

export function crearRaza(datos) {
  return pedir('/catalogos/razas', { metodo: 'POST', cuerpo: datos });
}
