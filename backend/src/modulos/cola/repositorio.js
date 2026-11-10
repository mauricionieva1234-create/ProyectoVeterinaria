import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Datos completos de un ingreso para la cola y la lista de revisión. La fecha
// del día se devuelve como texto para no cruzarla de zona horaria.
const CAMPOS_INGRESO = `
  i.id,
  i.paciente_id,
  to_char(i.fecha_dia, 'YYYY-MM-DD') AS fecha_dia,
  i.numero_orden,
  i.hora_llegada,
  i.servicio,
  i.prioridad,
  i.urgencia_estado,
  i.urgencia_confirmada_por,
  uc.nombre_completo AS urgencia_confirmada_por_nombre,
  i.urgencia_confirmada_en,
  i.hora_ingreso_consultorio,
  i.estado,
  i.comentario,
  i.creado_en,
  i.actualizado_en,
  p.nombre AS paciente_nombre,
  p.codigo_interno,
  p.provisorio,
  p.especie_id,
  e.nombre AS especie_nombre,
  p.raza_id,
  r.nombre AS raza_nombre,
  c.id AS cliente_id,
  c.nombre AS cliente_nombre,
  c.apellido AS cliente_apellido,
  c.telefono_principal,
  c.telefono_es_whatsapp
`;

const JOINS_INGRESO = `
  JOIN paciente p ON p.id = i.paciente_id
  JOIN cliente c ON c.id = p.cliente_id
  JOIN especie e ON e.id = p.especie_id
  LEFT JOIN raza r ON r.id = p.raza_id
  LEFT JOIN usuario uc ON uc.id = i.urgencia_confirmada_por
`;

export async function listarColaDelDia(fecha, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_INGRESO}
     FROM ingreso i
     ${JOINS_INGRESO}
     WHERE i.fecha_dia = $1::date
     ORDER BY CASE WHEN i.prioridad = 'urgente' THEN 0 ELSE 1 END,
              i.numero_orden ASC`,
    [fecha],
    cliente,
  );
  return rows;
}

export async function buscarIngresoPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_INGRESO}
     FROM ingreso i
     ${JOINS_INGRESO}
     WHERE i.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function buscarIngresoAbiertoDePaciente(pacienteId, fecha, cliente) {
  const { rows } = await ejecutar(
    `SELECT id
     FROM ingreso
     WHERE paciente_id = $1
       AND fecha_dia = $2::date
       AND estado IN ('esperando', 'en_consulta')
     LIMIT 1`,
    [pacienteId, fecha],
    cliente,
  );
  return rows[0] ?? null;
}

// Serializa la numeración del día. El lock se libera al terminar la
// transacción y evita que dos altas simultáneas reciban el mismo número.
export async function bloquearDia(fecha, cliente) {
  await ejecutar('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [`cola:${fecha}`], cliente);
}

export async function siguienteNumeroOrden(fecha, cliente) {
  const { rows } = await ejecutar(
    'SELECT coalesce(max(numero_orden), 0) + 1 AS siguiente FROM ingreso WHERE fecha_dia = $1::date',
    [fecha],
    cliente,
  );
  return rows[0].siguiente;
}

export async function crearIngreso(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO ingreso (
       paciente_id, fecha_dia, numero_orden, servicio, prioridad, urgencia_estado,
       urgencia_confirmada_por, urgencia_confirmada_en, estado, comentario,
       creado_por, actualizado_por
     )
     VALUES (
       $1, $2::date, $3, $4, $5, $6,
       $7, CASE WHEN $6 = 'confirmada' THEN now() ELSE NULL END,
       'esperando', $8, $9, $9
     )
     RETURNING id`,
    [
      datos.pacienteId,
      datos.fechaDia,
      datos.numeroOrden,
      datos.servicio,
      datos.prioridad,
      datos.urgenciaEstado,
      datos.urgenciaConfirmadaPor,
      datos.comentario,
      ejecutorId,
    ],
    cliente,
  );

  return buscarIngresoPorId(rows[0].id, cliente);
}

