import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../src/config/env.js';
import { rutaHerramienta, versionDelServidor } from './pg-herramientas.js';

// Restaura el backup más reciente en una base temporal y compara los datos con
// la base actual. Sirve para comprobar que el backup sirve de verdad, sin tocar
// la base de desarrollo. Al terminar elimina la base temporal.
const PREFIJO_TEMPORAL = 'veterinaria_verificacion_';
const raiz = fileURLToPath(new URL('..', import.meta.url));
const carpeta = join(raiz, 'backups');

function elegirBackup() {
  const argumento = process.argv.find((valor) => valor.startsWith('--archivo='));

  if (argumento) {
    return resolve(argumento.split('=').slice(1).join('='));
  }

  if (!existsSync(carpeta)) return null;

  const backups = readdirSync(carpeta)
    .filter((nombre) => /^veterinaria-.*\.dump$/.test(nombre))
    .sort();

  return backups.length > 0 ? join(carpeta, backups[backups.length - 1]) : null;
}

function comando(nombre, argumentos, url) {
  return spawnSync(nombre, argumentos, {
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
    },
    stdio: 'inherit',
    shell: false,
  });
}

async function contarTablas(cliente) {
  const { rows: tablas } = await cliente.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const conteos = {};

  for (const { tablename } of tablas) {
    // Los nombres vienen de pg_tables, no de entrada del usuario.
    const identificador = `"${tablename.replaceAll('"', '""')}"`;
    const { rows } = await cliente.query(`SELECT count(*)::int AS total FROM ${identificador}`);
    conteos[tablename] = rows[0].total;
  }

  return conteos;
}

const archivo = elegirBackup();

if (!archivo) {
  console.error('No hay backups en backend/backups. Generá uno con npm run db:backup.');
  process.exit(1);
}

if (!existsSync(archivo)) {
  console.error(`No existe el archivo indicado: ${archivo}`);
  process.exit(1);
}

const url = new URL(env.DATABASE_URL);
const nombreBase = decodeURIComponent(url.pathname.replace(/^\//, ''));
const urlAdmin = new URL(url);
urlAdmin.pathname = '/postgres';

const nombreTemporal = `${PREFIJO_TEMPORAL}${Date.now()}`;
let admin;

try {
  admin = new pg.Client({ connectionString: urlAdmin.toString() });
  await admin.connect();

  console.log(`Restaurando ${archivo} en ${nombreTemporal}...`);
  await admin.query(`CREATE DATABASE ${nombreTemporal}`);

  const pgRestore = rutaHerramienta('pg_restore', await versionDelServidor(env.DATABASE_URL));
  const restauracion = comando(
    pgRestore,
    [
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      `--host=${url.hostname}`,
      `--port=${url.port || '5432'}`,
      `--username=${decodeURIComponent(url.username)}`,
      `--dbname=${nombreTemporal}`,
      archivo,
    ],
    url,
  );

  if (restauracion.error) {
    throw new Error('No se pudo ejecutar pg_restore. Verificá que esté en el PATH.');
  }

  if (restauracion.status !== 0) {
    throw new Error(`pg_restore terminó con código ${restauracion.status}`);
  }

  const urlTemporal = new URL(url);
  urlTemporal.pathname = `/${nombreTemporal}`;

  const restaurada = new pg.Client({ connectionString: urlTemporal.toString() });
  const actual = new pg.Client({ connectionString: url.toString() });

  try {
    await restaurada.connect();
    await actual.connect();

    const funciones = await restaurada.query(
      `SELECT fn_sin_tildes('Pérez') AS valor,
              (SELECT count(*)::int FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')) AS extensiones`,
    );

    if (funciones.rows[0].valor !== 'perez') {
      throw new Error('La función fn_sin_tildes no se restauró correctamente.');
    }

    if (funciones.rows[0].extensiones !== 2) {
      throw new Error('Faltan las extensiones pg_trgm o unaccent en la copia.');
    }

    const conteosActuales = await contarTablas(actual);
    const conteosRestaurados = await contarTablas(restaurada);

    const diferencias = Object.keys(conteosActuales).filter(
      (tabla) => conteosActuales[tabla] !== conteosRestaurados[tabla],
    );

    if (diferencias.length > 0) {
      const detalle = diferencias
        .map(
          (tabla) =>
            `  ${tabla}: actual ${conteosActuales[tabla]}, restaurada ${conteosRestaurados[tabla]}`,
        )
        .join('\n');

      throw new Error(
        `La copia no coincide con la base actual en ${diferencias.length} tabla(s):\n${detalle}\n` +
          'Detené el backend y volvé a intentar para descartar escrituras durante la restauración.',
      );
    }

    console.log(`Verificación correcta: ${Object.keys(conteosActuales).length} tablas coinciden.`);
    console.log(`Base verificada: ${nombreBase}.`);
  } finally {
    await restaurada.end().catch(() => {});
    await actual.end().catch(() => {});
  }
} catch (error) {
  console.error(`La verificación falló: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (admin) {
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${nombreTemporal} WITH (FORCE)`);
      console.log(`Base temporal ${nombreTemporal} eliminada.`);
    } catch (error) {
      console.error(`No se pudo eliminar la base temporal: ${error.message}`);
      process.exitCode = 1;
    }

    await admin.end().catch(() => {});
  }
}
