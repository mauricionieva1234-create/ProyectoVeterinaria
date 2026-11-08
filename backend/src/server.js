import { app } from './app.js';
import { cerrarPool } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const servidor = app.listen(env.PORT, () => {
  logger.info(`API escuchando en http://localhost:${env.PORT}`);
});

function cerrar(senal) {
  logger.info(`${senal} recibido. Cerrando el servidor...`);

  servidor.close(async () => {
    await cerrarPool();
    process.exit(0);
  });

  // Si alguna conexión queda colgada, no esperamos para siempre.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGINT', () => cerrar('SIGINT'));
process.once('SIGTERM', () => cerrar('SIGTERM'));
