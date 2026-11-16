import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Columnas comunes. Las fechas se devuelven como texto para que el frontend las
// use directo en los inputs sin cruzar zonas horarias.
const CAMPOS_CLIENTE = `
  c.id,
  c.nombre,
  c.apellido,
  c.tipo_documento,
  c.nro_documento,
  c.telefono_principal,
  c.telefono_es_whatsapp,
  c.telefono_alternativo,
  c.email,
  c.calle_numero,
  c.localidad_barrio,
  c.provincia,
  c.pais,
  c.acepta_correo,
  c.acepta_whatsapp,
  to_char(c.fecha_consentimiento, 'YYYY-MM-DD') AS fecha_consentimiento,
  c.observaciones,
  c.alta_rapida,
  c.ficha_incompleta,
  c.fusionado_en_cliente_id,
  c.creado_en,
  c.actualizado_en,
  c.creado_por,
  c.actualizado_por
`;

const CONTEO_PACIENTES = `
  (SELECT count(*)::int FROM paciente p WHERE p.cliente_id = c.id) AS pacientes
`;

// Los clientes fusionados no se listan: su historial vive en el cliente que se
// conservó.
function armarFiltros({ buscar, soloIncompletas }) {
  const condiciones = ['c.fusionado_en_cliente_id IS NULL'];
  const parametros = [];

  if (soloIncompletas) {
    condiciones.push('c.ficha_incompleta = true');
  }

  // La búsqueda acepta «nombre apellido», «apellido, nombre» o cualquier orden,
  // porque en el listado el cliente se ve como «apellido, nombre». Cada palabra
  // tiene que aparecer en alguno de los campos buscables del mismo cliente.
  const palabras = String(buscar ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 5);

  for (const palabra of palabras) {
    parametros.push(palabra);
    const n = parametros.length;

    condiciones.push(`(
      c.nro_documento ILIKE '%' || $${n} || '%'
      OR coalesce(c.telefono_principal, '') ILIKE '%' || $${n} || '%'
      OR coalesce(c.telefono_alternativo, '') ILIKE '%' || $${n} || '%'
      OR fn_sin_tildes(c.nombre) LIKE '%' || fn_sin_tildes($${n}) || '%'
      OR fn_sin_tildes(c.apellido) LIKE '%' || fn_sin_tildes($${n}) || '%'
    )`);
  }

  return { donde: `WHERE ${condiciones.join(' AND ')}`, parametros };
}

export async function listarClientes({ pagina, limite, buscar, soloIncompletas }) {
  const { donde, parametros } = armarFiltros({ buscar, soloIncompletas });

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total FROM cliente c ${donde}`,
    parametros,
  );

  const parametrosDatos = [...parametros, limite, calcularDesplazamiento(pagina, limite)];
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CLIENTE}, ${CONTEO_PACIENTES}
     FROM cliente c
     ${donde}
     ORDER BY c.apellido, c.nombre, c.id
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosDatos,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

// Búsqueda previa obligatoria antes de crear un cliente.
export async function buscarClientesPrevios({ documento, telefono }, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CLIENTE}, ${CONTEO_PACIENTES}
     FROM cliente c
     WHERE c.fusionado_en_cliente_id IS NULL
       AND (
         ($1::text IS NOT NULL AND c.nro_documento = $1)
         OR (
           $2::text IS NOT NULL
           AND (
             regexp_replace(coalesce(c.telefono_principal, ''), '\\D', '', 'g') = $2
             OR regexp_replace(coalesce(c.telefono_alternativo, ''), '\\D', '', 'g') = $2
           )
         )
       )
     ORDER BY c.apellido, c.nombre, c.id
     LIMIT 20`,
    [documento ?? null, telefono ?? null],
    cliente,
  );

  return rows;
}

export async function existeDocumento(documento, cliente) {
  const { rowCount } = await ejecutar(
    `SELECT 1 FROM cliente
     WHERE nro_documento = $1 AND fusionado_en_cliente_id IS NULL
     LIMIT 1`,
    [documento],
    cliente,
  );
  return rowCount > 0;
}

