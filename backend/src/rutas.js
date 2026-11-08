import { Router } from 'express';
import { rutasSalud } from './modulos/salud/rutas.js';
import { rutasAuth } from './modulos/auth/rutas.js';
import { rutasUsuarios } from './modulos/usuarios/rutas.js';
import { rutasAuditoria } from './modulos/auditoria/rutas.js';

export const rutas = Router();

rutas.use('/salud', rutasSalud);
rutas.use('/auth', rutasAuth);
rutas.use('/usuarios', rutasUsuarios);
rutas.use('/auditoria', rutasAuditoria);
