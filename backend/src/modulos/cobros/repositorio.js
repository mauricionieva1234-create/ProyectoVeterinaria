import { obtenerPool } from '../../config/db.js';
import { calcularDesplazamiento } from '../../utils/paginacion.js';

function ejecutar(consulta, parametros, cliente) {
  return (cliente ?? obtenerPool()).query(consulta, parametros);
}

// Datos del cobro con el paciente, la visita y el saldo calculado en SQL. El
// saldo nunca se guarda: surge de los pagos activos para que no se desincronice.
const CAMPOS_COBRO = `
  c.id,
  c.visita_id,
  c.total,
  c.estado,
  c.observaciones,
  c.anulado,
  c.motivo_anulacion,
  c.anulado_en,
  c.creado_en,
  c.actualizado_en,
  v.estado AS visita_estado,
  v.anulado AS visita_anulado,
  v.ingreso_id AS visita_ingreso_id,
  v.inicio_en AS visita_inicio_en,
  v.cierre_en AS visita_cierre_en,
  i.estado AS ingreso_estado,
  to_char(i.fecha_dia, 'YYYY-MM-DD') AS ingreso_fecha,
  i.numero_orden AS ingreso_numero_orden,
  i.servicio AS ingreso_servicio,
  p.id AS paciente_id,
  p.nombre AS paciente_nombre,
  p.codigo_interno,
  e.nombre AS especie_nombre,
  cl.id AS cliente_id,
  cl.nombre AS cliente_nombre,
  cl.apellido AS cliente_apellido,
  cl.telefono_principal,
  coalesce(pg.pagado, 0) AS pagado,
  coalesce(pg.cantidad_pagos, 0) AS cantidad_pagos,
  (c.total - coalesce(pg.pagado, 0)) AS saldo
`;

const JOINS_COBRO = `
  JOIN visita v ON v.id = c.visita_id
  JOIN paciente p ON p.id = v.paciente_id
  JOIN cliente cl ON cl.id = p.cliente_id
  JOIN especie e ON e.id = p.especie_id
  LEFT JOIN ingreso i ON i.id = v.ingreso_id
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(monto), 0) AS pagado, count(*)::int AS cantidad_pagos
    FROM pago
    WHERE cobro_id = c.id AND anulado = false
  ) pg ON true
`;

const CAMPOS_PAGO = `
  pg.id,
  pg.cobro_id,
  pg.medio,
  pg.monto,
  pg.fecha,
  pg.registrado_por,
  pg.anulado,
  pg.motivo_anulacion,
  pg.anulado_en,
  u.nombre_completo AS registrado_por_nombre,
  ua.nombre_completo AS anulado_por_nombre
`;

// Bloquea la visita mientras se crea el cobro para que dos cajas no generen
// dos cobros activos al mismo tiempo.
export async function buscarVisitaParaCobro(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT
       v.id,
       v.paciente_id,
       v.estado,
       v.anulado,
       v.ingreso_id,
       v.cierre_en,
       i.estado AS ingreso_estado
     FROM visita v
     LEFT JOIN ingreso i ON i.id = v.ingreso_id
     WHERE v.id = $1
     FOR UPDATE OF v`,
    [visitaId],
    cliente,
  );
  return rows[0] ?? null;
}

export async function buscarCobroActivoPorVisita(visitaId, cliente) {
  const { rows } = await ejecutar(
    `SELECT id
     FROM cobro
     WHERE visita_id = $1 AND anulado = false
     LIMIT 1`,
    [visitaId],
    cliente,
  );
  return rows[0] ?? null;
}

export async function buscarCobroPorId(id, cliente, { bloquear = false } = {}) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_COBRO}
     FROM cobro c
     ${JOINS_COBRO}
     WHERE c.id = $1
     ${bloquear ? 'FOR UPDATE OF c' : ''}`,
    [id],
    cliente,
  );
  return rows[0] ?? null;
}

