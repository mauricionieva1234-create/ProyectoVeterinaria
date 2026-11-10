import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Último aviso vigente del control, para mostrarlo en las listas sin traer todo
// el historial.
const ULTIMO_AVISO = `
  LEFT JOIN LATERAL (
    SELECT a.canal, a.resultado, a.nota, a.realizado_en, a.realizado_por,
           ua.nombre_completo AS realizado_por_nombre
    FROM aviso_control a
    JOIN usuario ua ON ua.id = a.realizado_por
    WHERE a.control_id = c.id AND a.anulado = false
    ORDER BY a.realizado_en DESC, a.id DESC
    LIMIT 1
  ) ult ON true
`;

const CAMPOS_CONTROL = `
  c.id,
  c.paciente_id,
  c.visita_origen_id,
  to_char(c.fecha_control, 'YYYY-MM-DD') AS fecha_control,
  c.franja,
  c.motivo,
  c.estado,
  c.control_nuevo_id,
  c.visita_realizada_id,
  c.anulado,
  c.motivo_anulacion,
  c.anulado_por,
  c.anulado_en,
  c.creado_en,
  c.actualizado_en,
  p.nombre AS paciente_nombre,
  p.codigo_interno,
  p.especie_id,
  e.nombre AS especie_nombre,
  cl.id AS cliente_id,
  cl.nombre AS cliente_nombre,
  cl.apellido AS cliente_apellido,
  cl.telefono_principal,
  cl.ficha_incompleta AS cliente_ficha_incompleta,
  ult.canal AS ultimo_aviso_canal,
  ult.resultado AS ultimo_aviso_resultado,
  ult.nota AS ultimo_aviso_nota,
  ult.realizado_en AS ultimo_aviso_en,
  ult.realizado_por AS ultimo_aviso_por,
  ult.realizado_por_nombre AS ultimo_aviso_por_nombre
`;

const JOINS_CONTROL = `
  JOIN paciente p ON p.id = c.paciente_id
  JOIN especie e ON e.id = p.especie_id
  JOIN cliente cl ON cl.id = p.cliente_id
  ${ULTIMO_AVISO}
`;

const CAMPOS_AVISO = `
  a.id,
  a.control_id,
  a.canal,
  a.resultado,
  a.nota,
  a.realizado_por,
  u.nombre_completo AS realizado_por_nombre,
  a.realizado_en,
  a.anulado,
  a.motivo_anulacion,
  a.anulado_por,
  a.anulado_en,
  a.creado_en
`;

export async function buscarControlPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CONTROL}
     FROM control c
     ${JOINS_CONTROL}
     WHERE c.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarControles(
  { pagina, limite, estado, pacienteId, franja, desde, hasta },
  cliente,
) {
  const condiciones = ['c.anulado = false'];
  const parametros = [];

  if (estado) {
    parametros.push(estado);
    condiciones.push(`c.estado = $${parametros.length}`);
  }

  if (pacienteId) {
    parametros.push(pacienteId);
    condiciones.push(`c.paciente_id = $${parametros.length}`);
  }

  if (franja) {
    parametros.push(franja);
    condiciones.push(`c.franja = $${parametros.length}`);
  }

  if (desde) {
    parametros.push(desde);
    condiciones.push(`c.fecha_control >= $${parametros.length}::date`);
  }

  if (hasta) {
    parametros.push(hasta);
    condiciones.push(`c.fecha_control <= $${parametros.length}::date`);
  }

  const donde = `WHERE ${condiciones.join(' AND ')}`;

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total FROM control c ${donde}`,
    parametros,
    cliente,
  );

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CONTROL}
     FROM control c
     ${JOINS_CONTROL}
     ${donde}
     ORDER BY c.fecha_control DESC, c.id DESC
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
    cliente,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

export async function listarRecordatorios(hoy, manana, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CONTROL}
     FROM control c
     ${JOINS_CONTROL}
     WHERE c.anulado = false
       AND c.estado = 'pendiente'
       AND c.fecha_control IN ($1::date, $2::date)
     ORDER BY c.fecha_control,
              CASE c.franja WHEN 'manana' THEN 1 WHEN 'tarde' THEN 2 ELSE 3 END,
              c.id`,
    [hoy, manana],
    cliente,
  );
  return rows;
}

// Cierre diferido: los pendientes de días anteriores quedan ausentes al
// consultar las listas. Se bloquean para que dos consultas simultáneas no
// auditen el mismo cambio.
export async function listarVencidos(hoy, cliente) {
  const { rows } = await ejecutar(
    `SELECT id
     FROM control
     WHERE estado = 'pendiente' AND fecha_control < $1::date AND anulado = false
     FOR UPDATE`,
    [hoy],
    cliente,
  );
  return rows.map((fila) => fila.id);
}

export async function marcarAusentes(ids, ejecutorId, cliente) {
  if (ids.length === 0) return;

  await ejecutar(
    `UPDATE control
     SET estado = 'ausente', actualizado_por = $2
     WHERE id = ANY($1::bigint[]) AND estado = 'pendiente' AND anulado = false`,
    [ids, ejecutorId],
    cliente,
  );
}

export async function crearControl(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO control (
       paciente_id, visita_origen_id, fecha_control, franja, motivo, estado,
       creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, $6)
     RETURNING id`,
    [
      datos.pacienteId,
      datos.visitaOrigenId,
      datos.fechaControl,
      datos.franja,
      datos.motivo,
      ejecutorId,
    ],
    cliente,
  );

  return buscarControlPorId(rows[0].id, cliente);
}

export async function marcarReprogramado(id, controlNuevoId, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE control
     SET estado = 'reprogramado',
         control_nuevo_id = $2,
         actualizado_por = $3
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [id, controlNuevoId, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarControlPorId(id, cliente) : null;
}

export async function actualizarEstado(id, estado, visitaRealizadaId, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE control
     SET estado = $2,
         visita_realizada_id = $3,
         actualizado_por = $4
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [id, estado, visitaRealizadaId, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarControlPorId(id, cliente) : null;
}

export async function anularControl(id, motivo, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE control
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

  return rows[0] ? buscarControlPorId(id, cliente) : null;
}

export async function listarAvisos(controlId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_AVISO}
     FROM aviso_control a
     JOIN usuario u ON u.id = a.realizado_por
     WHERE a.control_id = $1
     ORDER BY a.realizado_en DESC, a.id DESC`,
    [controlId],
    cliente,
  );
  return rows;
}

export async function buscarAvisoPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_AVISO}
     FROM aviso_control a
     JOIN usuario u ON u.id = a.realizado_por
     WHERE a.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function crearAviso(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO aviso_control (
       control_id, canal, resultado, nota, realizado_por,
       creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $5, $5)
     RETURNING id`,
    [datos.controlId, datos.canal, datos.resultado, datos.nota, ejecutorId],
    cliente,
  );

  return buscarAvisoPorId(rows[0].id, cliente);
}
