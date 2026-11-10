import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarControles(req.consulta, req.usuario);
  res.json(resultado);
}

export async function recordar(req, res) {
  const resultado = await servicio.obtenerRecordatorios(req.usuario);
  res.json(resultado);
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const control = await servicio.obtenerControl(id);
  res.json({ control });
}

export async function crear(req, res) {
  const control = await servicio.crearControl(req.body, req.usuario);
  res.status(201).json({ control });
}

export async function reprogramar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const resultado = await servicio.reprogramarControl(id, req.body, req.usuario);
  res.json(resultado);
}

export async function cambiarEstado(req, res) {
  const id = esquemaId.parse(req.params.id);
  const control = await servicio.cambiarEstado(id, req.body, req.usuario);
  res.json({ control });
}

export async function anular(req, res) {
  const id = esquemaId.parse(req.params.id);
  const control = await servicio.anularControl(id, req.body, req.usuario);
  res.json({ control });
}

export async function listarAvisos(req, res) {
  const id = esquemaId.parse(req.params.id);
  const avisos = await servicio.listarAvisos(id);
  res.json({ avisos });
}

export async function crearAviso(req, res) {
  const id = esquemaId.parse(req.params.id);
  const aviso = await servicio.crearAviso(id, req.body, req.usuario);
  res.status(201).json({ aviso });
}
