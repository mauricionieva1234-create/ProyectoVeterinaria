import * as servicio from './servicio.js';

export async function consultar(req, res) {
  const respuesta = await servicio.consultar(req.body.mensaje, req.usuario);
  res.json({ respuesta });
}
