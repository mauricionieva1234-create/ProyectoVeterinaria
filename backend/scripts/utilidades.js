import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { obtenerPool, cerrarPool } from '../src/config/db.js';

export { obtenerPool, cerrarPool };

export const RUTA_MIGRACIONES = fileURLToPath(new URL('../migrations', import.meta.url));

// Ejecuta node-pg-migrate de forma programática para poder elegir la base
// (desarrollo o test) sin depender de variables de entorno del sistema.
export async function ejecutarMigraciones({ databaseUrl, direccion, cantidad }) {
  await runner({
    databaseUrl,
    dir: RUTA_MIGRACIONES,
    direction: direccion,
    count: cantidad,
    migrationsTable: 'pgmigrations',
    log: (mensaje) => console.log(mensaje),
  });
}

export async function insertarEspecie(cliente, nombre) {
  await cliente.query(
    `INSERT INTO especie (nombre)
     SELECT $1
     WHERE NOT EXISTS (SELECT 1 FROM especie WHERE lower(nombre) = lower($1))`,
    [nombre],
  );
}

export async function insertarRaza(cliente, especieId, nombre) {
  await cliente.query(
    `INSERT INTO raza (especie_id, nombre)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM raza WHERE especie_id = $1 AND lower(nombre) = lower($2)
     )`,
    [especieId, nombre],
  );
}

export async function insertarFranja(cliente, nombre, desde, hasta) {
  await cliente.query(
    `INSERT INTO configuracion_franja_control (nombre, hora_desde, hora_hasta)
     SELECT $1, $2::time, $3::time
     WHERE NOT EXISTS (
       SELECT 1 FROM configuracion_franja_control WHERE nombre = $1
     )`,
    [nombre, desde, hasta],
  );
}

export async function buscarId(cliente, tabla, columna, valor) {
  const { rows } = await cliente.query(`SELECT id FROM ${tabla} WHERE ${columna} = $1 LIMIT 1`, [
    valor,
  ]);
  return rows[0]?.id ?? null;
}
