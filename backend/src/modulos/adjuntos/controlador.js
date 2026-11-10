import { z } from 'zod';
import { eliminarArchivo } from '../../utils/archivos.js';
import { errorDatosInvalidos } from '../../utils/errores.js';
import * as servicio from './servicio.js';

const esquemaId = z.coerce.number().int().positive();

function exigirArchivo(req) {
  if (!req.file) {
    throw errorDatosInvalidos([
      { campo: 'archivo', mensaje: 'Adjuntá un archivo en el campo "archivo"' },
    ]);
  }

  return req.file;
}

// Si la validación posterior falla, el archivo ya está en disco: hay que
// borrarlo para no dejar basura.
async function conLimpieza(archivo, funcion) {
  try {
    return await funcion();
  } catch (error) {
    await eliminarArchivo(archivo.filename);
    throw error;
  }
}

export async function listar(req, res) {
  const adjuntos = await servicio.listarAdjuntos(req.consulta);
  res.json({ adjuntos });
}

export async function subir(req, res) {
  const archivo = exigirArchivo(req);

  const adjunto = await conLimpieza(archivo, () =>
    servicio.subirAdjunto({ ...req.body, archivo }, req.usuario),
  );

  res.status(201).json({ adjunto });
}

export async function descargar(req, res) {
  const id = esquemaId.parse(req.params.id);
  const archivo = await servicio.obtenerParaDescarga(id);

  // "inline" permite verlo en el navegador; el nombre va también codificado
  // para conservar tildes y espacios.
  const nombreAscii = archivo.nombreOriginal.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  res.setHeader(
    'Content-Disposition',
    `inline; filename="${nombreAscii}"; filename*=UTF-8''${encodeURIComponent(archivo.nombreOriginal)}`,
  );
  res.type(archivo.tipoMime);
  res.sendFile(archivo.ruta);
}

export async function anular(req, res) {
  const id = esquemaId.parse(req.params.id);
  const adjunto = await servicio.anularAdjunto(id, req.body, req.usuario);
  res.json({ adjunto });
}

export async function subirFoto(req, res) {
  const pacienteId = esquemaId.parse(req.params.id);
  const archivo = exigirArchivo(req);

  const resultado = await conLimpieza(archivo, () =>
    servicio.asignarFoto(pacienteId, archivo, req.usuario),
  );

  res.status(201).json(resultado);
}

export async function quitarFoto(req, res) {
  const pacienteId = esquemaId.parse(req.params.id);
  const paciente = await servicio.quitarFoto(pacienteId, req.usuario);
  res.json({ paciente });
}
