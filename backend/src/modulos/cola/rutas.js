import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaAltaRapida,
  esquemaCrearIngreso,
  esquemaDecisionUrgencia,
  esquemaEstadoIngreso,
  esquemaListadoSinCerrar,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasCola = Router();

rutasCola.use(requiereAutenticacion);

// Las rutas fijas van antes de las que llevan :id.
rutasCola.get(
  '/sin-cerrar',
  requierePermiso('cola.ver'),
  validarConsulta(esquemaListadoSinCerrar),
  controlador.sinCerrar,
);

// El alta rápida crea cliente y paciente, por eso pide los dos permisos.
rutasCola.post(
  '/alta-rapida',
  requierePermiso('pacientes.alta_rapida'),
  requierePermiso('cola.crear'),
  validar(esquemaAltaRapida),
  controlador.altaRapida,
);

rutasCola.get('/', requierePermiso('cola.ver'), controlador.listar);

rutasCola.post('/', requierePermiso('cola.crear'), validar(esquemaCrearIngreso), controlador.crear);

rutasCola.patch(
  '/:id/urgencia-posible',
  requierePermiso('cola.marcar_urgencia'),
  controlador.urgenciaPosible,
);

rutasCola.patch(
  '/:id/urgencia',
  requierePermiso('cola.confirmar_urgencia'),
  validar(esquemaDecisionUrgencia),
  controlador.decidirUrgencia,
);

rutasCola.patch('/:id/consultorio', requierePermiso('cola.editar'), controlador.consultorio);

rutasCola.patch(
  '/:id/estado',
  requierePermiso('cola.editar'),
  validar(esquemaEstadoIngreso),
  controlador.cambiarEstado,
);
