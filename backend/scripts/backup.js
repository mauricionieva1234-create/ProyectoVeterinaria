import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

// Genera un backup comprimido en formato custom de PostgreSQL dentro de
// backups/. La restauración se explica en el README.
const raiz = fileURLToPath(new URL('..', import.meta.url));
const carpeta = join(raiz, 'backups');

mkdirSync(carpeta, { recursive: true });

const url = new URL(env.DATABASE_URL);
const marca = new Date().toISOString().replace(/[:.]/g, '-');
const destino = join(carpeta, `veterinaria-${marca}.dump`);

const argumentos = [
  '--format=custom',
  `--file=${destino}`,
  `--host=${url.hostname}`,
  `--port=${url.port || '5432'}`,
  `--username=${decodeURIComponent(url.username)}`,
  `--dbname=${decodeURIComponent(url.pathname.replace(/^\//, ''))}`,
];

const resultado = spawnSync('pg_dump', argumentos, {
  env: {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
  },
  stdio: 'inherit',
  shell: false,
});

if (resultado.error) {
  console.error('No se pudo ejecutar pg_dump. Verificá que esté en el PATH.');
  console.error(resultado.error.message);
  process.exit(1);
}

if (resultado.status !== 0) {
  console.error(`pg_dump terminó con código ${resultado.status}`);
  process.exit(resultado.status ?? 1);
}

console.log(`Backup creado en ${destino}`);
