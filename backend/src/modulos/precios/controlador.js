import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarPrecios(req.consulta);
  res.json(resultado);
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const precio = await servicio.obtenerPrecio(id);
  res.json({ precio });
}

export async function crear(req, res) {
  const precio = await servicio.crearPrecio(req.body, req.usuario);
  res.status(201).json({ precio });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const precio = await servicio.actualizarPrecio(id, req.body, req.usuario);
  res.json({ precio });
}
