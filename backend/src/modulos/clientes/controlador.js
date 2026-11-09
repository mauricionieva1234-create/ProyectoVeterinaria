import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarClientes(req.consulta);
  res.json(resultado);
}

export async function buscar(req, res) {
  const resultado = await servicio.buscarClientesPrevios(req.consulta);
  res.json(resultado);
}

export async function fichasIncompletas(req, res) {
  const resultado = await servicio.listarFichasIncompletas(req.consulta);
  res.json(resultado);
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const cliente = await servicio.obtenerCliente(id, req.usuario);
  res.json({ cliente });
}

export async function crear(req, res) {
  const cliente = await servicio.crearCliente(req.body, req.usuario);
  res.status(201).json({ cliente });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const cliente = await servicio.actualizarCliente(id, req.body, req.usuario);
  res.json({ cliente });
}

export async function unir(req, res) {
  const id = esquemaId.parse(req.params.id);
  const resultado = await servicio.unirClientes(id, req.body, req.usuario);
  res.json(resultado);
}
