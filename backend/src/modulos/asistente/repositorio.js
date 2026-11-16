import { obtenerPool } from '../../config/db.js';

function ejecutar(consulta, parametros) {
  return obtenerPool().query(consulta, parametros);
}

const CAMPOS_PACIENTE_BUSQUEDA = `
  p.id,
  p.nombre,
  p.codigo_interno,
  p.provisorio,
  to_char(p.fecha_deceso, 'YYYY-MM-DD') AS fecha_deceso,
  e.nombre AS especie_nombre,
  c.id AS cliente_id,
  c.nombre AS cliente_nombre,
  c.apellido AS cliente_apellido,
  c.telefono_principal
`;

// Búsqueda de solo lectura por nombre o código. Nunca modifica ni audita nada.
export async function buscarPacientes(termino, limite = 10) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PACIENTE_BUSQUEDA}
     FROM paciente p
     JOIN especie e ON e.id = p.especie_id
     JOIN cliente c ON c.id = p.cliente_id
     WHERE c.fusionado_en_cliente_id IS NULL
       AND (
         p.codigo_interno ILIKE '%' || $1 || '%'
         OR fn_sin_tildes(p.nombre) LIKE '%' || fn_sin_tildes($1) || '%'
       )
     ORDER BY p.fecha_deceso NULLS FIRST, p.nombre, p.id
     LIMIT $2`,
    [termino, limite],
  );
  return rows;
}

const CAMPOS_CLIENTE_BUSQUEDA = `
  c.id,
  c.nombre,
  c.apellido,
  c.tipo_documento,
  c.nro_documento,
  c.telefono_principal,
  c.telefono_alternativo,
  c.email,
  c.localidad_barrio,
  c.ficha_incompleta,
  (SELECT count(*)::int FROM paciente p WHERE p.cliente_id = c.id) AS pacientes
`;

// Busca por nombre, apellido, documento o teléfono. El documento y el teléfono
// son datos personales: en las respuestas se muestra el documento enmascarado.
export async function buscarClientes(termino, limite = 10) {
  const digitos = String(termino ?? '').replace(/\D/g, '') || null;

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CLIENTE_BUSQUEDA}
     FROM cliente c
     WHERE c.fusionado_en_cliente_id IS NULL
       AND (
         c.nro_documento ILIKE '%' || $1 || '%'
         OR ($2::text IS NOT NULL
             AND regexp_replace(coalesce(c.telefono_principal, ''), '\\D', '', 'g')
                 LIKE '%' || $2 || '%')
         OR ($2::text IS NOT NULL
             AND regexp_replace(coalesce(c.telefono_alternativo, ''), '\\D', '', 'g')
                 LIKE '%' || $2 || '%')
         OR fn_sin_tildes(c.nombre) LIKE '%' || fn_sin_tildes($1) || '%'
         OR fn_sin_tildes(c.apellido) LIKE '%' || fn_sin_tildes($1) || '%'
         OR fn_sin_tildes(c.nombre || ' ' || c.apellido)
            LIKE '%' || fn_sin_tildes($1) || '%'
         OR fn_sin_tildes(c.apellido || ' ' || c.nombre)
            LIKE '%' || fn_sin_tildes($1) || '%'
       )
     ORDER BY c.apellido, c.nombre, c.id
     LIMIT $3`,
    [termino, digitos, limite],
  );
  return rows;
}

// Controles pendientes globales. Se consulta directo, sin pasar por el servicio
// de controles, porque ese servicio marca los vencidos como ausentes y audita.
// El asistente es de solo lectura: muestra el estado tal como está guardado.
export async function listarControlesPendientes({ desde = null, hasta = null } = {}) {
  const { rows } = await ejecutar(
    `SELECT c.id,
            to_char(c.fecha_control, 'YYYY-MM-DD') AS fecha_control,
            c.franja,
            c.motivo,
            c.estado,
            p.id AS paciente_id,
            p.nombre AS paciente_nombre,
            p.codigo_interno,
            e.nombre AS especie_nombre,
            cl.nombre AS cliente_nombre,
            cl.apellido AS cliente_apellido,
            cl.telefono_principal
     FROM control c
     JOIN paciente p ON p.id = c.paciente_id
     JOIN especie e ON e.id = p.especie_id
     JOIN cliente cl ON cl.id = p.cliente_id
     WHERE c.anulado = false
       AND c.estado = 'pendiente'
       AND ($1::date IS NULL OR c.fecha_control >= $1::date)
       AND ($2::date IS NULL OR c.fecha_control <= $2::date)
     ORDER BY c.fecha_control,
              CASE c.franja WHEN 'manana' THEN 1 WHEN 'tarde' THEN 2 ELSE 3 END,
              c.id
     LIMIT 50`,
    [desde, hasta],
  );
  return rows;
}
