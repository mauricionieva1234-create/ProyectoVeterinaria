import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { hoyEnTucuman } from '../src/utils/fechas.js';
import { hashearPassword } from '../src/utils/password.js';
import { ejecutarSeed } from './seed.js';
import { cerrarPool, obtenerPool } from './utilidades.js';

// Todos los datos son inventados. Nunca se usan nombres, documentos ni
// teléfonos de personas o animales reales.
const CLIENTES_DEMO = [
  {
    nombre: 'Cliente',
    apellido: 'Demo A',
    documento: '90000001',
    telefono: '3815550001',
    email: 'cliente.demo.a@example.com',
  },
  {
    nombre: 'Cliente',
    apellido: 'Demo B',
    documento: '90000002',
    telefono: '3815550002',
    email: 'cliente.demo.b@example.com',
  },
  {
    nombre: 'Cliente',
    apellido: 'Demo C',
    documento: '90000003',
    telefono: '3815550003',
    email: 'cliente.demo.c@example.com',
  },
];

const PRECIOS_DEMO = [
  {
    nombre: 'Consulta clínica',
    importe: 15000,
    observaciones: 'Precio de demostración, sin valor real.',
  },
  {
    nombre: 'Vacunación',
    importe: 8000,
    observaciones: 'Precio de demostración, sin valor real.',
  },
  {
    nombre: 'Control clínico',
    importe: 6000,
    observaciones: 'Precio de demostración, sin valor real.',
  },
  {
    nombre: 'Cirugía menor',
    importe: 45000,
    observaciones: 'Precio de demostración, sin valor real.',
  },
];

const PACIENTES_DEMO = [
  {
    clienteDocumento: '90000001',
    nombre: 'Paciente Demo Alfa',
    especie: 'canino',
    raza: 'Mestizo',
    sexo: 'macho',
    nacimiento: '2020-05-10',
    color: 'Marrón',
  },
  {
    clienteDocumento: '90000001',
    nombre: 'Paciente Demo Beta',
    especie: 'felino',
    raza: 'Otra',
    sexo: 'hembra',
    nacimiento: '2022-08-01',
    color: 'Gris',
  },
  {
    clienteDocumento: '90000002',
    nombre: 'Paciente Demo Gamma',
    especie: 'canino',
    raza: 'Otra',
    sexo: 'hembra',
    nacimiento: '2018-03-20',
    color: 'Negro',
  },
  {
    clienteDocumento: '90000003',
    nombre: 'Paciente Demo Delta',
    especie: 'ave',
    raza: 'Otra',
    sexo: 'desconocido',
    nacimiento: null,
    color: 'Verde',
  },
  // Misma mascota que Gamma pero de otro dueño: sirve para probar el buscador
  // con nombres repetidos, un caso habitual en la veterinaria.
  {
    clienteDocumento: '90000003',
    nombre: 'Paciente Demo Gamma',
    especie: 'canino',
    raza: 'Otra',
    sexo: 'macho',
    nacimiento: '2021-11-05',
    color: 'Blanco',
  },
];

