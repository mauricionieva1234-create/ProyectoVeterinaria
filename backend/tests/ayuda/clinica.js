import { obtenerPool } from '../../src/config/db.js';
import { hoyEnTucuman } from '../../src/utils/fechas.js';

export async function crearClienteDemo(nroDocumento, telefono = '3815550100') {
  const { rows } = await obtenerPool().query(
    `INSERT INTO cliente (
       nombre, apellido, tipo_documento, nro_documento, pais,
       telefono_principal, telefono_es_whatsapp
     )
     VALUES ('Cliente', 'Demo', 'DNI', $1, 'Argentina', $2, true)
     RETURNING id`,
    [nroDocumento, telefono],
  );
  return rows[0].id;
}

export async function crearPacienteDemo(
  clienteId,
  especieId,
  { nombre = 'Paciente Demo', provisorio = false } = {},
) {
  const { rows } = await obtenerPool().query(
    `INSERT INTO paciente (cliente_id, nombre, especie_id, sexo, provisorio)
     VALUES ($1, $2, $3, 'macho', $4)
     RETURNING id`,
    [clienteId, nombre, especieId, provisorio],
  );
  return rows[0].id;
}

export async function crearIngresoDemo(
  pacienteId,
  {
    estado = 'esperando',
    fecha = hoyEnTucuman(),
    numeroOrden = null,
    servicio = 'atencion_clinica',
  } = {},
) {
  let numero = numeroOrden;

  if (numero === null) {
    const { rows: consecutivos } = await obtenerPool().query(
      'SELECT coalesce(max(numero_orden), 0) + 1 AS siguiente FROM ingreso WHERE fecha_dia = $1::date',
      [fecha],
    );
    numero = consecutivos[0].siguiente;
  }

  const { rows } = await obtenerPool().query(
    `INSERT INTO ingreso (
       paciente_id, fecha_dia, numero_orden, servicio, prioridad, urgencia_estado, estado
     )
     VALUES ($1, $2::date, $3, $4, 'normal', 'sin_marca', $5)
     RETURNING id`,
    [pacienteId, fecha, numero, servicio, estado],
  );
  return rows[0].id;
}

export async function crearVisitaDemo({
  pacienteId,
  veterinarioId,
  ingresoId = null,
  estado = 'borrador',
  motivoConsulta = 'Control general ficticio',
  diagnostico = null,
}) {
  const cerrada = estado !== 'borrador';

  const { rows } = await obtenerPool().query(
    `INSERT INTO visita (
       paciente_id, ingreso_id, veterinario_id, estado, motivo_consulta,
       diagnostico, cierre_en, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, ${cerrada ? 'now()' : 'NULL'}, $3, $3)
     RETURNING id`,
    [pacienteId, ingresoId, veterinarioId, estado, motivoConsulta, diagnostico],
  );
  return rows[0].id;
}

export async function crearControlDemo({
  pacienteId,
  visitaOrigenId,
  fechaControl = hoyEnTucuman(),
  franja = 'cualquiera',
  motivo = 'Control ficticio',
  estado = 'pendiente',
}) {
  const { rows } = await obtenerPool().query(
    `INSERT INTO control (
       paciente_id, visita_origen_id, fecha_control, franja, motivo, estado,
       creado_por, actualizado_por
     )
     VALUES ($1, $2, $3::date, $4, $5, $6, NULL, NULL)
     RETURNING id`,
    [pacienteId, visitaOrigenId, fechaControl, franja, motivo, estado],
  );
  return rows[0].id;
}

export function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
