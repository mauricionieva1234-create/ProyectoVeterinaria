import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaBusquedaPrevia,
  esquemaCrearCliente,
  esquemaEditarCliente,
  esquemaListadoClientes,
  esquemaUnirClientes,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasClientes = Router();

rutasClientes.use(requiereAutenticacion);

rutasClientes.get(
  '/',
  requierePermiso('clientes.ver'),
  validarConsulta(esquemaListadoClientes),
  controlador.listar,
);

// Las rutas fijas van antes de /:id para que no las capture el parámetro.
rutasClientes.get(
  '/buscar',
  requierePermiso('clientes.ver'),
  validarConsulta(esquemaBusquedaPrevia),
  controlador.buscar,
);

rutasClientes.get(
  '/fichas-incompletas',
  requierePermiso('clientes.ver'),
  validarConsulta(esquemaListadoClientes),
  controlador.fichasIncompletas,
);

rutasClientes.get('/:id', requierePermiso('clientes.ver'), controlador.obtener);

rutasClientes.post(
  '/',
  requierePermiso('clientes.crear'),
  validar(esquemaCrearCliente),
  controlador.crear,
);

rutasClientes.put(
  '/:id',
  requierePermiso('clientes.editar'),
  validar(esquemaEditarCliente),
  controlador.actualizar,
);

// Unir duplicados es exclusivo del administrador.
rutasClientes.post(
  '/:id/unir',
  requierePermiso('clientes.unir'),
  validar(esquemaUnirClientes),
  controlador.unir,
);
