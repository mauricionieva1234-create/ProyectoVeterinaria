import * as servicio from './servicio.js';

export async function obtener(req, res) {
  const historia = await servicio.obtenerHistoriaClinica(req.params.id);
  res.json({ historia });
}

export async function exportar(req, res) {
  const historia = await servicio.exportarHistoriaClinica(req.params.id, req.body, req.usuario);
  res.json({ historia });
}
