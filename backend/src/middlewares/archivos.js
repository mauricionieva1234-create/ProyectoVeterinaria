import crypto from 'node:crypto';
import multer from 'multer';
import { TIPOS_PERMITIDOS, asegurarDirectorio, directorioAdjuntos } from '../utils/archivos.js';
import { errorDatosInvalidos } from '../utils/errores.js';

const LIMITE_BYTES = 10 * 1024 * 1024;

const almacenamiento = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await asegurarDirectorio();
      cb(null, directorioAdjuntos());
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${TIPOS_PERMITIDOS[file.mimetype]}`);
  },
});

const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: LIMITE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      return cb(
        errorDatosInvalidos([
          { campo: 'archivo', mensaje: 'Solo se aceptan archivos PDF, JPG, PNG o WebP' },
        ]),
      );
    }

    cb(null, true);
  },
});

// Traduce los errores de multer al formato uniforme de la API. El archivo va
// en el campo "archivo" y se acepta uno por petición.
export function recibirArchivo(req, res, next) {
  subida.single('archivo')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      let mensaje = 'No se pudo procesar el archivo';

      if (error.code === 'LIMIT_FILE_SIZE') {
        mensaje = 'El archivo supera el límite de 10 MB';
      } else if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(error.code)) {
        mensaje = 'Se esperaba un solo archivo en el campo "archivo"';
      }

      return next(errorDatosInvalidos([{ campo: 'archivo', mensaje }]));
    }

    return next(error);
  });
}

export { LIMITE_BYTES };
