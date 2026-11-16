import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './controlador.js';
import { esquemaExportarHistoria } from './esquemas.js';

// Se monta sobre /pacientes para conservar la jerarquía del recurso. La lectura
// completa y la exportación usan permisos propios, distintos de la edición
// clínica, para que recepción pueda consultar sin poder modificar nada.
export const rutasHistoria = Router();

rutasHistoria.use(requiereAutenticacion);

rutasHistoria.get('/:id/historia-clinica', requierePermiso('historia.ver'), controlador.obtener);

rutasHistoria.post(
  '/:id/historia-clinica/exportar',
  requierePermiso('historia.exportar'),
  validar(esquemaExportarHistoria),
  controlador.exportar,
);
