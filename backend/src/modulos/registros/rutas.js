import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar } from '../../middlewares/validar.js';
import {
  ESQUEMAS_ACTUALIZAR,
  ESQUEMAS_CREAR,
  esquemaAnular,
  esquemaTipoRegistro,
} from './esquemas.js';
import * as controlador from './controlador.js';

// El tipo viene en la URL y decide qué esquema valida el cuerpo. El middleware
// deja el tipo normalizado en req.tipoRegistro para el controlador.
function validarTipo(req, res, next) {
  req.tipoRegistro = esquemaTipoRegistro.parse(req.params.tipo);
  next();
}

function validarCuerpo(esquemas) {
  return (req, res, next) => {
    req.body = esquemas[req.tipoRegistro].parse(req.body);
    next();
  };
}

export const rutasRegistros = Router();

rutasRegistros.use(requiereAutenticacion);

rutasRegistros.post(
  '/:tipo',
  requierePermiso('registros.crear'),
  validarTipo,
  validarCuerpo(ESQUEMAS_CREAR),
  controlador.crear,
);

rutasRegistros.patch(
  '/:tipo/:id',
  requierePermiso('registros.editar'),
  validarTipo,
  validarCuerpo(ESQUEMAS_ACTUALIZAR),
  controlador.actualizar,
);

rutasRegistros.post(
  '/:tipo/:id/anular',
  requierePermiso('registros.anular'),
  validarTipo,
  validar(esquemaAnular),
  controlador.anular,
);
