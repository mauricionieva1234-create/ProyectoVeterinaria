import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import { recibirArchivo } from '../../middlewares/archivos.js';
import { esquemaAnular, esquemaListadoAdjuntos, esquemaSubirAdjunto } from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasAdjuntos = Router();

rutasAdjuntos.use(requiereAutenticacion);

rutasAdjuntos.get(
  '/',
  requierePermiso('adjuntos.ver'),
  validarConsulta(esquemaListadoAdjuntos),
  controlador.listar,
);

rutasAdjuntos.post(
  '/',
  requierePermiso('adjuntos.crear'),
  recibirArchivo,
  validar(esquemaSubirAdjunto),
  controlador.subir,
);

rutasAdjuntos.get('/:id/descargar', requierePermiso('adjuntos.ver'), controlador.descargar);

rutasAdjuntos.post(
  '/:id/anular',
  requierePermiso('adjuntos.anular'),
  validar(esquemaAnular),
  controlador.anular,
);
