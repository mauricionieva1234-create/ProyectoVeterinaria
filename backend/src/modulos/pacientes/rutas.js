import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaCrearPaciente,
  esquemaEditarPaciente,
  esquemaListadoPacientes,
} from './esquemas.js';
import { esquemaListadoRegistros } from '../registros/esquemas.js';
import { listarPorPaciente } from '../registros/controlador.js';
import { recibirArchivo } from '../../middlewares/archivos.js';
import { quitarFoto, subirFoto } from '../adjuntos/controlador.js';
import * as controlador from './controlador.js';

export const rutasPacientes = Router();

rutasPacientes.use(requiereAutenticacion);

rutasPacientes.get(
  '/',
  requierePermiso('pacientes.ver'),
  validarConsulta(esquemaListadoPacientes),
  controlador.listar,
);

rutasPacientes.get('/:id', requierePermiso('pacientes.ver'), controlador.obtener);

rutasPacientes.get(
  '/:pacienteId/registros',
  requierePermiso('registros.ver'),
  validarConsulta(esquemaListadoRegistros),
  listarPorPaciente,
);

rutasPacientes.post(
  '/',
  requierePermiso('pacientes.crear'),
  validar(esquemaCrearPaciente),
  controlador.crear,
);

rutasPacientes.put(
  '/:id',
  requierePermiso('pacientes.editar'),
  validar(esquemaEditarPaciente),
  controlador.actualizar,
);

rutasPacientes.post(
  '/:id/foto',
  requierePermiso('pacientes.editar'),
  requierePermiso('adjuntos.crear'),
  recibirArchivo,
  subirFoto,
);

rutasPacientes.post('/:id/foto/quitar', requierePermiso('pacientes.editar'), quitarFoto);
