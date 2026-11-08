import { env } from '../src/config/env.js';
import { cerrarPool, ejecutarMigraciones } from './utilidades.js';

const [direccion = 'up', base = 'dev', alcance = 'una'] = process.argv.slice(2);

if (!['up', 'down'].includes(direccion)) {
  console.error('Uso: node scripts/migrar.js <up|down> [dev|test] [una|todo]');
  process.exit(1);
}

if (!['dev', 'test'].includes(base)) {
  console.error('La base tiene que ser "dev" o "test"');
  process.exit(1);
}

const databaseUrl = base === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;

if (!databaseUrl) {
  console.error(`Falta ${base === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} en backend/.env`);
  process.exit(1);
}

const cantidad =
  direccion === 'down' ? (alcance === 'todo' ? Number.POSITIVE_INFINITY : 1) : undefined;

try {
  console.log(`Migraciones ${direccion} en la base de ${base}...`);
  await ejecutarMigraciones({ databaseUrl, direccion, cantidad });
  console.log('Listo.');
} catch (error) {
  console.error('No se pudieron ejecutar las migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
