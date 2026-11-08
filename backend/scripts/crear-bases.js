import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

const { Client } = pg;

function datosDeConexion(cadena) {
  const url = new URL(cadena);

  return {
    nombre: decodeURIComponent(url.pathname.replace(/^\//, '')),
    conexion: {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
      // Siempre nos conectamos a "postgres" para poder crear la base pedida.
      database: 'postgres',
    },
  };
}

async function crearBaseSiNoExiste(cadena) {
  const { nombre, conexion } = datosDeConexion(cadena);

  if (!nombre) {
    throw new Error(`La cadena de conexión no incluye el nombre de la base: ${cadena}`);
  }

  const cliente = new Client(conexion);
  await cliente.connect();

  try {
    const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      nombre,
    ]);

    if (rowCount > 0) {
      console.log(`La base ${nombre} ya existe.`);
      return;
    }

    // El nombre viene de una variable de entorno, pero igual se escapa.
    const identificador = `"${nombre.replace(/"/g, '""')}"`;
    await cliente.query(`CREATE DATABASE ${identificador}`);
    console.log(`Base ${nombre} creada.`);
  } finally {
    await cliente.end();
  }
}

const cadenas = [env.DATABASE_URL, env.TEST_DATABASE_URL].filter(Boolean);
const nombres = new Set();

for (const cadena of cadenas) {
  const { nombre } = datosDeConexion(cadena);

  if (nombres.has(nombre)) continue;
  nombres.add(nombre);

  try {
    await crearBaseSiNoExiste(cadena);
  } catch (error) {
    console.error(`No se pudo crear la base ${nombre}:`, error.message);
    process.exitCode = 1;
  }
}