export async function listarCobros(
  { pagina, limite, estado, pacienteId, desde, hasta },
  zona,
  cliente,
) {
  // La zona se agrega solo cuando hay un filtro de fecha: PostgreSQL rechaza
  // parámetros que no se usan en la consulta.
  const parametros = [];
  const condiciones = ['c.anulado = false'];

  if (estado) {
    parametros.push(estado);
    condiciones.push(`c.estado = $${parametros.length}`);
  }

  if (pacienteId) {
    parametros.push(pacienteId);
    condiciones.push(`v.paciente_id = $${parametros.length}`);
  }

  if (desde) {
    parametros.push(zona);
    const zonaDesde = `$${parametros.length}`;
    parametros.push(desde);
    condiciones.push(
      `(c.creado_en AT TIME ZONE ${zonaDesde})::date >= $${parametros.length}::date`,
    );
  }

  if (hasta) {
    parametros.push(zona);
    const zonaHasta = `$${parametros.length}`;
    parametros.push(hasta);
    condiciones.push(
      `(c.creado_en AT TIME ZONE ${zonaHasta})::date <= $${parametros.length}::date`,
    );
  }

  const donde = condiciones.join(' AND ');

  const conteo = await ejecutar(
    `SELECT count(*)::int AS total
     FROM cobro c
     JOIN visita v ON v.id = c.visita_id
     WHERE ${donde}`,
    parametros,
    cliente,
  );

  const limiteParametro = parametros.length + 1;
  const desplazamientoParametro = parametros.length + 2;

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_COBRO}
     FROM cobro c
     ${JOINS_COBRO}
     WHERE ${donde}
     ORDER BY c.creado_en DESC, c.id DESC
     LIMIT $${limiteParametro} OFFSET $${desplazamientoParametro}`,
    [...parametros, limite, calcularDesplazamiento(pagina, limite)],
    cliente,
  );

  return { filas: rows, total: conteo.rows[0].total };
}

// Deudas: cobros activos con saldo, sin importar la fecha. Se ordenan del más
// viejo al más nuevo para que la caja vea primero lo que lleva más tiempo.
export async function listarDeudas({ pagina, limite }, cliente) {
  const cuenta = await ejecutar(
    `SELECT count(*)::int AS total
     FROM cobro c
     LEFT JOIN LATERAL (
       SELECT coalesce(sum(monto), 0) AS pagado
       FROM pago
       WHERE cobro_id = c.id AND anulado = false
     ) pg ON true
     WHERE c.anulado = false
       AND (c.total - coalesce(pg.pagado, 0)) > 0`,
    [],
    cliente,
  );

  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_COBRO}
     FROM cobro c
     ${JOINS_COBRO}
     WHERE c.anulado = false
       AND (c.total - coalesce(pg.pagado, 0)) > 0
     ORDER BY c.creado_en ASC, c.id ASC
     LIMIT $1 OFFSET $2`,
    [limite, calcularDesplazamiento(pagina, limite)],
    cliente,
  );

  return { filas: rows, total: cuenta.rows[0].total };
}

// Visitas que todavía no tienen cobro activo. Incluye los ingresos que la
// visita cerró en esperando_cobro y las visitas cerradas sin ingreso de los
// últimos 30 días (por ejemplo, las creadas desde la ficha del paciente).
export async function listarPendientes(cliente) {
  const { rows } = await ejecutar(
    `SELECT
       'ingreso'::text AS origen,
       i.id AS ingreso_id,
       to_char(i.fecha_dia, 'YYYY-MM-DD') AS ingreso_fecha,
       i.numero_orden,
       i.servicio,
       i.estado AS ingreso_estado,
       i.hora_llegada,
       v.id AS visita_id,
       v.estado AS visita_estado,
       v.cierre_en,
       p.id AS paciente_id,
       p.nombre AS paciente_nombre,
       p.codigo_interno,
       e.nombre AS especie_nombre,
       cl.id AS cliente_id,
       cl.nombre AS cliente_nombre,
       cl.apellido AS cliente_apellido,
       cl.telefono_principal
     FROM ingreso i
     JOIN paciente p ON p.id = i.paciente_id
     JOIN cliente cl ON cl.id = p.cliente_id
     JOIN especie e ON e.id = p.especie_id
     LEFT JOIN visita v ON v.ingreso_id = i.id AND v.anulado = false
     LEFT JOIN cobro cb ON cb.visita_id = v.id AND cb.anulado = false
     WHERE i.estado = 'esperando_cobro'
       AND cb.id IS NULL

     UNION ALL

     SELECT
       'visita'::text AS origen,
       NULL::bigint AS ingreso_id,
       NULL::text AS ingreso_fecha,
       NULL::integer AS numero_orden,
       NULL::text AS servicio,
       NULL::text AS ingreso_estado,
       NULL::timestamptz AS hora_llegada,
       v.id AS visita_id,
       v.estado AS visita_estado,
       v.cierre_en,
       p.id AS paciente_id,
       p.nombre AS paciente_nombre,
       p.codigo_interno,
       e.nombre AS especie_nombre,
       cl.id AS cliente_id,
       cl.nombre AS cliente_nombre,
       cl.apellido AS cliente_apellido,
       cl.telefono_principal
     FROM visita v
     JOIN paciente p ON p.id = v.paciente_id
     JOIN cliente cl ON cl.id = p.cliente_id
     JOIN especie e ON e.id = p.especie_id
     LEFT JOIN cobro cb ON cb.visita_id = v.id AND cb.anulado = false
     WHERE v.ingreso_id IS NULL
       AND v.anulado = false
       AND v.estado IN ('cerrada', 'corregida')
       AND v.cierre_en >= now() - interval '30 days'
       AND cb.id IS NULL

     ORDER BY cierre_en ASC NULLS LAST, visita_id ASC`,
    [],
    cliente,
  );

  return rows;
}

export async function crearCobro({ visitaId, total, estado, observaciones }, ejecutorId, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO cobro (
       visita_id, total, estado, observaciones, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING id`,
    [visitaId, total, estado, observaciones, ejecutorId],
    cliente,
  );
  return rows[0].id;
}

export async function actualizarCobro(id, { total, estado, observaciones }, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE cobro
     SET total = $2,
         estado = $3,
         observaciones = $4,
         actualizado_por = $5
     WHERE id = $1 AND anulado = false`,
    [id, total, estado, observaciones, ejecutorId],
    cliente,
  );
}

