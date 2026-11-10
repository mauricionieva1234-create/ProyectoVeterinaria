import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarVisitas(req.consulta);
  res.json(resultado);
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const visita = await servicio.obtenerVisita(id, req.usuario);
  res.json({ visita });
}

export async function crear(req, res) {
  const visita = await servicio.crearVisita(req.body, req.usuario);
  res.status(201).json({ visita });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const visita = await servicio.actualizarVisita(id, req.body, req.usuario);
  res.json({ visita });
}

export async function cerrar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const visita = await servicio.cerrarVisita(id, req.body, req.usuario);
  res.json({ visita });
}

export async function agregarNota(req, res) {
  const id = esquemaId.parse(req.params.id);
  const nota = await servicio.agregarNota(id, req.body, req.usuario);
  res.status(201).json({ nota });
}

export async function anular(req, res) {
  const id = esquemaId.parse(req.params.id);
  const visita = await servicio.anularVisita(id, req.body, req.usuario);
  res.json({ visita });
}

export async function crearMedicacion(req, res) {
  const id = esquemaId.parse(req.params.id);
  const medicacion = await servicio.crearMedicacion(id, req.body, req.usuario);
  res.status(201).json({ medicacion });
}

export async function actualizarMedicacion(req, res) {
  const id = esquemaId.parse(req.params.id);
  const medicacionId = esquemaId.parse(req.params.medicacionId);
  const medicacion = await servicio.actualizarMedicacion(id, medicacionId, req.body, req.usuario);
  res.json({ medicacion });
}

export async function anularMedicacion(req, res) {
  const id = esquemaId.parse(req.params.id);
  const medicacionId = esquemaId.parse(req.params.medicacionId);
  const medicacion = await servicio.anularMedicacion(id, medicacionId, req.body, req.usuario);
  res.json({ medicacion });
}
