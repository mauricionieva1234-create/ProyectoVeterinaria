import { obtenerPool } from '../../config/db.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

const CAMPOS_PRECIO = `
  p.id,
  p.nombre,
  p.importe,
  p.activo,
  p.observaciones,
  p.creado_en,
  p.actualizado_en
`;

const CAMPOS_HISTORIAL = `
  h.id,
  h.precio_id,
  h.nombre_anterior,
  h.nombre_nuevo,
  h.importe_anterior,
  h.importe_nuevo,
  h.motivo,
  h.cambiado_en,
  u.nombre_completo AS cambiado_por_nombre
`;

// La lista es chica y se usa en selects, así que no se pagina. Por defecto se
// muestran solo los activos; la pantalla de administración pide todos.
export async function listarPrecios({ buscar, incluirInactivos }, cliente) {
  const parametros = [];
  const condiciones = [];

  if (!incluirInactivos) {
    condiciones.push('p.activo = true');
  }

  if (buscar) {
    parametros.push(buscar);
    condiciones.push(
      `fn_sin_tildes(p.nombre) LIKE '%' || fn_sin_tildes($${parametros.length}) || '%'`,
    );
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PRECIO}
     FROM precio p
     ${donde}
     ORDER BY p.activo DESC, lower(fn_sin_tildes(p.nombre)), p.id`,
    parametros,
    cliente,
  );

  return rows;
}

export async function buscarPrecioPorId(id, cliente, { bloquear = false } = {}) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PRECIO}
     FROM precio p
     WHERE p.id = $1
     ${bloquear ? 'FOR UPDATE OF p' : ''}`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

// Compara sin mayúsculas ni tildes para no crear dos precios activos con el
// mismo nombre por un error de tipeo.
export async function existePrecioActivoConNombre(nombre, excluirId, cliente) {
  const { rowCount } = await ejecutar(
    `SELECT 1 FROM precio
     WHERE activo = true
       AND lower(fn_sin_tildes(nombre)) = lower(fn_sin_tildes($1))
       AND ($2::bigint IS NULL OR id <> $2)`,
    [nombre, excluirId ?? null],
    cliente,
  );
  return rowCount > 0;
}

export async function crearPrecio({ nombre, importe, observaciones }, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO precio (nombre, importe, observaciones, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING id`,
    [nombre, importe, observaciones, ejecutorId],
    cliente,
  );
  return rows[0].id;
}

export async function actualizarPrecio(
  id,
  { nombre, importe, activo, observaciones },
  ejecutorId,
  cliente,
) {
  await ejecutar(
    `UPDATE precio
     SET nombre = $2,
         importe = $3,
         activo = $4,
         observaciones = $5,
         actualizado_por = $6
     WHERE id = $1`,
    [id, nombre, importe, activo, observaciones, ejecutorId],
    cliente,
  );
}

export async function registrarHistorial(
  { precioId, nombreAnterior, nombreNuevo, importeAnterior, importeNuevo, motivo, cambiadoPor },
  cliente,
) {
  await ejecutar(
    `INSERT INTO precio_historial (
       precio_id, nombre_anterior, nombre_nuevo,
       importe_anterior, importe_nuevo, motivo, cambiado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [precioId, nombreAnterior, nombreNuevo, importeAnterior, importeNuevo, motivo, cambiadoPor],
    cliente,
  );
}

export async function listarHistorial(precioId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_HISTORIAL}
     FROM precio_historial h
     JOIN usuario u ON u.id = h.cambiado_por
     WHERE h.precio_id = $1
     ORDER BY h.cambiado_en DESC, h.id DESC`,
    [precioId],
    cliente,
  );
  return rows;
}
