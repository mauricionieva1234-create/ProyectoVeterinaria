import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

const CAMPOS_VISITA = `
  v.id,
  v.paciente_id,
  v.ingreso_id,
  v.veterinario_id,
  uv.nombre_completo AS veterinario_nombre,
  v.inicio_en,
  v.cierre_en,
  v.estado,
  v.motivo_consulta,
  v.anamnesis,
  v.temperatura_c::float8 AS temperatura_c,
  v.peso_kg::float8 AS peso_kg,
  v.diagnostico,
  v.observaciones,
  v.anulado,
  v.motivo_anulacion,
  v.anulado_por,
  v.anulado_en,
  v.creado_en,
  v.actualizado_en,
  p.nombre AS paciente_nombre,
  p.codigo_interno,
  p.especie_id,
  p.provisorio,
  p.ficha_incompleta AS paciente_ficha_incompleta,
  e.nombre AS especie_nombre,
  c.id AS cliente_id,
  c.nombre AS cliente_nombre,
  c.apellido AS cliente_apellido,
  c.telefono_principal,
  c.ficha_incompleta AS cliente_ficha_incompleta,
  i.numero_orden AS ingreso_numero_orden,
  i.estado AS ingreso_estado,
  to_char(i.fecha_dia, 'YYYY-MM-DD') AS ingreso_fecha_dia,
  i.servicio AS ingreso_servicio
`;

const JOINS_VISITA = `
  JOIN paciente p ON p.id = v.paciente_id
  JOIN cliente c ON c.id = p.cliente_id
  JOIN especie e ON e.id = p.especie_id
  JOIN usuario uv ON uv.id = v.veterinario_id
  LEFT JOIN ingreso i ON i.id = v.ingreso_id
`;

const CAMPOS_MEDICACION = `
  m.id,
  m.visita_id,
  m.medicamento,
  m.dosis,
  m.via,
  m.frecuencia,
  m.duracion_dias,
  m.indicaciones,
  m.peso_referencia_kg::float8 AS peso_referencia_kg,
  m.anulado,
  m.motivo_anulacion,
  m.anulado_por,
  m.anulado_en,
  m.creado_en,
  m.actualizado_en
`;

export async function buscarVisitaPorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_VISITA}
     FROM visita v
     ${JOINS_VISITA}
     WHERE v.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function buscarVisitaActivaPorIngreso(ingresoId, cliente) {
  const { rows } = await ejecutar(
    `SELECT id
     FROM visita
     WHERE ingreso_id = $1 AND anulado = false
     LIMIT 1`,
    [ingresoId],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarVisitas(
  { pagina, limite, pacienteId, ingresoId, estado, desde, hasta },
  cliente,
) {
  const condiciones = ['v.anulado = false'];
  const parametros = [];

  if (pacienteId) {
    parametros.push(pacienteId);
    condiciones.push(`v.paciente_id = $${parametros.length}`);
  }

  if (ingresoId) {
    parametros.push(ingresoId);
    condiciones.push(`v.ingreso_id = $${parametros.length}`);
  }

  if (estado) {
    parametros.push(estado);
    condiciones.push(`v.estado = $${parametros.length}`);
  }

  if (desde) {
    parametros.push(desde);
    condiciones.push(`v.inicio_en >= $${parametros.length}::date`);
  }

  if (hasta) {
    parametros.push(hasta);
    condiciones.push(`v.inicio_en < ($${parametros.length}::date + interval '1 day')`);
  }

  const donde = `WHERE ${condiciones.join(' AND ')}`;

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total
     FROM visita v
     JOIN paciente p ON p.id = v.paciente_id
     ${donde}`,
    parametros,
    cliente,
  );

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_VISITA}
     FROM visita v
     ${JOINS_VISITA}
     ${donde}
     ORDER BY v.inicio_en DESC, v.id DESC
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
    cliente,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

export async function crearVisita(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO visita (
       paciente_id, ingreso_id, veterinario_id, inicio_en, estado, motivo_consulta,
       anamnesis, temperatura_c, peso_kg, diagnostico, observaciones,
       creado_por, actualizado_por
     )
     VALUES (
       $1, $2, $3, now(), 'borrador', $4,
       $5, $6, $7, $8, $9,
       $10, $10
     )
     RETURNING id`,
    [
      datos.pacienteId,
      datos.ingresoId,
      ejecutorId,
      datos.motivoConsulta,
      datos.anamnesis,
      datos.temperaturaC,
      datos.pesoKg,
      datos.diagnostico,
      datos.observaciones,
      ejecutorId,
    ],
    cliente,
  );

  return buscarVisitaPorId(rows[0].id, cliente);
}

export async function actualizarVisita(id, datos, estado, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE visita
     SET motivo_consulta = $2,
         anamnesis = $3,
         temperatura_c = $4,
         peso_kg = $5,
         diagnostico = $6,
         observaciones = $7,
         estado = $8,
         actualizado_por = $9
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [
      id,
      datos.motivoConsulta,
      datos.anamnesis,
      datos.temperaturaC,
      datos.pesoKg,
      datos.diagnostico,
      datos.observaciones,
      estado,
      ejecutorId,
    ],
    cliente,
  );

  return rows[0] ? buscarVisitaPorId(id, cliente) : null;
}

