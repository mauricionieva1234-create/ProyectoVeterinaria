import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaActualizarMedicacion,
  esquemaActualizarVisita,
  esquemaAnular,
  esquemaCerrarVisita,
  esquemaCrearMedicacion,
  esquemaCrearVisita,
  esquemaListadoVisitas,
  esquemaNotaVisita,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasVisitas = Router();

rutasVisitas.use(requiereAutenticacion);

rutasVisitas.get(
  '/',
  requierePermiso('visitas.ver'),
  validarConsulta(esquemaListadoVisitas),
  controlador.listar,
);

rutasVisitas.get('/:id', requierePermiso('visitas.ver'), controlador.obtener);

rutasVisitas.post(
  '/',
  requierePermiso('visitas.crear'),
  validar(esquemaCrearVisita),
  controlador.crear,
);

rutasVisitas.patch(
  '/:id',
  requierePermiso('visitas.editar'),
  validar(esquemaActualizarVisita),
  controlador.actualizar,
);

rutasVisitas.post(
  '/:id/cerrar',
  requierePermiso('visitas.editar'),
  validar(esquemaCerrarVisita),
  controlador.cerrar,
);

rutasVisitas.post(
  '/:id/notas',
  requierePermiso('visitas.editar'),
  validar(esquemaNotaVisita),
  controlador.agregarNota,
);

rutasVisitas.post(
  '/:id/anular',
  requierePermiso('visitas.anular'),
  validar(esquemaAnular),
  controlador.anular,
);

rutasVisitas.post(
  '/:id/medicacion',
  requierePermiso('visitas.editar'),
  validar(esquemaCrearMedicacion),
  controlador.crearMedicacion,
);

rutasVisitas.patch(
  '/:id/medicacion/:medicacionId',
  requierePermiso('visitas.editar'),
  validar(esquemaActualizarMedicacion),
  controlador.actualizarMedicacion,
);

rutasVisitas.post(
  '/:id/medicacion/:medicacionId/anular',
  requierePermiso('visitas.anular'),
  validar(esquemaAnular),
  controlador.anularMedicacion,
);