export async function anularCobro(id, motivo, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE cobro
     SET anulado = true,
         motivo_anulacion = $2,
         anulado_por = $3,
         anulado_en = now(),
         actualizado_por = $3
     WHERE id = $1 AND anulado = false`,
    [id, motivo, ejecutorId],
    cliente,
  );
}

export async function sumarPagosActivos(cobroId, cliente) {
  const { rows } = await ejecutar(
    `SELECT
       coalesce(sum(monto), 0) AS pagado,
       count(*)::int AS cantidad
     FROM pago
     WHERE cobro_id = $1 AND anulado = false`,
    [cobroId],
    cliente,
  );
  return rows[0];
}

export async function actualizarEstadoCobro(id, estado, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE cobro
     SET estado = $2, actualizado_por = $3
     WHERE id = $1`,
    [id, estado, ejecutorId],
    cliente,
  );
}

export async function crearPago({ cobroId, medio, monto, registradoPor }, cliente) {
  const { rows } = await ejecutar(
    `INSERT INTO pago (
       cobro_id, medio, monto, registrado_por, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $4, $4)
     RETURNING id`,
    [cobroId, medio, monto, registradoPor],
    cliente,
  );
  return rows[0].id;
}

export async function buscarPagoPorId(pagoId, cobroId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PAGO}
     FROM pago pg
     JOIN usuario u ON u.id = pg.registrado_por
     LEFT JOIN usuario ua ON ua.id = pg.anulado_por
     WHERE pg.id = $1 AND pg.cobro_id = $2`,
    [pagoId, cobroId],
    cliente,
  );
  return rows[0] ?? null;
}

export async function anularPago(pagoId, cobroId, motivo, ejecutorId, cliente) {
  await ejecutar(
    `UPDATE pago
     SET anulado = true,
         motivo_anulacion = $3,
         anulado_por = $4,
         anulado_en = now(),
         actualizado_por = $4
     WHERE id = $1 AND cobro_id = $2 AND anulado = false`,
    [pagoId, cobroId, motivo, ejecutorId],
    cliente,
  );
}

export async function listarPagosDeCobro(cobroId, cliente) {
  const { rows } = await ejecutar(
    `SELECT ${CAMPOS_PAGO}
     FROM pago pg
     JOIN usuario u ON u.id = pg.registrado_por
     LEFT JOIN usuario ua ON ua.id = pg.anulado_por
     WHERE pg.cobro_id = $1
     ORDER BY pg.fecha ASC, pg.id ASC`,
    [cobroId],
    cliente,
  );
  return rows;
}

export async function pagosDelDia(fecha, zona, cliente) {
  const { rows } = await ejecutar(
    `SELECT
       ${CAMPOS_PAGO},
       p.id AS paciente_id,
       p.nombre AS paciente_nombre,
       p.codigo_interno,
       cl.nombre AS cliente_nombre,
       cl.apellido AS cliente_apellido
     FROM pago pg
     JOIN cobro c ON c.id = pg.cobro_id
     JOIN visita v ON v.id = c.visita_id
     JOIN paciente p ON p.id = v.paciente_id
     JOIN cliente cl ON cl.id = p.cliente_id
     JOIN usuario u ON u.id = pg.registrado_por
     LEFT JOIN usuario ua ON ua.id = pg.anulado_por
     WHERE pg.anulado = false
       AND (pg.fecha AT TIME ZONE $2)::date = $1::date
     ORDER BY pg.fecha ASC, pg.id ASC`,
    [fecha, zona],
    cliente,
  );
  return rows;
}

export async function resumenPagosPorMedio(fecha, zona, cliente) {
  const { rows } = await ejecutar(
    `SELECT medio, count(*)::int AS cantidad, coalesce(sum(monto), 0) AS total
     FROM pago
     WHERE anulado = false
       AND (fecha AT TIME ZONE $2)::date = $1::date
     GROUP BY medio
     ORDER BY medio`,
    [fecha, zona],
    cliente,
  );
  return rows;
}

export async function resumenCobrosDelDia(fecha, zona, cliente) {
  const { rows } = await ejecutar(
    `SELECT count(*)::int AS cantidad, coalesce(sum(total), 0) AS total
     FROM cobro
     WHERE anulado = false
       AND (creado_en AT TIME ZONE $2)::date = $1::date`,
    [fecha, zona],
    cliente,
  );
  return rows[0];
}

export async function resumenDeudas(cliente) {
  const { rows } = await ejecutar(
    `SELECT
       count(*)::int AS cantidad,
       coalesce(sum(c.total - coalesce(pg.pagado, 0)), 0) AS total
     FROM cobro c
     LEFT JOIN LATERAL (
       SELECT coalesce(sum(monto), 0) AS pagado
       FROM pago
       WHERE cobro_id = c.id AND anulado = false
     ) pg ON true
     WHERE c.anulado = false
       AND (c.total - coalesce(pg.pagado, 0)) > 0`,
    [],
    cliente,
  );
  return rows[0];
}
