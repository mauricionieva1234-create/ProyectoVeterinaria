import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { rutaHerramienta, versionDelServidor } from './pg-herramientas.js';

// Genera un backup comprimido en formato custom de PostgreSQL dentro de
// backups/. Conserva los últimos N archivos (14 por defecto) para no llenar el
// disco. La restauración y la verificación se explican en el README.
const RETENCION_POR_DEFECTO = 14;
const raiz = fileURLToPath(new URL('..', import.meta.url));
const carpeta = join(raiz, 'backups');

function leerRetencion() {
  const argumento = process.argv.find((valor) => valor.startsWith('--retencion='));

  if (!argumento) return RETENCION_POR_DEFECTO;

  const valor = Number.parseInt(argumento.split('=')[1], 10);

  if (!Number.isInteger(valor) || valor < 1) {
    console.error('La retención tiene que ser un número entero mayor a cero.');
    process.exit(1);
  }

  return valor;
}

// Marca local de Tucumán para que el nombre del archivo coincida con la hora
// que ve el usuario, no con UTC.
function marcaLocal() {
  const fecha = new Intl.DateTimeFormat('sv-SE', {
    timeZone: env.ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  return fecha.replace(' ', '_').replace(/:/g, '-');
}

function listarBackups() {
  return readdirSync(carpeta)
    .filter((nombre) => /^veterinaria-.*\.dump$/.test(nombre))
    .sort();
}

const retencion = leerRetencion();
mkdirSync(carpeta, { recursive: true });

const url = new URL(env.DATABASE_URL);
const destino = join(carpeta, `veterinaria-${marcaLocal()}.dump`);
const pgDump = rutaHerramienta('pg_dump', await versionDelServidor(env.DATABASE_URL));

const argumentos = [
  '--format=custom',
  `--file=${destino}`,
  `--host=${url.hostname}`,
  `--port=${url.port || '5432'}`,
  `--username=${decodeURIComponent(url.username)}`,
  `--dbname=${decodeURIComponent(url.pathname.replace(/^\//, ''))}`,
];

const resultado = spawnSync(pgDump, argumentos, {
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

const tamanio = statSync(destino).size;

if (tamanio === 0) {
  unlinkSync(destino);
  console.error('El backup quedó vacío; se eliminó el archivo.');
  process.exit(1);
}

// Rotación: se eliminan los más viejos y se conservan los más recientes.
const backups = listarBackups();
const sobrantes = backups.slice(0, Math.max(0, backups.length - retencion));

for (const nombre of sobrantes) {
  unlinkSync(join(carpeta, nombre));
}

console.log(`Backup creado en ${destino} (${(tamanio / 1024 / 1024).toFixed(2)} MB).`);
console.log(
  `Se conservan los últimos ${retencion} backups; se eliminaron ${sobrantes.length} archivo(s) viejo(s).`,
);
