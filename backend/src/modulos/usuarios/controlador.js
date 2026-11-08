import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarUsuarios(req.consulta);
  res.json(resultado);
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const usuario = await servicio.obtenerUsuario(id);
  res.json({ usuario });
}

export async function crear(req, res) {
  const usuario = await servicio.crearUsuario(req.body, req.usuario);
  res.status(201).json({ usuario });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const usuario = await servicio.actualizarUsuario(id, req.body, req.usuario);
  res.json({ usuario });
}

export async function cambiarEstado(req, res) {
  const id = esquemaId.parse(req.params.id);
  const usuario = await servicio.cambiarEstadoUsuario(id, req.body.activo, req.usuario);
  res.json({ usuario });
}
