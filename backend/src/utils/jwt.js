import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const NOMBRE_COOKIE = 'sesion_veterinaria';
export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;

export function firmarSesion(usuario) {
  return jwt.sign({ sub: String(usuario.id), rol: usuario.rol }, env.JWT_SECRET, {
    expiresIn: DURACION_SESION_SEGUNDOS,
  });
}

export function verificarSesion(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: DURACION_SESION_SEGUNDOS * 1000,
    path: '/',
  };
}
