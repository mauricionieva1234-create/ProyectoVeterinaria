import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';
import { crearClienteDemo, crearPacienteDemo, crearVisitaDemo } from './ayuda/clinica.js';

describe('registros clínicos', () => {
  let agenteRecepcion;
  let agenteVet;
  let veterinarioId;
  let especieId;
  let clienteId;
  let pacienteId;
  let otroPacienteId;
  let visitaId;
  let visitaOtroPacienteId;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción Prueba',
    });
    const vet = await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Prueba',
    });
    veterinarioId = vet.id;

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino') RETURNING id`,
    );
    especieId = especies[0].id;
    clienteId = await crearClienteDemo('93000100');

    pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Paciente Registros' });
    otroPacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Otro Paciente' });

    visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });
    visitaOtroPacienteId = await crearVisitaDemo({
      pacienteId: otroPacienteId,
      veterinarioId,
    });

    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('da de alta una vacuna, completa el aplicador y la lista por paciente', async () => {
    const respuesta = await agenteVet.post('/api/registros/vacuna').send({
      pacienteId,
      visitaId,
      vacuna: 'Antirrábica ficticia',
      lote: 'LOTE-1',
      fechaAplicacion: '2026-01-10',
      fechaProximaDosis: '2027-01-10',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.registro.tipo).toBe('vacuna');
    expect(respuesta.body.registro.vacuna).toBe('Antirrábica ficticia');
    expect(String(respuesta.body.registro.aplicadaPor)).toBe(String(veterinarioId));
    expect(await contarAuditoria('registro_vacuna', respuesta.body.registro.id)).toBe(1);

    const listado = await agenteVet.get(`/api/pacientes/${pacienteId}/registros?tipo=vacuna`);
    expect(listado.status).toBe(200);
    expect(listado.body.tipo).toBe('vacuna');
    expect(listado.body.datos).toHaveLength(1);
    expect(listado.body.datos[0].lote).toBe('LOTE-1');

    const todos = await agenteVet.get(`/api/pacientes/${pacienteId}/registros`);
    expect(todos.status).toBe(200);
    expect(todos.body.vacunas).toHaveLength(1);
    expect(todos.body.estudios).toHaveLength(0);
  });

  it('edita y anula una vacuna sin borrar la fila', async () => {
    const creada = await agenteVet.post('/api/registros/vacuna').send({
      pacienteId,
      vacuna: 'Sextuple ficticia',
      fechaAplicacion: '2026-02-01',
    });

    const editada = await agenteVet
      .patch(`/api/registros/vacuna/${creada.body.registro.id}`)
      .send({ lote: 'LOTE-EDITADO' });

    expect(editada.status).toBe(200);
    expect(editada.body.registro.lote).toBe('LOTE-EDITADO');

    const sinMotivo = await agenteVet
      .post(`/api/registros/vacuna/${creada.body.registro.id}/anular`)
      .send({});
    expect(sinMotivo.status).toBe(400);

    const anulada = await agenteVet
      .post(`/api/registros/vacuna/${creada.body.registro.id}/anular`)
      .send({ motivo: 'Carga duplicada ficticia' });

    expect(anulada.status).toBe(200);
    expect(anulada.body.registro.anulado).toBe(true);

    const listado = await agenteVet.get(`/api/pacientes/${pacienteId}/registros?tipo=vacuna`);
    expect(listado.body.datos.map((fila) => fila.id)).not.toContain(creada.body.registro.id);

    const { rows } = await obtenerPool().query(
      'SELECT anulado, motivo_anulacion FROM registro_vacuna WHERE id = $1',
      [creada.body.registro.id],
    );
    expect(rows[0].anulado).toBe(true);
    expect(rows[0].motivo_anulacion).toBe('Carga duplicada ficticia');
  });

  it('da de alta, edita y anula un antiparasitario', async () => {
    const creado = await agenteVet.post('/api/registros/antiparasitario').send({
      pacienteId,
      producto: 'Pipeta ficticia',
      tipo: 'externo',
      dosis: '1 pipeta',
      fechaAplicacion: '2026-03-01',
    });

    expect(creado.status).toBe(201);
    expect(creado.body.registro.tipoProducto).toBe('externo');
    expect(String(creado.body.registro.aplicadoPor)).toBe(String(veterinarioId));

    const editado = await agenteVet
      .patch(`/api/registros/antiparasitario/${creado.body.registro.id}`)
      .send({ dosis: '2 pipetas' });

    expect(editado.status).toBe(200);
    expect(editado.body.registro.dosis).toBe('2 pipetas');

    const anulado = await agenteVet
      .post(`/api/registros/antiparasitario/${creado.body.registro.id}/anular`)
      .send({ motivo: 'Producto vencido ficticio' });

    expect(anulado.status).toBe(200);
    expect(anulado.body.registro.anulado).toBe(true);
  });

  it('valida las transiciones del estudio y su fecha de resultado', async () => {
    const creado = await agenteVet.post('/api/registros/estudio').send({
      pacienteId,
      tipoEstudio: 'Radiografía ficticia',
      fechaPedido: '2026-04-01',
    });

    expect(creado.status).toBe(201);
    expect(creado.body.registro.estado).toBe('pedido');
    const estudioId = creado.body.registro.id;

    const sinFecha = await agenteVet
      .patch(`/api/registros/estudio/${estudioId}`)
      .send({ estado: 'resultado_cargado' });
    expect(sinFecha.status).toBe(400);
    expect(sinFecha.body.error.detalles[0].campo).toBe('fechaResultado');

    const realizado = await agenteVet
      .patch(`/api/registros/estudio/${estudioId}`)
      .send({ estado: 'realizado' });
    expect(realizado.status).toBe(200);

    const resultado = await agenteVet.patch(`/api/registros/estudio/${estudioId}`).send({
      estado: 'resultado_cargado',
      fechaResultado: '2026-04-05',
      resultadoResumen: 'Informe ficticio sin hallazgos',
    });
    expect(resultado.status).toBe(200);
    expect(resultado.body.registro.estado).toBe('resultado_cargado');

    const retroceso = await agenteVet
      .patch(`/api/registros/estudio/${estudioId}`)
      .send({ estado: 'pedido' });
    expect(retroceso.status).toBe(409);
  });

  it('exige fecha en cirugía programada y respeta sus estados finales', async () => {
    const sinFecha = await agenteVet.post('/api/registros/cirugia').send({
      pacienteId,
      tipoCirugia: 'Castración ficticia',
    });
    expect(sinFecha.status).toBe(400);

    const creada = await agenteVet.post('/api/registros/cirugia').send({
      pacienteId,
      tipoCirugia: 'Castración ficticia',
      fechaProgramada: '2026-05-10',
      cirujanoId: veterinarioId,
      indicacionesPrevias: 'Ayuno ficticio de 12 horas',
    });

    expect(creada.status).toBe(201);
    expect(creada.body.registro.estado).toBe('programada');
    expect(String(creada.body.registro.cirujanoId)).toBe(String(veterinarioId));

    const realizada = await agenteVet
      .patch(`/api/registros/cirugia/${creada.body.registro.id}`)
      .send({ estado: 'realizada', notasPostoperatorio: 'Sin complicaciones ficticias' });

    expect(realizada.status).toBe(200);
    expect(realizada.body.registro.estado).toBe('realizada');

    const cambio = await agenteVet
      .patch(`/api/registros/cirugia/${creada.body.registro.id}`)
      .send({ estado: 'cancelada' });
    expect(cambio.status).toBe(409);
  });

  it('rechaza una visita que pertenece a otro paciente', async () => {
    const respuesta = await agenteVet.post('/api/registros/vacuna').send({
      pacienteId,
      visitaId: visitaOtroPacienteId,
      vacuna: 'Vacuna cruzada ficticia',
      fechaAplicacion: '2026-06-01',
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CONFLICTO');
  });

  it('recepción no accede a los registros clínicos', async () => {
    const listado = await agenteRecepcion.get(`/api/pacientes/${pacienteId}/registros`);
    expect(listado.status).toBe(403);

    const alta = await agenteRecepcion.post('/api/registros/vacuna').send({
      pacienteId,
      vacuna: 'Vacuna ficticia',
      fechaAplicacion: '2026-07-01',
    });
    expect(alta.status).toBe(403);

    const anulacion = await agenteRecepcion
      .post('/api/registros/vacuna/1/anular')
      .send({ motivo: 'Intento ficticio' });
    expect(anulacion.status).toBe(403);
  });
});
