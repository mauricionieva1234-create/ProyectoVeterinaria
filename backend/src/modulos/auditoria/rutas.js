import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { requierePermiso } from '../../middlewares/permisos.js';
import { validarConsulta } from '../../middlewares/validar.js';
import { esquemaListadoAuditoria } from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasAuditoria = Router();

rutasAuditoria.get(
  '/',
  requiereAutenticacion,
  requierePermiso('auditoria.ver'),
  validarConsulta(esquemaListadoAuditoria),
  controlador.listar,
);
