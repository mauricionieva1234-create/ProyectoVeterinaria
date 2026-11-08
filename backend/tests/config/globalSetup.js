// Se ejecuta una sola vez antes de todos los tests: aplica las migraciones en
// la base de test. Nunca toca la base de desarrollo.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';

const { env } = await import('../../src/config/env.js');
const { runner } = await import('node-pg-migrate');
const { fileURLToPath } = await import('node:url');

export default async function configurarBaseDeTest() {
  if (!env.TEST_DATABASE_URL) {
    throw new Error('Falta TEST_DATABASE_URL en backend/.env para correr los tests');
  }

  if (env.TEST_DATABASE_URL === env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL no puede ser igual a DATABASE_URL');
  }

  const nombre = new URL(env.TEST_DATABASE_URL).pathname.replace(/^\//, '');

  if (!nombre.includes('test')) {
    throw new Error('Por seguridad, el nombre de la base de test debe contener "test"');
  }

  await runner({
    databaseUrl: env.TEST_DATABASE_URL,
    dir: fileURLToPath(new URL('../../migrations', import.meta.url)),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
}
