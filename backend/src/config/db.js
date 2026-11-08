import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// La conexión se crea una sola vez y se reutiliza en todo el proceso.
// En la fase 0 puede no estar configurada; el endpoint de salud no la necesita.
export const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
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
