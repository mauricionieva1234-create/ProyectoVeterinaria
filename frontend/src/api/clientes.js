import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

export function listarClientes(filtros = {}) {
  return pedir(`/clientes${aConsulta(filtros)}`);
}

export function buscarClientes(filtros = {}) {
  return pedir(`/clientes/buscar${aConsulta(filtros)}`);
}

export function listarFichasIncompletas(filtros = {}) {
  return pedir(`/clientes/fichas-incompletas${aConsulta(filtros)}`);
}

export function obtenerCliente(id) {
  return pedir(`/clientes/${id}`);
}

export function crearCliente(datos) {
  return pedir('/clientes', { metodo: 'POST', cuerpo: datos });
}

export function actualizarCliente(id, datos) {
  return pedir(`/clientes/${id}`, { metodo: 'PUT', cuerpo: datos });
}

export function unirClientes(id, clienteConservadoId) {
  return pedir(`/clientes/${id}/unir`, {
    metodo: 'POST',
    cuerpo: { clienteConservadoId },
  });
}
