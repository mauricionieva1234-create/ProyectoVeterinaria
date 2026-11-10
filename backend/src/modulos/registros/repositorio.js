import { obtenerPool } from '../../config/db.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

const COMUNES = `
  r.id,
  r.paciente_id,
  r.visita_id,
  r.anulado,
  r.motivo_anulacion,
  r.anulado_por,
  r.anulado_en,
  r.creado_en,
  r.actualizado_en
`;

// Cada tipo clínico tiene su tabla y sus columnas. Las listas de columnas son
// constantes del código, nunca vienen del usuario, por eso se pueden interpolar.
const DEFINICIONES = {
  vacuna: {
    tabla: 'registro_vacuna',
    seleccion: `${COMUNES},
      r.vacuna,
      r.lote,
      to_char(r.fecha_aplicacion, 'YYYY-MM-DD') AS fecha_aplicacion,
      to_char(r.fecha_proxima_dosis, 'YYYY-MM-DD') AS fecha_proxima_dosis,
      r.aplicada_por,
      ua.nombre_completo AS aplicada_por_nombre`,
    joins: 'LEFT JOIN usuario ua ON ua.id = r.aplicada_por',
    orden: 'r.fecha_aplicacion DESC, r.id DESC',
    insertables: [
      'paciente_id',
      'visita_id',
      'vacuna',
      'lote',
      'fecha_aplicacion',
      'fecha_proxima_dosis',
      'aplicada_por',
    ],
    actualizables: ['vacuna', 'lote', 'fecha_aplicacion', 'fecha_proxima_dosis', 'aplicada_por'],
  },
  antiparasitario: {
    tabla: 'registro_antiparasitario',
    seleccion: `${COMUNES},
      r.producto,
      r.tipo,
      r.dosis,
      to_char(r.fecha_aplicacion, 'YYYY-MM-DD') AS fecha_aplicacion,
      to_char(r.fecha_proxima, 'YYYY-MM-DD') AS fecha_proxima,
      r.aplicado_por,
      ua.nombre_completo AS aplicado_por_nombre`,
    joins: 'LEFT JOIN usuario ua ON ua.id = r.aplicado_por',
    orden: 'r.fecha_aplicacion DESC, r.id DESC',
    insertables: [
      'paciente_id',
      'visita_id',
      'producto',
      'tipo',
      'dosis',
      'fecha_aplicacion',
      'fecha_proxima',
      'aplicado_por',
    ],
    actualizables: [
      'producto',
      'tipo',
      'dosis',
      'fecha_aplicacion',
      'fecha_proxima',
      'aplicado_por',
    ],
  },
  estudio: {
    tabla: 'registro_estudio',
    seleccion: `${COMUNES},
      r.tipo_estudio,
      to_char(r.fecha_pedido, 'YYYY-MM-DD') AS fecha_pedido,
      r.estado,
      to_char(r.fecha_resultado, 'YYYY-MM-DD') AS fecha_resultado,
      r.resultado_resumen`,
    joins: '',
    orden: 'r.fecha_pedido DESC, r.id DESC',
    insertables: [
      'paciente_id',
      'visita_id',
      'tipo_estudio',
      'fecha_pedido',
      'estado',
      'fecha_resultado',
      'resultado_resumen',
    ],
    actualizables: [
      'tipo_estudio',
      'fecha_pedido',
      'estado',
      'fecha_resultado',
      'resultado_resumen',
    ],
  },
  cirugia: {
    tabla: 'registro_cirugia',
    seleccion: `${COMUNES},
      r.tipo_cirugia,
      to_char(r.fecha_programada, 'YYYY-MM-DD') AS fecha_programada,
      r.estado,
      r.indicaciones_previas,
      r.notas_postoperatorio,
      r.cirujano_id,
      uc.nombre_completo AS cirujano_nombre,
      r.visita_origen_id`,
    joins: 'LEFT JOIN usuario uc ON uc.id = r.cirujano_id',
    orden: 'r.fecha_programada DESC NULLS LAST, r.id DESC',
    insertables: [
      'paciente_id',
      'visita_id',
      'tipo_cirugia',
      'fecha_programada',
      'estado',
      'indicaciones_previas',
      'notas_postoperatorio',
      'cirujano_id',
      'visita_origen_id',
    ],
    actualizables: [
      'tipo_cirugia',
      'fecha_programada',
      'estado',
      'indicaciones_previas',
      'notas_postoperatorio',
      'cirujano_id',
    ],
  },
};

function definicion(tipo) {
  const def = DEFINICIONES[tipo];

  if (!def) {
    throw new Error(`Tipo de registro desconocido: ${tipo}`);
  }

  return def;
}

export function tipoValido(tipo) {
  return Boolean(DEFINICIONES[tipo]);
}

export async function listarRegistros(tipo, pacienteId, cliente) {
  const def = definicion(tipo);
  const { rows } = await ejecutar(
    `SELECT ${def.seleccion}
     FROM ${def.tabla} r
     ${def.joins}
     WHERE r.paciente_id = $1 AND r.anulado = false
     ORDER BY ${def.orden}`,
    [pacienteId],
    cliente,
  );
  return rows;
}

export async function buscarRegistro(tipo, id, cliente) {
  const def = definicion(tipo);
  const { rows } = await ejecutar(
    `SELECT ${def.seleccion}
     FROM ${def.tabla} r
     ${def.joins}
     WHERE r.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function crearRegistro(tipo, datos, ejecutorId, cliente) {
  const def = definicion(tipo);
  const columnas = def.insertables;
  const parametros = columnas.map((columna) => datos[columna] ?? null);
  const marcadores = columnas.map((_, indice) => `$${indice + 1}`);

  const { rows } = await ejecutar(
    `INSERT INTO ${def.tabla} (${columnas.join(', ')}, creado_por, actualizado_por)
     VALUES (${marcadores.join(', ')}, $${columnas.length + 1}, $${columnas.length + 1})
     RETURNING id`,
    [...parametros, ejecutorId],
    cliente,
  );

  return buscarRegistro(tipo, rows[0].id, cliente);
}

export async function actualizarRegistro(tipo, id, datos, ejecutorId, cliente) {
  const def = definicion(tipo);
  const columnas = def.actualizables;
  const parametros = columnas.map((columna) => datos[columna] ?? null);
  const asignaciones = columnas.map((columna, indice) => `${columna} = $${indice + 2}`);

  const { rows } = await ejecutar(
    `UPDATE ${def.tabla}
     SET ${asignaciones.join(', ')}, actualizado_por = $${columnas.length + 2}
     WHERE id = $1 AND anulado = false
     RETURNING id`,
    [id, ...parametros, ejecutorId],
    cliente,
  );

  return rows[0] ? buscarRegistro(tipo, id, cliente) : null;
}

export async function anularRegistro(tipo, id, motivo, ejecutorId, cliente) {
  const def = definicion(tipo);

  const { rows } = await ejecutar(
    `UPDATE ${def.tabla}
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

  return rows[0] ? buscarRegistro(tipo, id, cliente) : null;
}
