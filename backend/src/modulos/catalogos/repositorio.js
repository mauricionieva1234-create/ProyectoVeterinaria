import { obtenerPool } from '../../config/db.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Especies con búsqueda opcional sin tildes. El catálogo es chico, así que no
// se pagina: el frontend lo usa para selects y sugerencias.
export async function listarEspecies({ buscar }, cliente) {
  const parametros = [];

  if (buscar) {
    parametros.push(buscar);
  }

  const filtro = buscar ? `WHERE fn_sin_tildes(nombre) LIKE '%' || fn_sin_tildes($1) || '%'` : '';

  const { rows } = await ejecutar(
    `SELECT id, nombre FROM especie ${filtro} ORDER BY nombre, id`,
    parametros,
    cliente,
  );

  return rows;
}

export async function listarRazas({ especieId, buscar }, cliente) {
  const condiciones = [];
  const parametros = [];

  if (especieId) {
    parametros.push(especieId);
    condiciones.push(`especie_id = $${parametros.length}`);
  }

  if (buscar) {
    parametros.push(buscar);
    condiciones.push(
      `fn_sin_tildes(nombre) LIKE '%' || fn_sin_tildes($${parametros.length}) || '%'`,
    );
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await ejecutar(
    `SELECT id, especie_id, nombre FROM raza ${donde} ORDER BY nombre, id`,
    parametros,
    cliente,
  );

  return rows;
}

export async function buscarEspeciePorId(id, cliente) {
  const { rows } = await ejecutar('SELECT id, nombre FROM especie WHERE id = $1', [id], cliente);
  return rows[0] ?? null;
}

export async function buscarRazaPorId(id, cliente) {
  const { rows } = await ejecutar(
    'SELECT id, especie_id, nombre FROM raza WHERE id = $1',
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

// Compara ignorando mayúsculas y tildes para no crear duplicados por errores
// de tipeo.
export async function existeEspecieConNombre(nombre, excluirId, cliente) {
  const { rowCount } = await ejecutar(
    `SELECT 1 FROM especie
     WHERE lower(fn_sin_tildes(nombre)) = lower(fn_sin_tildes($1))
       AND ($2::bigint IS NULL OR id <> $2)`,
    [nombre, excluirId ?? null],
    cliente,
  );
  return rowCount > 0;
}

export async function existeRazaConNombre(especieId, nombre, excluirId, cliente) {
  const { rowCount } = await ejecutar(
    `SELECT 1 FROM raza
     WHERE especie_id = $1
       AND lower(fn_sin_tildes(nombre)) = lower(fn_sin_tildes($2))
       AND ($3::bigint IS NULL OR id <> $3)`,
    [especieId, nombre, excluirId ?? null],
    cliente,
  );
  return rowCount > 0;
}

// Nombres parecidos para avisar antes de crear un duplicado por typo.
export async function especiesSimilares(nombre, cliente) {
  const { rows } = await ejecutar(
    `SELECT nombre
     FROM especie
     WHERE similarity(fn_sin_tildes(nombre), fn_sin_tildes($1)) > 0.25
     ORDER BY similarity(fn_sin_tildes(nombre), fn_sin_tildes($1)) DESC
     LIMIT 5`,
    [nombre],
    cliente,
  );
  return rows.map((fila) => fila.nombre);
}

export async function razasSimilares(especieId, nombre, cliente) {
  const { rows } = await ejecutar(
    `SELECT nombre
     FROM raza
     WHERE especie_id = $1
       AND similarity(fn_sin_tildes(nombre), fn_sin_tildes($2)) > 0.25
     ORDER BY similarity(fn_sin_tildes(nombre), fn_sin_tildes($2)) DESC
     LIMIT 5`,
    [especieId, nombre],
    cliente,
  );
  return rows.map((fila) => fila.nombre);
}

export async function crearEspecie(nombre, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO especie (nombre, creado_por, actualizado_por)
     VALUES ($1, $2, $2)
     RETURNING id, nombre`,
    [nombre, ejecutorId],
    cliente,
  );
  return rows[0];
}

export async function crearRaza(especieId, nombre, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO raza (especie_id, nombre, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $3)
     RETURNING id, especie_id, nombre`,
    [especieId, nombre, ejecutorId],
    cliente,
  );
  return rows[0];
}
