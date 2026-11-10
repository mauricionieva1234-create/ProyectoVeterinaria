import { Router } from 'express';
import { rutasSalud } from './modulos/salud/rutas.js';
import { rutasAuth } from './modulos/auth/rutas.js';
import { rutasUsuarios } from './modulos/usuarios/rutas.js';
import { rutasAuditoria } from './modulos/auditoria/rutas.js';
import { rutasCatalogos } from './modulos/catalogos/rutas.js';
import { rutasClientes } from './modulos/clientes/rutas.js';
import { rutasPacientes } from './modulos/pacientes/rutas.js';
import { rutasCola } from './modulos/cola/rutas.js';

export const rutas = Router();

rutas.use('/salud', rutasSalud);
rutas.use('/auth', rutasAuth);
rutas.use('/usuarios', rutasUsuarios);
rutas.use('/auditoria', rutasAuditoria);
rutas.use('/catalogos', rutasCatalogos);
rutas.use('/clientes', rutasClientes);
rutas.use('/pacientes', rutasPacientes);
rutas.use('/cola', rutasCola);
