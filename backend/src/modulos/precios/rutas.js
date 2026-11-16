import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import { esquemaActualizarPrecio, esquemaCrearPrecio, esquemaListadoPrecios } from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasPrecios = Router();

rutasPrecios.use(requiereAutenticacion);

rutasPrecios.get(
  '/',
  requierePermiso('precios.ver'),
  validarConsulta(esquemaListadoPrecios),
  controlador.listar,
);

rutasPrecios.post(
  '/',
  requierePermiso('precios.crear'),
  validar(esquemaCrearPrecio),
  controlador.crear,
);

rutasPrecios.get('/:id', requierePermiso('precios.ver'), controlador.obtener);

rutasPrecios.patch(
  '/:id',
  requierePermiso('precios.editar'),
  validar(esquemaActualizarPrecio),
  controlador.actualizar,
);
