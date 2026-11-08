import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

// Columnas que se devuelven al frontend. El password_hash nunca sale de acá.
const CAMPOS_PUBLICOS = `
  id, nombre_completo, email, rol, matricula, activo, creado_en, actualizado_en
`;

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

export async function buscarUsuarioPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PUBLICOS} FROM usuario WHERE id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

// Solo para el login: incluye el hash para poder comparar la contraseña.
export async function buscarUsuarioPorEmail(email, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PUBLICOS}, password_hash
     FROM usuario
     WHERE lower(email) = lower($1)`,
    [email],
    cliente,
  );
  return rows[0] ?? null;
}

export async function existeEmail(email, excluirId, cliente) {
  const { rowCount } = await ejecutar(
    `SELECT 1 FROM usuario
     WHERE lower(email) = lower($1)
       AND ($2::bigint IS NULL OR id <> $2)`,
    [email, excluirId ?? null],
    cliente,
  );
  return rowCount > 0;
}

export async function listarUsuarios({ pagina, limite, buscar, rol, activo }) {
  const condiciones = [];
  const parametros = [];

  if (buscar) {
    parametros.push(`%${buscar}%`);
    condiciones.push(
      `(nombre_completo ILIKE $${parametros.length} OR email ILIKE $${parametros.length})`,
    );
  }

  if (rol) {
    parametros.push(rol);
    condiciones.push(`rol = $${parametros.length}`);
  }

  if (activo !== undefined) {
    parametros.push(activo);
    condiciones.push(`activo = $${parametros.length}`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const conteo = await ejecutar(`SELECT count(*)::int AS total FROM usuario ${donde}`, parametros);

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PUBLICOS}
     FROM usuario
     ${donde}
     ORDER BY nombre_completo, id
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

export async function crearUsuario(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO usuario (
       nombre_completo, email, password_hash, rol, matricula, activo,
       creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING ${CAMPOS_PUBLICOS}`,
    [
      datos.nombreCompleto,
      datos.email,
      datos.passwordHash,
      datos.rol,
      datos.matricula ?? null,
      datos.activo,
      ejecutorId,
    ],
    cliente,
  );
  return rows[0];
}

export async function actualizarUsuario(id, datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE usuario
     SET nombre_completo = $2,
         email = $3,
         rol = $4,
         matricula = $5,
         activo = $6,
         password_hash = COALESCE($7, password_hash),
         actualizado_por = $8
     WHERE id = $1
     RETURNING ${CAMPOS_PUBLICOS}`,
    [
      id,
      datos.nombreCompleto,
      datos.email,
      datos.rol,
      datos.matricula ?? null,
      datos.activo,
      datos.passwordHash ?? null,
      ejecutorId,
    ],
    cliente,
  );
  return rows[0] ?? null;
}

export async function cambiarEstadoUsuario(id, activo, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE usuario
     SET activo = $2, actualizado_por = $3
     WHERE id = $1
     RETURNING ${CAMPOS_PUBLICOS}`,
    [id, activo, ejecutorId],
    cliente,
  );
  return rows[0] ?? null;
}

// Cuenta admins activos distintos del usuario indicado. Se usa para no dejar
// el sistema sin ningún administrador.
export async function contarAdminsActivos(excluirId, cliente) {
  const { rows } = await ejecutar(
    `SELECT count(*)::int AS total
     FROM usuario
     WHERE rol = 'admin'
       AND activo = true
       AND ($1::bigint IS NULL OR id <> $1)`,
    [excluirId ?? null],
    cliente,
  );
  return rows[0].total;
}
