import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaAnular,
  esquemaCrearAviso,
  esquemaCrearControl,
  esquemaEstadoControl,
  esquemaListadoControles,
  esquemaReprogramarControl,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasControles = Router();

rutasControles.use(requiereAutenticacion);

rutasControles.get(
  '/',
  requierePermiso('controles.ver'),
  validarConsulta(esquemaListadoControles),
  controlador.listar,
);

// Va antes de /:id para que "recordar" no se interprete como un identificador.
rutasControles.get('/recordar', requierePermiso('controles.ver'), controlador.recordar);

rutasControles.get('/:id', requierePermiso('controles.ver'), controlador.obtener);

rutasControles.post(
  '/',
  requierePermiso('controles.crear'),
  validar(esquemaCrearControl),
  controlador.crear,
);

rutasControles.post(
  '/:id/reprogramar',
  requierePermiso('controles.editar'),
  validar(esquemaReprogramarControl),
  controlador.reprogramar,
);

rutasControles.patch(
  '/:id/estado',
  requierePermiso('controles.editar'),
  validar(esquemaEstadoControl),
  controlador.cambiarEstado,
);

rutasControles.post(
  '/:id/anular',
  requierePermiso('controles.editar'),
  validar(esquemaAnular),
  controlador.anular,
);

rutasControles.get('/:id/avisos', requierePermiso('avisos.ver'), controlador.listarAvisos);

rutasControles.post(
  '/:id/avisos',
  requierePermiso('avisos.crear'),
  validar(esquemaCrearAviso),
  controlador.crearAviso,
);
