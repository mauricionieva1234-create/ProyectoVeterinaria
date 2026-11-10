import { obtenerPool } from '../../config/db.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

const CAMPOS_ADJUNTO = `
  a.id,
  a.paciente_id,
  a.visita_id,
  a.estudio_id,
  a.nombre_original,
  a.tipo_mime,
  a.tamano_bytes,
  a.ruta_almacenamiento,
  a.subido_por,
  us.nombre_completo AS subido_por_nombre,
  a.anulado,
  a.motivo_anulacion,
  a.anulado_por,
  a.anulado_en,
  a.creado_en,
  a.actualizado_en
`;

export async function buscarAdjuntoPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_ADJUNTO}
     FROM archivo_adjunto a
     LEFT JOIN usuario us ON us.id = a.subido_por
     WHERE a.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarAdjuntos({ pacienteId, visitaId, estudioId }, cliente) {
  const condiciones = ['a.anulado = false'];
  const parametros = [];

  if (pacienteId) {
    parametros.push(pacienteId);
    condiciones.push(`a.paciente_id = $${parametros.length}`);
  }

  if (visitaId) {
    parametros.push(visitaId);
    condiciones.push(`a.visita_id = $${parametros.length}`);
  }

  if (estudioId) {
    parametros.push(estudioId);
    condiciones.push(`a.estudio_id = $${parametros.length}`);
  }

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_ADJUNTO}
     FROM archivo_adjunto a
     LEFT JOIN usuario us ON us.id = a.subido_por
     WHERE ${condiciones.join(' AND ')}
     ORDER BY a.creado_en DESC, a.id DESC`,
    parametros,
    cliente,
  );

  return rows;
}

export async function crearAdjunto(datos, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO archivo_adjunto (
       paciente_id, visita_id, estudio_id, nombre_original, tipo_mime,
       tamano_bytes, ruta_almacenamiento, subido_por, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
     RETURNING id`,
    [
      datos.pacienteId,
      datos.visitaId,
      datos.estudioId,
      datos.nombreOriginal,
      datos.tipoMime,
      datos.tamanoBytes,
      datos.rutaAlmacenamiento,
      datos.subidoPor,
    ],
    cliente,
  );

  return buscarAdjuntoPorId(rows[0].id, cliente);
}

export async function anularAdjunto(id, motivo, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE archivo_adjunto
     SET anulado = true,
         motivo_anulacion = $2,
         anulado_por = $3,
         anulado_en = now(),
         actualizado_por = $3
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [id, motivo, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarAdjuntoPorId(id, cliente) : null;
}

export async function asignarFotoPaciente(pacienteId, adjuntoId, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE paciente
     SET foto_adjunto_id = $2, actualizado_por = $3
     WHERE id = $1`,
    [pacienteId, adjuntoId, ejecutorId],
    cliente,
  );
}

export async function quitarFotoPaciente(pacienteId, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE paciente
     SET foto_adjunto_id = NULL, actualizado_por = $2
     WHERE id = $1`,
    [pacienteId, ejecutorId],
    cliente,
  );
}

// Si el adjunto anulado era la foto vigente, la ficha deja de mostrarla.
export async function limpiarFotoSiCorresponde(adjuntoId, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE paciente
     SET foto_adjunto_id = NULL, actualizado_por = $2
     WHERE foto_adjunto_id = $1`,
    [adjuntoId, ejecutorId],
    cliente,
  );
}
