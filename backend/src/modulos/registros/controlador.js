import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listarPorPaciente(req, res) {
  const pacienteId = esquemaId.parse(req.params.pacienteId);
  const resultado = await servicio.listarPorPaciente(pacienteId, req.consulta.tipo);
  res.json(resultado);
}

export async function crear(req, res) {
  const registro = await servicio.crearRegistro(req.tipoRegistro, req.body, req.usuario);
  res.status(201).json({ registro });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const registro = await servicio.actualizarRegistro(req.tipoRegistro, id, req.body, req.usuario);
  res.json({ registro });
}

export async function anular(req, res) {
  const id = esquemaId.parse(req.params.id);
  const registro = await servicio.anularRegistro(req.tipoRegistro, id, req.body, req.usuario);
  res.json({ registro });
}
