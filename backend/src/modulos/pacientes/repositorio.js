import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

const CAMPOS_PACIENTE = `
  p.id,
  p.cliente_id,
  p.codigo_interno,
  p.nombre,
  p.especie_id,
  e.nombre AS especie_nombre,
  p.raza_id,
  r.nombre AS raza_nombre,
  p.sexo,
  p.castrado,
  to_char(p.fecha_castracion, 'YYYY-MM-DD') AS fecha_castracion,
  p.es_reproductor,
  to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
  p.nacimiento_aproximado,
  to_char(p.fecha_deceso, 'YYYY-MM-DD') AS fecha_deceso,
  p.origen,
  p.chip_codigo,
  p.color,
  p.comentario,
  p.provisorio,
  p.ficha_incompleta,
  p.foto_adjunto_id,
  p.creado_en,
  p.actualizado_en,
  p.creado_por,
  p.actualizado_por
`;

const JOIN_CATALOGOS = `
  JOIN especie e ON e.id = p.especie_id
  LEFT JOIN raza r ON r.id = p.raza_id
`;

export async function buscarPacientePorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PACIENTE}
     FROM paciente p
     ${JOIN_CATALOGOS}
     WHERE p.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarPacientes({ pagina, limite, clienteId, buscar }) {
  const condiciones = [];
  const parametros = [];

  if (clienteId) {
    parametros.push(clienteId);
    condiciones.push(`p.cliente_id = $${parametros.length}`);
  }

  if (buscar) {
    parametros.push(buscar);
    const n = parametros.length;
    condiciones.push(`(
      p.codigo_interno ILIKE '%' || $${n} || '%'
      OR fn_sin_tildes(p.nombre) LIKE '%' || fn_sin_tildes($${n}) || '%'
    )`);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total FROM paciente p ${donde}`,
    parametros,
  );

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PACIENTE}
     FROM paciente p
     ${JOIN_CATALOGOS}
     ${donde}
     ORDER BY p.nombre, p.id
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

// Lista completa de mascotas de un cliente, sin paginar, para la ficha.
export async function listarPorCliente(clienteId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PACIENTE}
     FROM paciente p
     ${JOIN_CATALOGOS}
     WHERE p.cliente_id = $1
     ORDER BY p.fecha_deceso NULLS FIRST, p.nombre, p.id`,
    [clienteId],
    cliente,
  );
  return rows;
}

export async function existeRazaDeEspecie(razaId, especieId, cliente) {
  const { rowCount } = await ejecutar(
    'SELECT 1 FROM raza WHERE id = $1 AND especie_id = $2',
    [razaId, especieId],
    cliente,
  );
  return rowCount > 0;
}

export async function crearPaciente(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO paciente (
       cliente_id, nombre, especie_id, raza_id, sexo, castrado, fecha_castracion,
       es_reproductor, fecha_nacimiento, nacimiento_aproximado, fecha_deceso,
       origen, chip_codigo, color, comentario, provisorio, ficha_incompleta,
       creado_por, actualizado_por
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7::date,
       $8, $9::date, $10, $11::date,
       $12, $13, $14, $15, $16, $17,
       $18, $18
     )
     RETURNING id`,
    [
      datos.clienteId,
      datos.nombre,
      datos.especieId,
      datos.razaId,
      datos.sexo,
      datos.castrado,
      datos.fechaCastracion,
      datos.esReproductor,
      datos.fechaNacimiento,
      datos.nacimientoAproximado,
      datos.fechaDeceso,
      datos.origen,
      datos.chipCodigo,
      datos.color,
      datos.comentario,
      datos.provisorio,
      datos.fichaIncompleta,
      ejecutorId,
    ],
    cliente,
  );

  return buscarPacientePorId(rows[0].id, cliente);
}

export async function actualizarPaciente(id, datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE paciente
     SET cliente_id = $2,
         nombre = $3,
         especie_id = $4,
         raza_id = $5,
         sexo = $6,
         castrado = $7,
         fecha_castracion = $8::date,
         es_reproductor = $9,
         fecha_nacimiento = $10::date,
         nacimiento_aproximado = $11,
         fecha_deceso = $12::date,
         origen = $13,
         chip_codigo = $14,
         color = $15,
         comentario = $16,
         provisorio = $17,
         ficha_incompleta = $18,
         actualizado_por = $19
     WHERE id = $1
     RETURNING id`,
    [
      id,
      datos.clienteId,
      datos.nombre,
      datos.especieId,
      datos.razaId,
      datos.sexo,
      datos.castrado,
      datos.fechaCastracion,
      datos.esReproductor,
      datos.fechaNacimiento,
      datos.nacimientoAproximado,
      datos.fechaDeceso,
      datos.origen,
      datos.chipCodigo,
      datos.color,
      datos.comentario,
      datos.provisorio,
      datos.fichaIncompleta,
      ejecutorId,
    ],
    cliente,
  );

  if (rows.length === 0) return null;

  return buscarPacientePorId(id, cliente);
}

// El veterinario completa la especie (y opcionalmente el nombre) al iniciar la
// visita de un paciente creado por alta rápida.
export async function completarProvisorio(id, { nombre, especieId }, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE paciente
     SET nombre = $2,
         especie_id = $3,
         raza_id = NULL,
         actualizado_por = $4
     WHERE id = $1
     RETURNING id`,
    [id, nombre, especieId, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarPacientePorId(id, cliente) : null;
}

export async function abrirHistorial(pacienteId, clienteId, ejecutorId, cliente) {
  await ejecutar(
    `INSERT INTO paciente_dueno_historial (
       paciente_id, cliente_id, desde, creado_por, actualizado_por
     )
     VALUES ($1, $2, current_date, $3, $3)`,
    [pacienteId, clienteId, ejecutorId],
    cliente,
  );
}

export async function cerrarHistorialActual(pacienteId, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE paciente_dueno_historial
     SET hasta = current_date, actualizado_por = $2
     WHERE paciente_id = $1 AND hasta IS NULL`,
    [pacienteId, ejecutorId],
    cliente,
  );
}

export async function listarHistorial(pacienteId, cliente) {
  const { rows } = await ejecutar(
    `SELECT h.id,
            h.cliente_id,
            c.nombre,
            c.apellido,
            to_char(h.desde, 'YYYY-MM-DD') AS desde,
            to_char(h.hasta, 'YYYY-MM-DD') AS hasta
     FROM paciente_dueno_historial h
     JOIN cliente c ON c.id = h.cliente_id
     WHERE h.paciente_id = $1
     ORDER BY h.desde DESC, h.id DESC`,
    [pacienteId],
    cliente,
  );
  return rows;
}