async function asegurarUsuarioDemo(cliente, { nombre, email, rol, matricula }) {
  const { rows } = await cliente.query('SELECT id FROM usuario WHERE lower(email) = lower($1)', [
    email,
  ]);

  if (rows.length > 0) {
    console.log(`Usuario demo ya existente: ${email} (sin cambios)`);
    return rows[0].id;
  }

  if (!env.SEED_DEMO_PASSWORD) {
    throw new Error('Falta SEED_DEMO_PASSWORD en backend/.env para crear usuarios demo');
  }

  const passwordHash = await hashearPassword(env.SEED_DEMO_PASSWORD);

  const creado = await cliente.query(
    `INSERT INTO usuario (nombre_completo, email, password_hash, rol, matricula, activo)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [nombre, email, passwordHash, rol, matricula ?? null],
  );

  console.log(`Usuario demo creado: ${email}`);
  return creado.rows[0].id;
}

export async function ejecutarSeedDemo() {
  await ejecutarSeed();

  const cliente = await obtenerPool().connect();

  try {
    await cliente.query('BEGIN');

    const veterinarioId = await asegurarUsuarioDemo(cliente, {
      nombre: 'Veterinario Demo',
      email: 'demo.veterinario@example.com',
      rol: 'veterinario',
      matricula: 'DEMO-001',
    });

    const recepcionId = await asegurarUsuarioDemo(cliente, {
      nombre: 'Recepción Demo',
      email: 'demo.recepcion@example.com',
      rol: 'recepcion',
    });

    // Clientes
    for (const datos of CLIENTES_DEMO) {
      await cliente.query(
        `INSERT INTO cliente (
           nombre, apellido, tipo_documento, nro_documento, telefono_principal, email
         )
         SELECT $1, $2, 'DNI', $3, $4, $5
         WHERE NOT EXISTS (SELECT 1 FROM cliente WHERE nro_documento = $3)`,
        [datos.nombre, datos.apellido, datos.documento, datos.telefono, datos.email],
      );
    }

    // Lista de precios de demostración. Si el precio ya existe, no se toca.
    const { rows: admins } = await cliente.query(
      "SELECT id FROM usuario WHERE rol = 'admin' AND activo ORDER BY id LIMIT 1",
    );
    const adminId = admins[0]?.id ?? null;

    for (const precio of PRECIOS_DEMO) {
      const { rows: existentes } = await cliente.query(
        `SELECT id FROM precio
         WHERE activo = true
           AND lower(fn_sin_tildes(nombre)) = lower(fn_sin_tildes($1))
         LIMIT 1`,
        [precio.nombre],
      );

      if (existentes.length > 0) continue;

      const { rows: creado } = await cliente.query(
        `INSERT INTO precio (nombre, importe, observaciones, creado_por, actualizado_por)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id`,
        [precio.nombre, precio.importe, precio.observaciones, adminId],
      );

      if (adminId) {
        await cliente.query(
          `INSERT INTO precio_historial (
             precio_id, nombre_anterior, nombre_nuevo,
             importe_anterior, importe_nuevo, motivo, cambiado_por
           )
           VALUES ($1, NULL, $2, NULL, $3, 'Precio inicial (demo)', $4)`,
          [creado[0].id, precio.nombre, precio.importe, adminId],
        );
      }
    }

    // Pacientes
    for (const datos of PACIENTES_DEMO) {
      const { rows: clientes } = await cliente.query(
        'SELECT id FROM cliente WHERE nro_documento = $1',
        [datos.clienteDocumento],
      );

      if (clientes.length === 0) continue;

      const clienteId = clientes[0].id;

      const { rows: especies } = await cliente.query(
        'SELECT id FROM especie WHERE lower(nombre) = lower($1)',
        [datos.especie],
      );

      if (especies.length === 0) continue;

      const especieId = especies[0].id;

      const { rows: razas } = await cliente.query(
        'SELECT id FROM raza WHERE especie_id = $1 AND lower(nombre) = lower($2)',
        [especieId, datos.raza],
      );

      await cliente.query(
        `INSERT INTO paciente (
           cliente_id, nombre, especie_id, raza_id, sexo, fecha_nacimiento, color
         )
         SELECT $1, $2, $3, $4, $5, $6::date, $7
         WHERE NOT EXISTS (
           SELECT 1 FROM paciente WHERE cliente_id = $1 AND lower(nombre) = lower($2)
         )`,
        [
          clienteId,
          datos.nombre,
          especieId,
          razas[0]?.id ?? null,
          datos.sexo,
          datos.nacimiento,
          datos.color,
        ],
      );
    }

    // Historial de dueño actual para cada paciente demo.
    await cliente.query(
      `INSERT INTO paciente_dueno_historial (paciente_id, cliente_id)
       SELECT p.id, p.cliente_id
       FROM paciente p
       WHERE p.nombre LIKE 'Paciente Demo %'
         AND NOT EXISTS (
           SELECT 1 FROM paciente_dueno_historial h
           WHERE h.paciente_id = p.id AND h.hasta IS NULL
         )`,
    );

    // Ingresos de hoy para los tres primeros pacientes.
    const { rows: pacientes } = await cliente.query(
      `SELECT id, nombre FROM paciente
       WHERE nombre LIKE 'Paciente Demo %'
       ORDER BY nombre
       LIMIT 3`,
    );

    const ingresos = new Map();
    const fechaDia = hoyEnTucuman();

    for (const [indice, paciente] of pacientes.entries()) {
      const existente = await cliente.query(
        'SELECT id FROM ingreso WHERE paciente_id = $1 AND fecha_dia = $2::date LIMIT 1',
        [paciente.id, fechaDia],
      );

      if (existente.rows.length > 0) {
        ingresos.set(paciente.id, existente.rows[0].id);
        continue;
      }

      const { rows: orden } = await cliente.query(
        'SELECT coalesce(max(numero_orden), 0) + 1 AS siguiente FROM ingreso WHERE fecha_dia = $1::date',
        [fechaDia],
      );

      const urgente = indice === 0;

      const creado = await cliente.query(
        `INSERT INTO ingreso (
           paciente_id, fecha_dia, numero_orden, servicio, prioridad, urgencia_estado, estado
         )
         VALUES ($1, $2::date, $3, 'atencion_clinica', $4, $5, 'esperando')
         RETURNING id`,
        [
          paciente.id,
          fechaDia,
          orden[0].siguiente,
          urgente ? 'urgente' : 'normal',
          urgente ? 'posible' : 'sin_marca',
        ],
      );

      ingresos.set(paciente.id, creado.rows[0].id);
    }

    // Una visita cerrada de ejemplo.
    const primerPaciente = pacientes[0];

    if (primerPaciente) {
      const { rows: visitas } = await cliente.query(
        'SELECT id FROM visita WHERE paciente_id = $1 LIMIT 1',
        [primerPaciente.id],
      );

      if (visitas.length === 0) {
        await cliente.query(
          `INSERT INTO visita (
             paciente_id, ingreso_id, veterinario_id, inicio_en, cierre_en, estado,
             motivo_consulta, anamnesis, temperatura_c, peso_kg, diagnostico, observaciones
           )
           VALUES (
             $1, $2, $3, now() - interval '1 hour', now(), 'cerrada',
             'Control general de demostración',
             'Paciente de ejemplo, sin datos reales.',
             38.5, 12.4,
             'Sin hallazgos relevantes en la revisión de demostración.',
             'Visita ficticia generada por seed:demo.'
           )`,
          [primerPaciente.id, ingresos.get(primerPaciente.id) ?? null, veterinarioId],
        );
      }

      // Controles de hoy y de mañana para que la pantalla de controles tenga
      // datos visibles. El aviso queda sobre el control de hoy.
      const { rows: visitaPaciente } = await cliente.query(
        'SELECT id FROM visita WHERE paciente_id = $1 ORDER BY id LIMIT 1',
        [primerPaciente.id],
      );

      const visitaId = visitaPaciente[0]?.id ?? null;

      const controlesDemo = [
        { dias: 0, franja: 'manana', motivo: 'Control de demostración de hoy' },
        { dias: 1, franja: 'tarde', motivo: 'Control de demostración de mañana' },
      ];

      let controlHoyId = null;

      for (const control of controlesDemo) {
        const { rows: existentes } = await cliente.query(
          `SELECT id FROM control
           WHERE paciente_id = $1 AND fecha_control = current_date + $2::int
           LIMIT 1`,
          [primerPaciente.id, control.dias],
        );

        let controlId = existentes[0]?.id;

        if (!controlId) {
          const { rows: nuevoControl } = await cliente.query(
            `INSERT INTO control (
               paciente_id, visita_origen_id, fecha_control, franja, motivo, estado
             )
             VALUES ($1, $2, current_date + $3::int, $4, $5, 'pendiente')
             RETURNING id`,
            [primerPaciente.id, visitaId, control.dias, control.franja, control.motivo],
          );

          controlId = nuevoControl[0].id;
        }

        if (control.dias === 0) {
          controlHoyId = controlId;
        }
      }

      const { rowCount: avisos } = await cliente.query(
        'SELECT 1 FROM aviso_control WHERE control_id = $1',
        [controlHoyId],
      );

      if (avisos === 0) {
        await cliente.query(
          `INSERT INTO aviso_control (
             control_id, canal, resultado, nota, realizado_por
           )
           VALUES ($1, 'llamada', 'avisado', 'Aviso de demostración', $2)`,
          [controlHoyId, recepcionId],
        );
      }
    }

    // Vacuna y estudio ficticios para el primer paciente, vinculados a su
    // visita si existe. Se evita duplicar si el seed se corre dos veces.
    if (primerPaciente) {
      const { rows: visitaPaciente } = await cliente.query(
        'SELECT id FROM visita WHERE paciente_id = $1 ORDER BY id LIMIT 1',
        [primerPaciente.id],
      );

      const visitaId = visitaPaciente[0]?.id ?? null;

      const { rowCount: vacunas } = await cliente.query(
        'SELECT 1 FROM registro_vacuna WHERE paciente_id = $1 AND vacuna = $2',
        [primerPaciente.id, 'Vacuna Demo Antirrábica'],
      );

      if (vacunas === 0) {
        await cliente.query(
          `INSERT INTO registro_vacuna (
             paciente_id, visita_id, vacuna, lote, fecha_aplicacion,
             fecha_proxima_dosis, aplicada_por, creado_por
           )
           VALUES ($1, $2, 'Vacuna Demo Antirrábica', 'DEMO-2026', current_date, current_date + 365, $3, $3)`,
          [primerPaciente.id, visitaId, veterinarioId],
        );
      }

      const { rowCount: estudios } = await cliente.query(
        'SELECT 1 FROM registro_estudio WHERE paciente_id = $1 AND tipo_estudio = $2',
        [primerPaciente.id, 'Estudio Demo de sangre'],
      );

      if (estudios === 0) {
        await cliente.query(
          `INSERT INTO registro_estudio (
             paciente_id, visita_id, tipo_estudio, fecha_pedido, estado,
             fecha_resultado, resultado_resumen, creado_por
           )
           VALUES (
             $1, $2, 'Estudio Demo de sangre', current_date - 2, 'resultado_cargado',
             current_date, 'Resultados ficticios dentro de los valores normales.', $3
           )`,
          [primerPaciente.id, visitaId, veterinarioId],
        );
      }
    }

    await cliente.query('COMMIT');
    console.log('Seed demo completado con datos ficticios.');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await ejecutarSeedDemo();
  } catch (error) {
    console.error('No se pudo ejecutar el seed demo:', error.message);
    process.exitCode = 1;
  } finally {
    await cerrarPool();
  }
}
