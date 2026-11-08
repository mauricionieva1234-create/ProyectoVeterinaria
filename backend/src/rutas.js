import { Router } from 'express';
import { rutasSalud } from './modulos/salud/rutas.js';

export const rutas = Router();

rutas.use('/salud', rutasSalud);
