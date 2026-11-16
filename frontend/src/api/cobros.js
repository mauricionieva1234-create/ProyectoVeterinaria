import { pedir } from './cliente.js';
import { aConsulta } from './usuarios.js';

// Cobros de visitas y movimientos de caja. Los importes viajan como números;
// el backend los guarda con numeric y devuelve el saldo ya calculado.

export function listarCobros(filtros = {}) {
  return pedir(`/cobros${aConsulta(filtros)}`);
}

export function listarPendientes() {
  return pedir('/cobros/pendientes');
}

export function listarDeudas(filtros = {}) {
  return pedir(`/cobros/deudas${aConsulta(filtros)}`);
}

export function obtenerCaja(fecha) {
  return pedir(`/cobros/caja${aConsulta({ fecha })}`);
}

export function obtenerCobro(id) {
  return pedir(`/cobros/${id}`);
}

export function crearCobro(datos) {
  return pedir('/cobros', { metodo: 'POST', cuerpo: datos });
}

export function actualizarCobro(id, datos) {
  return pedir(`/cobros/${id}`, { metodo: 'PATCH', cuerpo: datos });
}

export function anularCobro(id, datos) {
  return pedir(`/cobros/${id}/anular`, { metodo: 'POST', cuerpo: datos });
}

export function registrarPago(id, datos) {
  return pedir(`/cobros/${id}/pagos`, { metodo: 'POST', cuerpo: datos });
}

export function anularPago(id, pagoId, datos) {
  return pedir(`/cobros/${id}/pagos/${pagoId}/anular`, { metodo: 'POST', cuerpo: datos });
}
