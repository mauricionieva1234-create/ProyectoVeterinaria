import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './controlador.js';
import { esquemaConsultaAsistente } from './esquemas.js';

// El asistente es una consulta de solo lectura. No tiene endpoints para crear,
// editar ni anular: toda la información sale de los módulos ya existentes.
export const rutasAsistente = Router();

rutasAsistente.use(requiereAutenticacion);

rutasAsistente.post(
  '/consulta',
  requierePermiso('asistente.usar'),
  validar(esquemaConsultaAsistente),
  controlador.consultar,
);
