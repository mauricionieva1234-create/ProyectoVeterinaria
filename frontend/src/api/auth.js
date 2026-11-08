import { pedir } from './cliente.js';

export function iniciarSesion(datos) {
  return pedir('/auth/login', { metodo: 'POST', cuerpo: datos });
}

export function cerrarSesion() {
  return pedir('/auth/logout', { metodo: 'POST' });
}

export function obtenerSesion() {
  return pedir('/auth/me');
}
