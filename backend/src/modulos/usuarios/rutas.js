import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validar, validarConsulta } from '../../middlewares/validar.js';
import {
  esquemaCambiarEstado,
  esquemaCrearUsuario,
  esquemaEditarUsuario,
  esquemaListadoUsuarios,
} from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasUsuarios = Router();

// Toda la administración de usuarios es exclusiva del admin.
rutasUsuarios.use(requiereAutenticacion, requierePermiso('usuarios.ver'));

rutasUsuarios.get('/', validarConsulta(esquemaListadoUsuarios), controlador.listar);

rutasUsuarios.get('/:id', controlador.obtener);

rutasUsuarios.post(
  '/',
  requierePermiso('usuarios.crear'),
  validar(esquemaCrearUsuario),
  controlador.crear,
);

rutasUsuarios.put(
  '/:id',
  requierePermiso('usuarios.editar'),
  validar(esquemaEditarUsuario),
  controlador.actualizar,
);

rutasUsuarios.patch(
  '/:id/estado',
  requierePermiso('usuarios.desactivar'),
  validar(esquemaCambiarEstado),
  controlador.cambiarEstado,
);
