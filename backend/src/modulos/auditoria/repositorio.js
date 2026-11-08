import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Se llama dentro de la misma transacción que el cambio auditado.
export async function registrarAuditoria(
  { usuarioId, entidad, entidadId, accion, antes = null, despues = null },
  cliente,
) {
  await ejecutar(
    `INSERT INTO auditoria (
       usuario_id, entidad, entidad_id, accion, antes, despues, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $1, $1)`,
    [usuarioId, entidad, entidadId, accion, antes, despues],
    cliente,
  );
}

export async function listarAuditoria({
  pagina,
  limite,
  entidad,
  accion,
  usuarioId,
  desde,
  hasta,
}) {
  const condiciones = [];
  const parametros = [];

  if (entidad) {
    parametros.push(entidad);
    condiciones.push(`a.entidad = $${parametros.length}`);
  }

  if (accion) {
    parametros.push(accion);
    condiciones.push(`a.accion = $${parametros.length}`);
  }

  if (usuarioId) {
    parametros.push(usuarioId);
    condiciones.push(`a.usuario_id = $${parametros.length}`);
  }

  if (desde) {
    parametros.push(desde);
    condiciones.push(`a.fecha >= $${parametros.length}::date`);
  }

  if (hasta) {
    parametros.push(hasta);
    condiciones.push(`a.fecha < ($${parametros.length}::date + interval '1 day')`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total FROM auditoria a ${donde}`,
    parametros,
  );

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT a.id,
            a.usuario_id,
            u.nombre_completo AS usuario_nombre,
            a.entidad,
            a.entidad_id,
            a.accion,
            a.antes,
            a.despues,
            a.fecha
     FROM auditoria a
     JOIN usuario u ON u.id = a.usuario_id
     ${donde}
     ORDER BY a.fecha DESC, a.id DESC
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
  );

  return { filas: rows, total: conteo.rows[0].total };
}
