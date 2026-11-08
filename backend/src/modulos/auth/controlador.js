import { NOMBRE_COOKIE, opcionesCookie } from '../../utils/jwt.js';
import * as servicio from './servicio.js';

export async function login(req, res) {
  const { token, usuario, permisos } = await servicio.iniciarSesion(req.body);

  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
  res.json({ usuario, permisos });
}

export function logout(req, res) {
  // Para borrar la cookie deben coincidir path, sameSite y secure.
  const opciones = opcionesCookie();
  delete opciones.maxAge;
  res.clearCookie(NOMBRE_COOKIE, opciones);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json(servicio.datosDeSesion(req.usuario));
}