export async function marcarUrgenciaPosible(id, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE ingreso
     SET urgencia_estado = 'posible',
         prioridad = 'urgente',
         urgencia_confirmada_por = NULL,
         urgencia_confirmada_en = NULL,
         actualizado_por = $2
     WHERE id = $1
     RETURNING id`,
    [id, ejecutorId],
    cliente,
  );
  return rows[0] ? buscarIngresoPorId(id, cliente) : null;
}

export async function confirmarUrgencia(id, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE ingreso
     SET urgencia_estado = 'confirmada',
         prioridad = 'urgente',
         urgencia_confirmada_por = $2,
         urgencia_confirmada_en = now(),
         actualizado_por = $2
     WHERE id = $1
     RETURNING id`,
    [id, ejecutorId],
    cliente,
  );
  return rows[0] ? buscarIngresoPorId(id, cliente) : null;
}

export async function descartarUrgencia(id, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE ingreso
     SET urgencia_estado = 'descartada',
         prioridad = 'normal',
         urgencia_confirmada_por = NULL,
         urgencia_confirmada_en = NULL,
         actualizado_por = $2
     WHERE id = $1
     RETURNING id`,
    [id, ejecutorId],
    cliente,
  );
  return rows[0] ? buscarIngresoPorId(id, cliente) : null;
}

export async function marcarEnConsulta(id, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE ingreso
     SET estado = 'en_consulta',
         hora_ingreso_consultorio = now(),
         actualizado_por = $2
     WHERE id = $1
     RETURNING id`,
    [id, ejecutorId],
    cliente,
  );
  return rows[0] ? buscarIngresoPorId(id, cliente) : null;
}

export async function actualizarEstado(id, estado, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE ingreso
     SET estado = $2,
         actualizado_por = $3
     WHERE id = $1
     RETURNING id`,
    [id, estado, ejecutorId],
    cliente,
  );
  return rows[0] ? buscarIngresoPorId(id, cliente) : null;
}

// Ingresos de días anteriores que quedaron abiertos. Se leen antes de
// actualizarlos para poder auditar el estado anterior de cada uno.
export async function listarAbiertosAnteriores(hoy, cliente) {
  const { rows } = await ejecutar(
    `SELECT id, estado
     FROM ingreso
     WHERE fecha_dia < $1::date
       AND estado IN ('esperando', 'en_consulta')
     ORDER BY fecha_dia, numero_orden`,
    [hoy],
    cliente,
  );
  return rows;
}

export async function marcarSinCerrar(ids, ejecutorId, cliente) {
  if (ids.length === 0) return;

  await ejecutar(
    `UPDATE ingreso
     SET estado = 'sin_cerrar',
         actualizado_por = $2
     WHERE id = ANY($1::bigint[])`,
    [ids, ejecutorId],
    cliente,
  );
}

export async function listarSinCerrar({ pagina, limite }, cliente) {
  const conteo = await ejecutar(
    "SELECT count(*)::int AS total FROM ingreso WHERE estado = 'sin_cerrar'",
    [],
    cliente,
  );

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_INGRESO}
     FROM ingreso i
     ${JOINS_INGRESO}
     WHERE i.estado = 'sin_cerrar'
     ORDER BY i.fecha_dia DESC, i.numero_orden ASC
     LIMIT $1 OFFSET $2`,
    [limite, calcularDesplazamiento(pagina, limite)],
    cliente,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

// Especie usada por los pacientes provisorios del alta rápida. El veterinario
// la corrige al iniciar la visita en la fase 4.
export async function buscarEspecieProvisoria(cliente) {
  const { rows } = await ejecutar(
    `SELECT id, nombre
     FROM especie
     WHERE lower(fn_sin_tildes(nombre)) = lower(fn_sin_tildes('otro'))
     LIMIT 1`,
    [],
    cliente,
  );
  return rows[0] ?? null;
}
