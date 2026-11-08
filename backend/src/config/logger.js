import pino from 'pino';
import { env } from './env.js';

// En desarrollo se usa pino-pretty para que la consola sea legible.
// En producción se emite JSON, que es lo que conviene para recolectar logs.
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'password',
      'password_hash',
    ],
    censor: '[redactado]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
