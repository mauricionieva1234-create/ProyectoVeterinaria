import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { rutas } from './rutas.js';
import { manejarErrores } from './middlewares/errores.js';
import { noEncontrado } from './middlewares/noEncontrado.js';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGEN.split(',').map((origen) => origen.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Límite general de peticiones. El login tiene su propio límite más estricto
  // en la fase 1.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          codigo: 'DEMASIADAS_PETICIONES',
          mensaje: 'Demasiadas peticiones. Probá de nuevo en unos minutos.',
          detalles: [],
        },
      },
    }),
  );

  app.use('/api', rutas);

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}

export const app = crearApp();
