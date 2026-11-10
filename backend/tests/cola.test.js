import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { hoyEnTucuman } from '../src/utils/fechas.js';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';

async function crearClienteDemo(nroDocumento, telefono = '3815550100') {
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

async function crearPacienteDemo(clienteId, especieId, nombre = 'Paciente Demo') {
  const { rows } = await obtenerPool().query(
    `INSERT INTO paciente (cliente_id, nombre, especie_id, sexo)
     VALUES ($1, $2, $3, 'macho')
     RETURNING id`,
    [clienteId, nombre, especieId],
  );
  return rows[0].id;
}

async function crearIngresoAyer(pacienteId, numeroOrden, estado) {
  const { rows } = await obtenerPool().query(
    `INSERT INTO ingreso (
       paciente_id, fecha_dia, numero_orden, servicio, prioridad, urgencia_estado, estado
     )
     VALUES ($1, $2::date - 1, $3, 'atencion_clinica', 'normal', 'sin_marca', $4)
     RETURNING id`,
    [pacienteId, hoyEnTucuman(), numeroOrden, estado],
  );
  return rows[0].id;
}

describe('cola de espera', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let especieId;
  let clienteId;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin Prueba',
    });
    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción Prueba',
    });
    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Prueba',
    });

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino'), ('otro') RETURNING id, nombre`,
    );
    especieId = especies.find((fila) => fila.nombre === 'canino').id;

    clienteId = await crearClienteDemo('90000100');

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea un ingreso con número diario y registra la auditoría', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Uno');

    const respuesta = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
      comentario: 'Llegó por control, datos inventados.',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ingreso.numeroOrden).toBe(1);
    expect(respuesta.body.ingreso.fechaDia).toBe(hoyEnTucuman());
    expect(respuesta.body.ingreso.estado).toBe('esperando');
    expect(respuesta.body.ingreso.urgenciaEstado).toBe('sin_marca');
    expect(respuesta.body.ingreso.prioridad).toBe('normal');
    expect(respuesta.body.ingreso.horaLlegada).toBeTruthy();

    expect(await contarAuditoria('ingreso', respuesta.body.ingreso.id, 'crear')).toBe(1);
  });

  it('numera el siguiente ingreso y lo marca como posible urgencia', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Dos');

    const respuesta = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
      marcarPosibleUrgencia: true,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ingreso.numeroOrden).toBe(2);
    expect(respuesta.body.ingreso.urgenciaEstado).toBe('posible');
    expect(respuesta.body.ingreso.prioridad).toBe('urgente');
  });

  it('bloquea un segundo ingreso abierto del mismo paciente el mismo día', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Repetido');

    const primero = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
    });
    expect(primero.status).toBe(201);

    const segundo = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'vacunacion',
    });

    expect(segundo.status).toBe(409);
    expect(segundo.body.error.codigo).toBe('CONFLICTO');
  });

  it('permite a recepción marcar la urgencia pero no confirmarla', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Urgencia');

    const creado = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
    });
    expect(creado.status).toBe(201);

    const marcado = await agenteRecepcion.patch(
      `/api/cola/${creado.body.ingreso.id}/urgencia-posible`,
    );
    expect(marcado.status).toBe(200);
    expect(marcado.body.ingreso.urgenciaEstado).toBe('posible');
    expect(marcado.body.ingreso.prioridad).toBe('urgente');

    const intento = await agenteRecepcion
      .patch(`/api/cola/${creado.body.ingreso.id}/urgencia`)
      .send({ decision: 'confirmada' });

    expect(intento.status).toBe(403);
    expect(intento.body.error.codigo).toBe('SIN_PERMISO');
  });

  it('el veterinario confirma y descarta urgencias con sus datos de auditoría', async () => {
    const pacienteConfirmar = await crearPacienteDemo(clienteId, especieId, 'Paciente Confirmar');
    const pacienteDescartar = await crearPacienteDemo(clienteId, especieId, 'Paciente Descartar');

    const paraConfirmar = await agenteRecepcion.post('/api/cola').send({
      pacienteId: pacienteConfirmar,
      servicio: 'atencion_clinica',
      marcarPosibleUrgencia: true,
    });
    const paraDescartar = await agenteRecepcion.post('/api/cola').send({
      pacienteId: pacienteDescartar,
      servicio: 'atencion_clinica',
      marcarPosibleUrgencia: true,
    });

    const confirmada = await agenteVet
      .patch(`/api/cola/${paraConfirmar.body.ingreso.id}/urgencia`)
      .send({ decision: 'confirmada' });

    expect(confirmada.status).toBe(200);
    expect(confirmada.body.ingreso.urgenciaEstado).toBe('confirmada');
    expect(confirmada.body.ingreso.urgenciaConfirmadaPor).toBeTruthy();
    expect(confirmada.body.ingreso.urgenciaConfirmadaEn).toBeTruthy();

    const descartada = await agenteVet
      .patch(`/api/cola/${paraDescartar.body.ingreso.id}/urgencia`)
      .send({ decision: 'descartada' });

    expect(descartada.status).toBe(200);
    expect(descartada.body.ingreso.urgenciaEstado).toBe('descartada');
    expect(descartada.body.ingreso.prioridad).toBe('normal');
    expect(descartada.body.ingreso.urgenciaConfirmadaPor).toBeNull();
    expect(descartada.body.ingreso.urgenciaConfirmadaEn).toBeNull();
  });

  it('pasa al consultorio una sola vez y cierra el ingreso', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Consultorio');

    const creado = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
    });

    const enConsulta = await agenteVet.patch(`/api/cola/${creado.body.ingreso.id}/consultorio`);

    expect(enConsulta.status).toBe(200);
    expect(enConsulta.body.ingreso.estado).toBe('en_consulta');
    expect(enConsulta.body.ingreso.horaIngresoConsultorio).toBeTruthy();

    const repetido = await agenteVet.patch(`/api/cola/${creado.body.ingreso.id}/consultorio`);
    expect(repetido.status).toBe(409);

    const cerrado = await agenteVet
      .patch(`/api/cola/${creado.body.ingreso.id}/estado`)
      .send({ estado: 'atendido' });

    expect(cerrado.status).toBe(200);
    expect(cerrado.body.ingreso.estado).toBe('atendido');

    const otraVez = await agenteVet
      .patch(`/api/cola/${creado.body.ingreso.id}/estado`)
      .send({ estado: 'cancelado' });

    expect(otraVez.status).toBe(409);
  });

  it('muestra solo la cola de hoy con las urgencias primero', async () => {
    const respuesta = await agenteRecepcion.get('/api/cola');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.fecha).toBe(hoyEnTucuman());
    expect(respuesta.body.ingresos.length).toBeGreaterThan(0);

    for (const ingreso of respuesta.body.ingresos) {
      expect(ingreso.fechaDia).toBe(hoyEnTucuman());
    }

    const ultimaUrgente = respuesta.body.ingresos.findLastIndex(
      (ingreso) => ingreso.prioridad === 'urgente',
    );
    const primeraNormal = respuesta.body.ingresos.findIndex(
      (ingreso) => ingreso.prioridad === 'normal',
    );

    if (ultimaUrgente !== -1 && primeraNormal !== -1) {
      expect(ultimaUrgente).toBeLessThan(primeraNormal);
    }
  });

  it('cierra de forma diferida los ingresos abiertos de días anteriores', async () => {
    const pacienteEsperando = await crearPacienteDemo(clienteId, especieId, 'Paciente Ayer Uno');
    const pacienteEnConsulta = await crearPacienteDemo(clienteId, especieId, 'Paciente Ayer Dos');

    const idEsperando = await crearIngresoAyer(pacienteEsperando, 1, 'esperando');
    const idEnConsulta = await crearIngresoAyer(pacienteEnConsulta, 2, 'en_consulta');

    const cola = await agenteRecepcion.get('/api/cola');
    expect(cola.status).toBe(200);

    const sinCerrar = await agenteRecepcion.get('/api/cola/sin-cerrar');

    expect(sinCerrar.status).toBe(200);
    expect(sinCerrar.body.paginacion.total).toBe(2);

    const ids = sinCerrar.body.datos.map((ingreso) => ingreso.id);
    expect(ids).toContain(idEsperando);
    expect(ids).toContain(idEnConsulta);

    for (const ingreso of sinCerrar.body.datos) {
      expect(ingreso.estado).toBe('sin_cerrar');
    }

    expect(await contarAuditoria('ingreso', idEsperando, 'editar')).toBeGreaterThan(0);
    expect(await contarAuditoria('ingreso', idEnConsulta, 'editar')).toBeGreaterThan(0);
  });

  it('no permite modificar la hora de llegada ni por SQL directo', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, 'Paciente Inmutable');

    const creado = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
    });

    await expect(
      obtenerPool().query(
        "UPDATE ingreso SET hora_llegada = now() - interval '1 hour' WHERE id = $1",
        [creado.body.ingreso.id],
      ),
    ).rejects.toThrow('La hora de llegada del ingreso no se puede modificar');
  });
});
