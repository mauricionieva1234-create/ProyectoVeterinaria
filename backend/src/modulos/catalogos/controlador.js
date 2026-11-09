import * as servicio from './servicio.js';

export async function listarEspecies(req, res) {
  const resultado = await servicio.listarEspecies(req.consulta);
  res.json(resultado);
}

export async function listarRazas(req, res) {
  const resultado = await servicio.listarRazas(req.consulta);
  res.json(resultado);
}

export async function crearEspecie(req, res) {
  const especie = await servicio.crearEspecie(req.body, req.usuario);
  res.status(201).json({ especie });
}

export async function crearRaza(req, res) {
  const raza = await servicio.crearRaza(req.body, req.usuario);
  res.status(201).json({ raza });
}
