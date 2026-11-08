import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// En tests se usa siempre la base de test, nunca la de desarrollo.
const cadenaConexion = env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL;

export const pool = cadenaConexion
  ? new Pool({
      connectionString: cadenaConexion,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

export function obtenerPool() {
  if (!pool) {
    throw new Error('Falta DATABASE_URL en el archivo .env del backend');
  }
  return pool;
}

export async function cerrarPool() {
  if (pool) {
    await pool.end();
  }
}
