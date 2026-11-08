import { ZodError } from 'zod';
import { ErrorHttp } from '../utils/errores.js';
import { logger } from '../config/logger.js';

function detallesDeZod(error) {
  return error.issues.map((problema) => ({
    campo: problema.path.join('.') || null,
    mensaje: problema.message,
  }));
}

// Express 5 deriva automáticamente los errores de funciones async a este
// middleware, así que no hace falta un wrapper try/catch en cada ruta.
export function manejarErrores(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ErrorHttp) {
    return res.status(error.estado).json({
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        detalles: error.detalles,
      },
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Los datos enviados no son válidos',
        detalles: detallesDeZod(error),
      },
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        codigo: 'JSON_INVALIDO',
        mensaje: 'El cuerpo de la petición no es un JSON válido',
        detalles: [],
      },
    });
  }

  logger.error({ err: error }, 'Error no controlado');

  return res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado',
      detalles: [],
    },
  });
}
