import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

// pg_dump y pg_restore tienen que ser de la misma versión mayor que el
// servidor. En Windows es común tener varias instalaciones y que el PATH
// apunte a la vieja, así que se busca la herramienta correcta.
export async function versionDelServidor(url) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();

  try {
    const { rows } = await cliente.query(
      `SELECT current_setting('server_version_num')::int AS version`,
    );
    return rows[0].version;
  } finally {
    await cliente.end().catch(() => {});
  }
}

export function rutaHerramienta(nombre, versionServidor) {
  const mayor = Math.floor(versionServidor / 10000);
  const ejecutable = process.platform === 'win32' ? `${nombre}.exe` : nombre;
  const candidatos = [];

  // PG_BIN permite indicar una carpeta concreta sin depender del PATH.
  if (process.env.PG_BIN) {
    candidatos.push(join(process.env.PG_BIN, ejecutable));
  }

  if (process.platform === 'win32') {
    const base = process.env.ProgramFiles ?? 'C:\\Program Files';
    candidatos.push(join(base, 'PostgreSQL', String(mayor), 'bin', ejecutable));
  } else {
    candidatos.push(`/usr/lib/postgresql/${mayor}/bin/${nombre}`);
    candidatos.push(`/opt/homebrew/opt/postgresql@${mayor}/bin/${nombre}`);
    candidatos.push(`/usr/local/opt/postgresql@${mayor}/bin/${nombre}`);
  }

  return candidatos.find((ruta) => existsSync(ruta)) ?? nombre;
}
