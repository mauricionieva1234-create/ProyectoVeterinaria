import * as servicio from './servicio.js';

export async function listar(req, res) {
  const resultado = await servicio.listarPacientes(req.consulta);
  res.json(resultado);
}

export async function obtener(req, res) {
  const paciente = await servicio.obtenerPaciente(req.params.id);
  res.json({ paciente });
}

export async function crear(req, res) {
  const paciente = await servicio.crearPaciente(req.body, req.usuario);
  res.status(201).json({ paciente });
}

export async function actualizar(req, res) {
  const paciente = await servicio.actualizarPaciente(req.params.id, req.body, req.usuario);
  res.json({ paciente });
}
