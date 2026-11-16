import { z } from 'zod';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

export async function listar(req, res) {
  const resultado = await servicio.listarCobros(req.consulta);
  res.json(resultado);
}

export async function pendientes(req, res) {
  const pendientes = await servicio.listarPendientes();
  res.json({ pendientes });
}

export async function deudas(req, res) {
  const resultado = await servicio.listarDeudas(req.consulta);
  res.json(resultado);
}

export async function caja(req, res) {
  const resumen = await servicio.obtenerCaja(req.consulta.fecha);
  res.json({ caja: resumen });
}

export async function obtener(req, res) {
  const id = esquemaId.parse(req.params.id);
  const cobro = await servicio.obtenerCobro(id);
  res.json({ cobro });
}

export async function crear(req, res) {
  const cobro = await servicio.crearCobro(req.body, req.usuario);
  res.status(201).json({ cobro });
}

export async function actualizar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const cobro = await servicio.actualizarCobro(id, req.body, req.usuario);
  res.json({ cobro });
}

export async function anular(req, res) {
  const id = esquemaId.parse(req.params.id);
  const cobro = await servicio.anularCobro(id, req.body, req.usuario);
  res.json({ cobro });
}

export async function registrarPago(req, res) {
  const id = esquemaId.parse(req.params.id);
  const resultado = await servicio.registrarPago(id, req.body, req.usuario);
  res.status(201).json(resultado);
}

export async function anularPago(req, res) {
  const id = esquemaId.parse(req.params.id);
  const pagoId = esquemaId.parse(req.params.pagoId);
  const resultado = await servicio.anularPago(id, pagoId, req.body, req.usuario);
  res.json(resultado);
}
