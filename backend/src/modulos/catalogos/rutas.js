import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaCrearEspecie,
  esquemaCrearRaza,
  esquemaListadoEspecies,
  esquemaListadoRazas,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasCatalogos = Router();

rutasCatalogos.use(requiereAutenticacion);

rutasCatalogos.get(
  '/especies',
  requierePermiso('catalogos.ver'),
  validarConsulta(esquemaListadoEspecies),
  controlador.listarEspecies,
);

rutasCatalogos.get(
  '/razas',
  requierePermiso('catalogos.ver'),
  validarConsulta(esquemaListadoRazas),
  controlador.listarRazas,
);

// Solo el administrador crea especies y razas.
rutasCatalogos.post(
  '/especies',
  requierePermiso('catalogos.crear'),
  validar(esquemaCrearEspecie),
  controlador.crearEspecie,
);

rutasCatalogos.post(
  '/razas',
  requierePermiso('catalogos.crear'),
  validar(esquemaCrearRaza),
  controlador.crearRaza,
);
