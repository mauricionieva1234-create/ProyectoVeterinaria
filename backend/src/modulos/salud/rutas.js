import { Router } from 'express';

export const rutasSalud = Router();

rutasSalud.get('/', (req, res) => {
  res.json({
    estado: 'ok',
    servicio: 'veterinaria-api',
    hora: new Date().toISOString(),
  });
});