export async function buscarClientePorId(id, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CLIENTE}, ${CONTEO_PACIENTES}
     FROM cliente c
     WHERE c.id = $1`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function crearCliente(datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO cliente (
       nombre, apellido, tipo_documento, nro_documento,
       telefono_principal, telefono_es_whatsapp, telefono_alternativo, email,
       calle_numero, localidad_barrio, provincia, pais,
       acepta_correo, acepta_whatsapp, fecha_consentimiento, observaciones,
       alta_rapida, ficha_incompleta, creado_por, actualizado_por
     )
     VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12,
       $13, $14, $15::date, $16,
       $17, $18, $19, $19
     )
     RETURNING id`,
    [
      datos.nombre,
      datos.apellido,
      datos.tipoDocumento,
      datos.nroDocumento,
      datos.telefonoPrincipal,
      datos.telefonoEsWhatsapp,
      datos.telefonoAlternativo,
      datos.email,
      datos.calleNumero,
      datos.localidadBarrio,
      datos.provincia,
      datos.pais,
      datos.aceptaCorreo,
      datos.aceptaWhatsapp,
      datos.fechaConsentimiento,
      datos.observaciones,
      datos.altaRapida ?? false,
      datos.fichaIncompleta,
      ejecutorId,
    ],
    cliente,
  );

  return buscarClientePorId(rows[0].id, cliente);
}

export async function actualizarCliente(id, datos, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE cliente
     SET nombre = $2,
         apellido = $3,
         tipo_documento = $4,
         nro_documento = $5,
         telefono_principal = $6,
         telefono_es_whatsapp = $7,
         telefono_alternativo = $8,
         email = $9,
         calle_numero = $10,
         localidad_barrio = $11,
         provincia = $12,
         pais = $13,
         acepta_correo = $14,
         acepta_whatsapp = $15,
         fecha_consentimiento = $16::date,
         observaciones = $17,
         ficha_incompleta = $18,
         actualizado_por = $19
     WHERE id = $1
     RETURNING id`,
    [
      id,
      datos.nombre,
      datos.apellido,
      datos.tipoDocumento,
      datos.nroDocumento,
      datos.telefonoPrincipal,
      datos.telefonoEsWhatsapp,
      datos.telefonoAlternativo,
      datos.email,
      datos.calleNumero,
      datos.localidadBarrio,
      datos.provincia,
      datos.pais,
      datos.aceptaCorreo,
      datos.aceptaWhatsapp,
      datos.fechaConsentimiento,
      datos.observaciones,
      datos.fichaIncompleta,
      ejecutorId,
    ],
    cliente,
  );

  if (rows.length === 0) return null;

  return buscarClientePorId(id, cliente);
}

export async function listarFichasIncompletas({ pagina, limite }) {
  const conteo = await ejecutar(
    `SELECT count(*)::int AS total
     FROM cliente c
     WHERE c.fusionado_en_cliente_id IS NULL AND c.ficha_incompleta = true`,
  );

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_CLIENTE}, ${CONTEO_PACIENTES}, u.nombre_completo AS creado_por_nombre
     FROM cliente c
     LEFT JOIN usuario u ON u.id = c.creado_por
     WHERE c.fusionado_en_cliente_id IS NULL AND c.ficha_incompleta = true
     ORDER BY c.creado_en DESC, c.id DESC
     LIMIT $1 OFFSET $2`,
    [limite, calcularDesplazamiento(pagina, limite)],
  );

  return { filas: rows, total: conteo.rows[0].total };
}

export async function moverPacientes(clienteOrigenId, clienteDestinoId, ejecutorId, cliente) {
  const { rowCount } = await ejecutar(
    `UPDATE paciente
     SET cliente_id = $2, actualizado_por = $3
     WHERE cliente_id = $1`,
    [clienteOrigenId, clienteDestinoId, ejecutorId],
    cliente,
  );
  return rowCount;
}

export async function cerrarHistorialDeCliente(clienteId, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE paciente_dueno_historial
     SET hasta = current_date, actualizado_por = $2
     WHERE cliente_id = $1 AND hasta IS NULL`,
    [clienteId, ejecutorId],
    cliente,
  );
}

export async function abrirHistorialDeCliente(clienteId, ejecutorId, cliente) {
  await ejecutar(
    `INSERT INTO paciente_dueno_historial (
       paciente_id, cliente_id, desde, creado_por, actualizado_por
     )
     SELECT p.id, $1, current_date, $2, $2
     FROM paciente p
     WHERE p.cliente_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM paciente_dueno_historial h
         WHERE h.paciente_id = p.id AND h.hasta IS NULL
       )`,
    [clienteId, ejecutorId],
    cliente,
  );
}

export async function marcarFusionado(id, conservadoId, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `UPDATE cliente
     SET fusionado_en_cliente_id = $2, actualizado_por = $3
     WHERE id = $1
     RETURNING id`,
    [id, conservadoId, ejecutorId],
    cliente,
  );
  return rows[0] ?? null;
}
