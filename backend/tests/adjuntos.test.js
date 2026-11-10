import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { obtenerPool } from '../src/config/db.js';
import { directorioAdjuntos } from '../src/utils/archivos.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';
import { crearClienteDemo, crearPacienteDemo, crearVisitaDemo } from './ayuda/clinica.js';

const PDF = Buffer.from('%PDF-1.4\nArchivo ficticio de prueba\n%%EOF');
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('adjuntos', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let veterinarioId;
  let especieId;
  let clienteId;
  let pacienteId;
  let otroPacienteId;
  let visitaId;
  let visitaOtroPacienteId;
  let estudioId;

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
    clienteId = await crearClienteDemo('95000100');
    pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Paciente Adjuntos' });
    otroPacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Otro Paciente' });

    visitaId = await crearVisitaDemo({ pacienteId, veterinarioId });
    visitaOtroPacienteId = await crearVisitaDemo({
      pacienteId: otroPacienteId,
      veterinarioId,
    });

    const { rows: estudios } = await obtenerPool().query(
      `INSERT INTO registro_estudio (
         paciente_id, tipo_estudio, fecha_pedido, estado, creado_por, actualizado_por
       )
       VALUES ($1, 'Ecografía ficticia', current_date, 'pedido', $2, $2)
       RETURNING id`,
      [pacienteId, veterinarioId],
    );
    estudioId = estudios[0].id;

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  afterAll(async () => {
    await rm(directorioAdjuntos(), { recursive: true, force: true });
  });

  it('sube un PDF, lo lista y lo descarga con sesión', async () => {
    const subida = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', pacienteId)
      .attach('archivo', PDF, { filename: 'informe ficticio.pdf', contentType: 'application/pdf' });

    expect(subida.status).toBe(201);
    expect(subida.body.adjunto.nombreOriginal).toBe('informe ficticio.pdf');
    expect(subida.body.adjunto.tipoMime).toBe('application/pdf');
    expect(subida.body.adjunto.tamanoBytes).toBe(PDF.length);
    expect(subida.body.adjunto.urlDescarga).toContain('/descargar');

    const listado = await agenteRecepcion.get(`/api/adjuntos?pacienteId=${pacienteId}`);
    expect(listado.status).toBe(200);
    expect(listado.body.adjuntos.map((adjunto) => adjunto.id)).toContain(subida.body.adjunto.id);

    const descarga = await agenteRecepcion.get(`/api/adjuntos/${subida.body.adjunto.id}/descargar`);
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain('application/pdf');
    expect(descarga.headers['content-disposition']).toContain('informe');
  });

  it('deduce el paciente desde la visita y desde el estudio', async () => {
    const porVisita = await agenteVet
      .post('/api/adjuntos')
      .field('visitaId', visitaId)
      .attach('archivo', PNG, { filename: 'foto-visita.png', contentType: 'image/png' });

    expect(porVisita.status).toBe(201);
    expect(String(porVisita.body.adjunto.pacienteId)).toBe(String(pacienteId));
    expect(String(porVisita.body.adjunto.visitaId)).toBe(String(visitaId));

    const porEstudio = await agenteVet
      .post('/api/adjuntos')
      .field('estudioId', estudioId)
      .attach('archivo', PDF, { filename: 'resultado.pdf', contentType: 'application/pdf' });

    expect(porEstudio.status).toBe(201);
    expect(String(porEstudio.body.adjunto.pacienteId)).toBe(String(pacienteId));
    expect(String(porEstudio.body.adjunto.estudioId)).toBe(String(estudioId));

    const listado = await agenteVet.get(`/api/adjuntos?estudioId=${estudioId}`);
    expect(listado.status).toBe(200);
    expect(listado.body.adjuntos).toHaveLength(1);
  });

  it('rechaza tipos no permitidos, archivos grandes y falta de archivo', async () => {
    const tipoInvalido = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', pacienteId)
      .attach('archivo', Buffer.from('texto ficticio'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      });

    expect(tipoInvalido.status).toBe(400);
    expect(tipoInvalido.body.error.codigo).toBe('DATOS_INVALIDOS');

    const grande = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', pacienteId)
      .attach('archivo', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      });

    expect(grande.status).toBe(400);
    expect(grande.body.error.detalles[0].mensaje).toContain('10 MB');

    const sinArchivo = await agenteVet.post('/api/adjuntos').field('pacienteId', pacienteId);

    expect(sinArchivo.status).toBe(400);

    const sinFiltro = await agenteVet.get('/api/adjuntos');
    expect(sinFiltro.status).toBe(400);
  });

  it('valida que visita, estudio y paciente pertenezcan al mismo paciente', async () => {
    const respuesta = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', otroPacienteId)
      .field('visitaId', visitaId)
      .attach('archivo', PDF, { filename: 'cruzado.pdf', contentType: 'application/pdf' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CONFLICTO');

    const visitaAjena = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', pacienteId)
      .field('visitaId', visitaOtroPacienteId)
      .attach('archivo', PDF, { filename: 'ajena.pdf', contentType: 'application/pdf' });

    expect(visitaAjena.status).toBe(409);
  });

  it('anula con motivo y recepción no puede anular', async () => {
    const subida = await agenteVet
      .post('/api/adjuntos')
      .field('pacienteId', pacienteId)
      .attach('archivo', PDF, { filename: 'anulable.pdf', contentType: 'application/pdf' });

    const sinMotivo = await agenteVet
      .post(`/api/adjuntos/${subida.body.adjunto.id}/anular`)
      .send({});
    expect(sinMotivo.status).toBe(400);

    const deRecepcion = await agenteRecepcion
      .post(`/api/adjuntos/${subida.body.adjunto.id}/anular`)
      .send({ motivo: 'Intento ficticio' });
    expect(deRecepcion.status).toBe(403);

    const anulado = await agenteVet
      .post(`/api/adjuntos/${subida.body.adjunto.id}/anular`)
      .send({ motivo: 'Archivo equivocado ficticio' });

    expect(anulado.status).toBe(200);
    expect(anulado.body.adjunto.anulado).toBe(true);

    const lista = await agenteVet.get(`/api/adjuntos?pacienteId=${pacienteId}`);
    expect(lista.body.adjuntos.map((adjunto) => adjunto.id)).not.toContain(subida.body.adjunto.id);

    const descarga = await agenteVet.get(`/api/adjuntos/${subida.body.adjunto.id}/descargar`);
    expect(descarga.status).toBe(404);
  });

  it('asigna, descarga, quita y limpia la foto del paciente al anularla', async () => {
    const subida = await agenteRecepcion
      .post(`/api/pacientes/${pacienteId}/foto`)
      .attach('archivo', PNG, { filename: 'foto-paciente.png', contentType: 'image/png' });

    expect(subida.status).toBe(201);
    expect(String(subida.body.paciente.fotoAdjuntoId)).toBe(String(subida.body.adjunto.id));

    const descarga = await agenteRecepcion.get(`/api/adjuntos/${subida.body.adjunto.id}/descargar`);
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain('image/png');

    const quitada = await agenteRecepcion.post(`/api/pacientes/${pacienteId}/foto/quitar`);
    expect(quitada.status).toBe(200);
    expect(quitada.body.paciente.fotoAdjuntoId).toBeNull();

    const sinFoto = await agenteRecepcion.post(`/api/pacientes/${pacienteId}/foto/quitar`);
    expect(sinFoto.status).toBe(409);

    const segunda = await agenteRecepcion
      .post(`/api/pacientes/${pacienteId}/foto`)
      .attach('archivo', PNG, { filename: 'foto-paciente-2.png', contentType: 'image/png' });

    const anulada = await agenteAdmin
      .post(`/api/adjuntos/${segunda.body.adjunto.id}/anular`)
      .send({ motivo: 'Foto reemplazada ficticia' });

    expect(anulada.status).toBe(200);

    const { rows } = await obtenerPool().query(
      'SELECT foto_adjunto_id FROM paciente WHERE id = $1',
      [pacienteId],
    );
    expect(rows[0].foto_adjunto_id).toBeNull();
  });
});