export async function cerrarVisita(id, motivoConsulta, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE visita
     SET estado = 'cerrada',
         cierre_en = now(),
         motivo_consulta = $2,
         actualizado_por = $3
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [id, motivoConsulta, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarVisitaPorId(id, cliente) : null;
}

export async function marcarVisitaCorregida(id, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE visita
     SET estado = 'corregida', actualizado_por = $2
     WHERE id = $1 AND estado = 'cerrada'`,
    [id, ejecutorId],
    cliente,
  );
}

export async function anularVisita(id, motivo, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE visita
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

  return rows[0] ? buscarVisitaPorId(id, cliente) : null;
}

export async function bloquearVisita(visitaId, cliente) {
  await ejecutar(
    'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
    [`visita:${visitaId}`],
    cliente,
  );
}

export async function siguienteNumeroVersion(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT coalesce(max(numero), 0) + 1 AS siguiente
     FROM visita_version
     WHERE visita_id = $1`,
    [visitaId],
    cliente,
  );
  return rows[0].siguiente;
}

export async function crearVersion(
  { visitaId, numero, contenido, motivoCambio, modificadoPor },
  cliente,
) {
  await ejecutar(
    `INSERT INTO visita_version (
       visita_id, numero, contenido, motivo_cambio, modificado_por,
       creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $5, $5)`,
    [visitaId, numero, contenido, motivoCambio, modificadoPor],
    cliente,
  );
}

export async function listarVersiones(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT vv.id,
            vv.visita_id,
            vv.numero,
            vv.contenido,
            vv.motivo_cambio,
            vv.modificado_por,
            u.nombre_completo AS modificado_por_nombre,
            vv.modificado_en
     FROM visita_version vv
     JOIN usuario u ON u.id = vv.modificado_por
     WHERE vv.visita_id = $1
     ORDER BY vv.numero DESC`,
    [visitaId],
    cliente,
  );
  return rows;
}

export async function crearNota({ visitaId, texto, autorId }, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO visita_nota (visita_id, texto, autor_id, creado_por, actualizado_por)
     VALUES ($1, $2, $3, $3, $3)
     RETURNING id`,
    [visitaId, texto, autorId],
    cliente,
  );

  const { rows: notas } = await ejecutar(
    `SELECT n.id,
            n.visita_id,
            n.texto,
            n.autor_id,
            u.nombre_completo AS autor_nombre,
            n.creado_en
     FROM visita_nota n
     JOIN usuario u ON u.id = n.autor_id
     WHERE n.id = $1`,
    [rows[0].id],
    cliente,
  );

  return notas[0];
}

export async function listarNotas(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT n.id,
            n.visita_id,
            n.texto,
            n.autor_id,
            u.nombre_completo AS autor_nombre,
            n.creado_en
     FROM visita_nota n
     JOIN usuario u ON u.id = n.autor_id
     WHERE n.visita_id = $1
     ORDER BY n.creado_en DESC, n.id DESC`,
    [visitaId],
    cliente,
  );
  return rows;
}

export async function buscarMedicacionPorId(id, visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_MEDICACION}
     FROM medicacion m
     WHERE m.id = $1 AND m.visita_id = $2`,
    [id, visitaId],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarMedicacion(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_MEDICACION}
     FROM medicacion m
     WHERE m.visita_id = $1 AND m.anulado = false
     ORDER BY m.id`,
    [visitaId],
    cliente,
  );
  return rows;
}

export async function crearMedicacion(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO medicacion (
       visita_id, medicamento, dosis, via, frecuencia, duracion_dias,
       indicaciones, peso_referencia_kg, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING id`,
    [
      datos.visitaId,
      datos.medicamento,
      datos.dosis,
      datos.via,
      datos.frecuencia,
      datos.duracionDias,
      datos.indicaciones,
      datos.pesoReferenciaKg,
      ejecutorId,
    ],
    cliente,
  );

  return buscarMedicacionPorId(rows[0].id, datos.visitaId, cliente);
}

export async function actualizarMedicacion(id, datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE medicacion
     SET medicamento = $2,
         dosis = $3,
         via = $4,
         frecuencia = $5,
         duracion_dias = $6,
         indicaciones = $7,
         peso_referencia_kg = $8,
         actualizado_por = $9
     WHERE id = $1 AND anulado = false
     RETURNING id, visita_id`,
    [
      id,
      datos.medicamento,
      datos.dosis,
      datos.via,
      datos.frecuencia,
      datos.duracionDias,
      datos.indicaciones,
      datos.pesoReferenciaKg,
      ejecutorId,
    ],
    cliente,
  );

  return rows[0] ? buscarMedicacionPorId(id, rows[0].visita_id, cliente) : null;
}

export async function anularMedicacion(id, motivo, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE medicacion
     SET anulado = true,
         motivo_anulacion = $2,
         anulado_por = $3,
         anulado_en = now(),
         actualizado_por = $3
     WHERE id = $1 AND anulado = false
     RETURNING id, visita_id`,
    [id, motivo, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarMedicacionPorId(id, rows[0].visita_id, cliente) : null;
}
