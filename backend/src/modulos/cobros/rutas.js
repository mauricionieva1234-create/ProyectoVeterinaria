import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaActualizarCobro,
  esquemaAnular,
  esquemaCrearCobro,
  esquemaCrearPago,
  esquemaListadoCobros,
  esquemaListadoDeudas,
  esquemaResumenCaja,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasCobros = Router();

rutasCobros.use(requiereAutenticacion);

// Las rutas fijas van antes de las que llevan :id.
rutasCobros.get('/pendientes', requierePermiso('cobros.ver'), controlador.pendientes);

rutasCobros.get(
  '/deudas',
  requierePermiso('cobros.ver'),
  validarConsulta(esquemaListadoDeudas),
  controlador.deudas,
);

rutasCobros.get(
  '/caja',
  requierePermiso('caja.ver'),
  validarConsulta(esquemaResumenCaja),
  controlador.caja,
);

rutasCobros.get(
  '/',
  requierePermiso('cobros.ver'),
  validarConsulta(esquemaListadoCobros),
  controlador.listar,
);

rutasCobros.post(
  '/',
  requierePermiso('cobros.crear'),
  validar(esquemaCrearCobro),
  controlador.crear,
);

rutasCobros.get('/:id', requierePermiso('cobros.ver'), controlador.obtener);

rutasCobros.patch(
  '/:id',
  requierePermiso('cobros.editar'),
  validar(esquemaActualizarCobro),
  controlador.actualizar,
);

rutasCobros.post(
  '/:id/anular',
  requierePermiso('cobros.anular'),
  validar(esquemaAnular),
  controlador.anular,
);

rutasCobros.post(
  '/:id/pagos',
  requierePermiso('pagos.registrar'),
  validar(esquemaCrearPago),
  controlador.registrarPago,
);

rutasCobros.post(
  '/:id/pagos/:pagoId/anular',
  requierePermiso('pagos.anular'),
  validar(esquemaAnular),
  controlador.anularPago,
);
