import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarCola(req.usuario);
  res.json(resultado);
}

export async function crear(req, res) {
  const ingreso = await servicio.crearIngreso(req.body, req.usuario);
  res.status(201).json({ ingreso });
}

export async function urgenciaPosible(req, res) {
  const id = esquemaId.parse(req.params.id);
  const ingreso = await servicio.marcarUrgenciaPosible(id, req.usuario);
  res.json({ ingreso });
}

export async function decidirUrgencia(req, res) {
  const id = esquemaId.parse(req.params.id);
  const ingreso = await servicio.decidirUrgencia(id, req.body, req.usuario);
  res.json({ ingreso });
}

export async function consultorio(req, res) {
  const id = esquemaId.parse(req.params.id);
  const ingreso = await servicio.marcarEnConsulta(id, req.usuario);
  res.json({ ingreso });
}

export async function cambiarEstado(req, res) {
  const id = esquemaId.parse(req.params.id);
  const ingreso = await servicio.cambiarEstado(id, req.body, req.usuario);
  res.json({ ingreso });
}

export async function sinCerrar(req, res) {
  const resultado = await servicio.listarSinCerrar(req.consulta, req.usuario);
  res.json(resultado);
}

export async function altaRapida(req, res) {
  const resultado = await servicio.altaRapida(req.body, req.usuario);
  res.status(201).json(resultado);
}
