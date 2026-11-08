import * as servicio from './servicio.js';

export async function listar(req, res) {
  const resultado = await servicio.listarAuditoria(req.consulta);
  res.json(resultado);
}
