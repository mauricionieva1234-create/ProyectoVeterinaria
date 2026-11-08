import { env } from '../src/config/env.js';
import { cerrarPool, ejecutarMigraciones } from './utilidades.js';

if (!env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en backend/.env');
  process.exit(1);
}

try {
  console.log('Revirtiendo todas las migraciones de desarrollo...');
  await ejecutarMigraciones({
    databaseUrl: env.DATABASE_URL,
    direccion: 'down',
    cantidad: Number.POSITIVE_INFINITY,
  });

  console.log('Volviendo a migrar...');
  await ejecutarMigraciones({ databaseUrl: env.DATABASE_URL, direccion: 'up' });

  console.log('Base de desarrollo recreada.');
} catch (error) {
  console.error('No se pudo resetear la base:', error.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
