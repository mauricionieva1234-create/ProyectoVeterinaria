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
import {
  crearClienteDemo,
  crearControlDemo,
  crearPacienteDemo,
  crearVisitaDemo,
  sumarDias,
} from './ayuda/clinica.js';

async function contarAuditoriaAccion(entidad, entidadId, accion) {
  const { rows } = await obtenerPool().query(
    `SELECT count(*)::int AS total
     FROM auditoria
     WHERE entidad = $1 AND entidad_id = $2 AND accion = $3`,
    [entidad, entidadId, accion],
  );
  return rows[0].total;
}

describe('controles y avisos', () => {
  let agenteRecepcion;
  let agenteVet;
  let veterinarioId;
  let especieId;
  let clienteId;
  let pacienteId;
  let visitaId;

  const hoy = hoyEnTucuman();
  const manana = sumarDias(hoy, 1);

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
    clienteId = await crearClienteDemo('94000100', '3815559999');
    pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Paciente Controles' });
    visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });

    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea un control desde una visita y rechaza fechas pasadas', async () => {
    const pasado = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: sumarDias(hoy, -1),
      franja: 'manana',
      motivo: 'Control vencido ficticio',
    });

    expect(pasado.status).toBe(400);
    expect(pasado.body.error.detalles[0].campo).toBe('fechaControl');

    const creado = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      franja: 'manana',
      motivo: 'Control de hoy ficticio',
    });

    expect(creado.status).toBe(201);
    expect(creado.body.control.estado).toBe('pendiente');
    expect(creado.body.control.fechaControl).toBe(hoy);
    expect(creado.body.control.franja).toBe('manana');
    expect(creado.body.control.cliente.telefonoPrincipal).toBe('3815559999');
    expect(await contarAuditoria('control', creado.body.control.id)).toBe(1);
  });

  it('devuelve los recordatorios de hoy y mañana con teléfono y franja', async () => {
    const deManana = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: manana,
      franja: 'tarde',
      motivo: 'Control de mañana ficticio',
    });
    expect(deManana.status).toBe(201);

    const respuesta = await agenteRecepcion.get('/api/controles/recordar');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.hoy.length).toBeGreaterThan(0);
    expect(respuesta.body.manana.length).toBeGreaterThan(0);

    const controlManana = respuesta.body.manana.find(
      (control) => control.id === deManana.body.control.id,
    );

    expect(controlManana).toBeTruthy();
    expect(controlManana.franja).toBe('tarde');
    expect(controlManana.cliente.telefonoPrincipal).toBe('3815559999');
    expect(controlManana.paciente.nombre).toBe('Paciente Controles');
  });

  it('pasa a ausente un pendiente vencido al consultar y lo audita', async () => {
    const vencidoId = await crearControlDemo({
      pacienteId,
      visitaOrigenId: visitaId,
      fechaControl: sumarDias(hoy, -1),
      estado: 'pendiente',
    });

    const respuesta = await agenteVet.get('/api/controles?estado=ausente');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.datos.map((control) => control.id)).toContain(vencidoId);

    const { rows } = await obtenerPool().query('SELECT estado FROM control WHERE id = $1', [
      vencidoId,
    ]);
    expect(rows[0].estado).toBe('ausente');
    expect(await contarAuditoriaAccion('control', vencidoId, 'editar')).toBe(1);
  });

  it('reprograma creando un control nuevo y deja el original como reprogramado', async () => {
    const original = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      franja: 'cualquiera',
      motivo: 'Control a reprogramar ficticio',
    });

    const respuesta = await agenteVet
      .post(`/api/controles/${original.body.control.id}/reprogramar`)
      .send({ fechaControl: manana, franja: 'tarde', motivo: 'Reprogramación ficticia' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.control.estado).toBe('reprogramado');
    expect(String(respuesta.body.control.controlNuevoId)).toBe(String(respuesta.body.nuevo.id));
    expect(respuesta.body.nuevo.estado).toBe('pendiente');
    expect(respuesta.body.nuevo.fechaControl).toBe(manana);
    expect(respuesta.body.nuevo.franja).toBe('tarde');

    const otraVez = await agenteVet
      .post(`/api/controles/${original.body.control.id}/reprogramar`)
      .send({ fechaControl: manana, franja: 'manana' });
    expect(otraVez.status).toBe(409);
  });

  it('marca realizado con y sin visita, y no permite reabrirlo', async () => {
    const sinVisita = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      franja: 'cualquiera',
    });

    const realizado = await agenteVet
      .patch(`/api/controles/${sinVisita.body.control.id}/estado`)
      .send({ estado: 'realizado' });

    expect(realizado.status).toBe(200);
    expect(realizado.body.control.estado).toBe('realizado');
    expect(realizado.body.control.visitaRealizadaId).toBeNull();

    const conVisita = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      franja: 'cualquiera',
    });

    const conVisitaRealizada = await agenteVet
      .patch(`/api/controles/${conVisita.body.control.id}/estado`)
      .send({ estado: 'realizado', visitaRealizadaId: visitaId });

    expect(conVisitaRealizada.status).toBe(200);
    expect(String(conVisitaRealizada.body.control.visitaRealizadaId)).toBe(String(visitaId));

    const reabrir = await agenteVet
      .patch(`/api/controles/${sinVisita.body.control.id}/estado`)
      .send({ estado: 'cancelado' });

    expect(reabrir.status).toBe(409);
  });

  it('permite a recepción registrar avisos y verlos, pero no gestionar controles', async () => {
    const control = await agenteVet.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      franja: 'tarde',
      motivo: 'Control con aviso ficticio',
    });

    const aviso = await agenteRecepcion
      .post(`/api/controles/${control.body.control.id}/avisos`)
      .send({ canal: 'llamada', resultado: 'avisado', nota: 'Llamada ficticia' });

    expect(aviso.status).toBe(201);
    expect(aviso.body.aviso.canal).toBe('llamada');
    expect(aviso.body.aviso.resultado).toBe('avisado');
    expect(aviso.body.aviso.realizadoPorNombre).toBe('Recepción Prueba');

    const avisos = await agenteRecepcion.get(`/api/controles/${control.body.control.id}/avisos`);
    expect(avisos.status).toBe(200);
    expect(avisos.body.avisos).toHaveLength(1);

    const detalle = await agenteRecepcion.get(`/api/controles/${control.body.control.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.control.avisos).toHaveLength(1);
    expect(detalle.body.control.ultimoAviso.resultado).toBe('avisado');

    const canalInvalido = await agenteRecepcion
      .post(`/api/controles/${control.body.control.id}/avisos`)
      .send({ canal: 'correo', resultado: 'avisado' });
    expect(canalInvalido.status).toBe(400);

    const alta = await agenteRecepcion.post('/api/controles').send({
      visitaOrigenId: visitaId,
      fechaControl: hoy,
    });
    expect(alta.status).toBe(403);

    const reprogramar = await agenteRecepcion
      .post(`/api/controles/${control.body.control.id}/reprogramar`)
      .send({ fechaControl: manana, franja: 'manana' });
    expect(reprogramar.status).toBe(403);

    const estado = await agenteRecepcion
      .patch(`/api/controles/${control.body.control.id}/estado`)
      .send({ estado: 'cancelado' });
    expect(estado.status).toBe(403);

    const anular = await agenteRecepcion
      .post(`/api/controles/${control.body.control.id}/anular`)
      .send({ motivo: 'Intento ficticio' });
    expect(anular.status).toBe(403);
  });
});
