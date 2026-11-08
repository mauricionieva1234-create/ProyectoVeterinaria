import { Router } from 'express';
import { requiereAutenticacion } from '../../middlewares/autenticacion.js';
import { limitarLogin } from '../../middlewares/limitarLogin.js';
import { validar } from '../../middlewares/validar.js';
import { esquemaLogin } from './esquemas.js';
import * as controlador from './controlador.js';

export const rutasAuth = Router();

rutasAuth.post('/login', limitarLogin, validar(esquemaLogin), controlador.login);

// El logout es idempotente: si no hay sesión, igual borra la cookie.
rutasAuth.post('/logout', controlador.logout);

rutasAuth.get('/me', requiereAutenticacion, controlador.me);
