import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';
import {
  crearClienteDemo,
  crearIngresoDemo,
  crearPacienteDemo,
  crearVisitaDemo,
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

describe('visitas clínicas', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let veterinarioId;
  let especieId;
  let clienteId;

  beforeAll(async () => {
    await limpiarBase();

    const admin = await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin Prueba',
    });
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

    expect(admin.rol).toBe('admin');
    veterinarioId = vet.id;

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino'), ('felino') RETURNING id, nombre`,
    );
    especieId = especies.find((fila) => fila.nombre === 'canino').id;
    clienteId = await crearClienteDemo('92000100');

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('inicia una visita desde un ingreso en espera y lo pasa a en consulta', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Uno' });
    const ingresoId = await crearIngresoDemo(pacienteId, { estado: 'esperando' });

    const respuesta = await agenteVet.post('/api/visitas').send({
      pacienteId,
      ingresoId,
      motivoConsulta: 'Revisión general ficticia',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.visita.estado).toBe('borrador');
    expect(respuesta.body.visita.cierreEn).toBeNull();
    expect(respuesta.body.visita.ingreso.estado).toBe('en_consulta');

    const { rows } = await obtenerPool().query(
      'SELECT estado, hora_ingreso_consultorio FROM ingreso WHERE id = $1',
      [ingresoId],
    );
    expect(rows[0].estado).toBe('en_consulta');
    expect(rows[0].hora_ingreso_consultorio).toBeTruthy();

    expect(await contarAuditoria('visita', respuesta.body.visita.id)).toBeGreaterThan(0);
    expect(await contarAuditoriaAccion('ingreso', ingresoId, 'editar')).toBe(1);

    const repetida = await agenteVet.post('/api/visitas').send({ pacienteId, ingresoId });
    expect(repetida.status).toBe(409);
  });

  it('edita el borrador sin motivo, exige motivo para cerrar y cierra el ingreso', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Dos' });
    const ingresoId = await crearIngresoDemo(pacienteId, { estado: 'en_consulta' });

    const creada = await agenteVet.post('/api/visitas').send({
      pacienteId,
      ingresoId,
      motivoConsulta: 'Control inicial',
    });
    const visitaId = creada.body.visita.id;

    const editada = await agenteVet
      .patch(`/api/visitas/${visitaId}`)
      .send({ diagnostico: 'Sin particularidades', pesoKg: 12.5 });

    expect(editada.status).toBe(200);
    expect(editada.body.visita.diagnostico).toBe('Sin particularidades');
    expect(editada.body.visita.pesoKg).toBe(12.5);

    const sinMotivo = await agenteVet.post(`/api/visitas/${visitaId}/cerrar`).send({});
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.codigo).toBe('DATOS_INVALIDOS');

    const cerrada = await agenteVet
      .post(`/api/visitas/${visitaId}/cerrar`)
      .send({ motivoConsulta: 'Dolor abdominal ficticio' });

    expect(cerrada.status).toBe(200);
    expect(cerrada.body.visita.estado).toBe('cerrada');
    expect(cerrada.body.visita.cierreEn).toBeTruthy();

    const { rows } = await obtenerPool().query('SELECT estado FROM ingreso WHERE id = $1', [
      ingresoId,
    ]);
    expect(rows[0].estado).toBe('atendido');
    expect(await contarAuditoriaAccion('ingreso', ingresoId, 'editar')).toBeGreaterThan(0);
  });

  it('exige motivo al corregir una visita cerrada y guarda la versión anterior', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Tres' });
    const visitaId = await crearVisitaDemo({
      pacienteId,
      veterinarioId,
      estado: 'cerrada',
      diagnostico: 'Diagnóstico original',
    });

    const sinMotivo = await agenteVet
      .patch(`/api/visitas/${visitaId}`)
      .send({ diagnostico: 'Diagnóstico nuevo' });

    expect(sinMotivo.status).toBe(400);

    const corregida = await agenteVet.patch(`/api/visitas/${visitaId}`).send({
      diagnostico: 'Diagnóstico corregido',
      motivoCambio: 'Se corrigió un error de tipeo ficticio',
    });

    expect(corregida.status).toBe(200);
    expect(corregida.body.visita.estado).toBe('corregida');
    expect(corregida.body.visita.diagnostico).toBe('Diagnóstico corregido');

    const detalle = await agenteVet.get(`/api/visitas/${visitaId}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.visita.versiones).toHaveLength(1);
    expect(detalle.body.visita.versiones[0].numero).toBe(1);
    expect(detalle.body.visita.versiones[0].contenido.visita.diagnostico).toBe(
      'Diagnóstico original',
    );
    expect(await contarAuditoriaAccion('visita', visitaId, 'editar')).toBeGreaterThan(0);
  });

  it('solo acepta notas después del cierre y no las versiona', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Notas' });
    const visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });

    const enBorrador = await agenteVet
      .post(`/api/visitas/${visitaId}/notas`)
      .send({ texto: 'Nota temprana ficticia' });
    expect(enBorrador.status).toBe(409);

    await agenteVet
      .post(`/api/visitas/${visitaId}/cerrar`)
      .send({ motivoConsulta: 'Cierre con nota' });

    const nota = await agenteVet
      .post(`/api/visitas/${visitaId}/notas`)
      .send({ texto: 'Evolución favorable ficticia' });

    expect(nota.status).toBe(201);
    expect(nota.body.nota.texto).toBe('Evolución favorable ficticia');
    expect(nota.body.nota.autorNombre).toBe('Vet Prueba');

    const detalle = await agenteVet.get(`/api/visitas/${visitaId}`);
    expect(detalle.body.visita.notas).toHaveLength(1);
    expect(detalle.body.visita.versiones).toHaveLength(0);
  });

  it('anula con motivo y bloquea cualquier cambio posterior', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Anulada' });
    const visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });

    const sinMotivo = await agenteVet.post(`/api/visitas/${visitaId}/anular`).send({});
    expect(sinMotivo.status).toBe(400);

    const anulada = await agenteVet
      .post(`/api/visitas/${visitaId}/anular`)
      .send({ motivo: 'Visita cargada por error ficticio' });

    expect(anulada.status).toBe(200);
    expect(anulada.body.visita.anulado).toBe(true);
    expect(anulada.body.visita.motivoAnulacion).toBe('Visita cargada por error ficticio');

    const cambio = await agenteVet
      .patch(`/api/visitas/${visitaId}`)
      .send({ observaciones: 'Intento posterior' });
    expect(cambio.status).toBe(409);
  });

  it('exige especie al iniciar la visita de un paciente provisorio y conserva la marca', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, {
      nombre: 'Sin nombre',
      provisorio: true,
    });

    const sinEspecie = await agenteVet
      .post('/api/visitas')
      .send({ pacienteId, motivoConsulta: 'Alta rápida ficticia' });
    expect(sinEspecie.status).toBe(400);
    expect(sinEspecie.body.error.detalles[0].campo).toBe('especieId');

    const { rows: felinos } = await obtenerPool().query(
      `SELECT id FROM especie WHERE nombre = 'felino'`,
    );
    const felinoId = felinos[0]?.id ?? especieId;

    const creada = await agenteVet.post('/api/visitas').send({
      pacienteId,
      especieId: felinoId,
      nombre: 'Michi Ficticio',
      motivoConsulta: 'Primera consulta ficticia',
    });

    expect(creada.status).toBe(201);
    expect(creada.body.visita.paciente.nombre).toBe('Michi Ficticio');
    expect(String(creada.body.visita.paciente.especieId)).toBe(String(felinoId));

    const { rows } = await obtenerPool().query(
      'SELECT nombre, provisorio, especie_id FROM paciente WHERE id = $1',
      [pacienteId],
    );
    expect(rows[0].nombre).toBe('Michi Ficticio');
    expect(rows[0].provisorio).toBe(true);
    expect(String(rows[0].especie_id)).toBe(String(felinoId));
    expect(await contarAuditoriaAccion('paciente', pacienteId, 'editar')).toBe(1);
  });

  it('registra, edita y anula medicación; en visita cerrada exige motivo y versiona', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Visita Medicada' });
    const visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });

    const medicacion = await agenteVet
      .post(`/api/visitas/${visitaId}/medicacion`)
      .send({ medicamento: 'Meloxicam ficticio', dosis: '0,2 mg/kg' });

    expect(medicacion.status).toBe(201);
    expect(medicacion.body.medicacion.medicamento).toBe('Meloxicam ficticio');
    const medicacionId = medicacion.body.medicacion.id;

    const anulada = await agenteVet
      .post(`/api/visitas/${visitaId}/medicacion/${medicacionId}/anular`)
      .send({ motivo: 'Medicamento duplicado ficticio' });

    expect(anulada.status).toBe(200);
    expect(anulada.body.medicacion.anulado).toBe(true);

    await agenteVet
      .post(`/api/visitas/${visitaId}/cerrar`)
      .send({ motivoConsulta: 'Cierre de visita medicada' });

    const sinMotivo = await agenteVet
      .post(`/api/visitas/${visitaId}/medicacion`)
      .send({ medicamento: 'Omeprazol ficticio' });
    expect(sinMotivo.status).toBe(400);

    const conMotivo = await agenteVet
      .post(`/api/visitas/${visitaId}/medicacion`)
      .send({ medicamento: 'Omeprazol ficticio', motivoCambio: 'Se agregó tratamiento ficticio' });

    expect(conMotivo.status).toBe(201);

    const detalle = await agenteVet.get(`/api/visitas/${visitaId}`);
    expect(detalle.body.visita.estado).toBe('corregida');
    expect(detalle.body.visita.versiones).toHaveLength(1);
    expect(detalle.body.visita.versiones[0].contenido.medicacion).toHaveLength(0);
  });

  it('oculta los datos clínicos del detalle a roles sin permiso clínico', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, {
      nombre: 'Visita Restringida',
    });
    const visitaId = await crearVisitaDemo({
      pacienteId,
      veterinarioId,
      diagnostico: 'Dato clínico reservado',
    });

    const respuesta = await agenteRecepcion
      .get(`/api/visitas/${visitaId}`)
      .set('Accept', 'application/json');

    // Recepción no tiene visitas.ver, así que ni siquiera llega al detalle.
    expect(respuesta.status).toBe(403);
  });

  it('recepción recibe 403 en todas las rutas de visitas', async () => {
    const listado = await agenteRecepcion.get('/api/visitas');
    expect(listado.status).toBe(403);

    const alta = await agenteRecepcion.post('/api/visitas').send({ pacienteId: 1 });
    expect(alta.status).toBe(403);

    const cierre = await agenteRecepcion
      .post('/api/visitas/1/cerrar')
      .send({ motivoConsulta: 'x' });
    expect(cierre.status).toBe(403);
  });
});
