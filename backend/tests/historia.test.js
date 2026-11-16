import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';
import {
  crearClienteDemo,
  crearControlDemo,
  crearPacienteDemo,
  crearVisitaDemo,
} from './ayuda/clinica.js';

async function contarExportaciones(pacienteId) {
  const { rows } = await obtenerPool().query(
    `SELECT count(*)::int AS total
     FROM auditoria
     WHERE entidad = 'paciente' AND entidad_id = $1 AND accion = 'exportar'`,
    [pacienteId],
  );
  return rows[0].total;
}

describe('historia clínica', () => {
  let agenteRecepcion;
  let agenteVet;
  let pacienteId;
  let visitaId;

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

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino') RETURNING id`,
    );
    const especieId = especies[0].id;

    const clienteId = await crearClienteDemo('93000100');
    pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre: 'Luna Demo' });
    visitaId = await crearVisitaDemo({
      pacienteId,
      veterinarioId: vet.id,
      estado: 'cerrada',
      motivoConsulta: 'Control ficticio',
      diagnostico: 'Sin particularidades',
    });

    await obtenerPool().query(
      `UPDATE visita
       SET anamnesis = 'Paciente ficticia sin novedades',
           temperatura_c = 38.5,
           peso_kg = 12.4
       WHERE id = $1`,
      [visitaId],
    );

    await obtenerPool().query(
      `INSERT INTO medicacion (
         visita_id, medicamento, dosis, via, frecuencia, duracion_dias,
         creado_por, actualizado_por
       )
       VALUES ($1, 'Medicamento demo', '1 ml', 'oral', 'Cada 12 horas', 5, $2, $2)`,
      [visitaId, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO visita_nota (visita_id, texto, autor_id, creado_por, actualizado_por)
       VALUES ($1, 'Nota ficticia de seguimiento', $2, $2, $2)`,
      [visitaId, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO registro_vacuna (
         paciente_id, visita_id, vacuna, fecha_aplicacion, aplicada_por,
         creado_por, actualizado_por
       )
       VALUES ($1, $2, 'Vacuna demo', current_date, $3, $3, $3)`,
      [pacienteId, visitaId, vet.id],
    );

    const controlId = await crearControlDemo({
      pacienteId,
      visitaOrigenId: visitaId,
      motivo: 'Control ficticio',
    });

    await obtenerPool().query(
      `INSERT INTO aviso_control (
         control_id, canal, resultado, nota, realizado_por,
         creado_por, actualizado_por
       )
       VALUES ($1, 'llamada', 'avisado', 'Aviso ficticio', $2, $2, $2)`,
      [controlId, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO archivo_adjunto (
         paciente_id, nombre_original, tipo_mime, tamano_bytes, ruta_almacenamiento,
         subido_por, creado_por, actualizado_por
       )
       VALUES ($1, 'estudio-demo.pdf', 'application/pdf', 1024, 'demo.pdf', $2, $2, $2)`,
      [pacienteId, vet.id],
    );

    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('recepción lee la historia clínica completa', async () => {
    const respuesta = await agenteRecepcion.get(`/api/pacientes/${pacienteId}/historia-clinica`);

    expect(respuesta.status).toBe(200);

    const { historia } = respuesta.body;
    expect(historia.paciente.nombre).toBe('Luna Demo');
    expect(historia.visitas).toHaveLength(1);
    expect(historia.visitas[0].anamnesis).toBe('Paciente ficticia sin novedades');
    expect(historia.visitas[0].diagnostico).toBe('Sin particularidades');
    expect(historia.visitas[0].medicacion).toHaveLength(1);
    expect(historia.visitas[0].notas).toHaveLength(1);
    expect(historia.registros.vacunas).toHaveLength(1);
    expect(historia.controles).toHaveLength(1);
    expect(historia.controles[0].avisos).toHaveLength(1);
    expect(historia.adjuntos).toHaveLength(1);
  });

  it('el veterinario también puede leerla y la historia inexistente da 404', async () => {
    const propia = await agenteVet.get(`/api/pacientes/${pacienteId}/historia-clinica`);
    expect(propia.status).toBe(200);

    const inexistente = await agenteVet.get('/api/pacientes/999999/historia-clinica');
    expect(inexistente.status).toBe(404);
  });

  it('sin sesión no se puede leer ni exportar', async () => {
    const lectura = await crearAgente().get(`/api/pacientes/${pacienteId}/historia-clinica`);
    expect(lectura.status).toBe(401);

    const exportacion = await crearAgente()
      .post(`/api/pacientes/${pacienteId}/historia-clinica/exportar`)
      .send({ entregadoA: 'Titular ficticio', documentoVerificado: true });
    expect(exportacion.status).toBe(401);
  });

  it('recepción exporta la historia y la entrega queda auditada', async () => {
    const respuesta = await agenteRecepcion
      .post(`/api/pacientes/${pacienteId}/historia-clinica/exportar`)
      .send({ entregadoA: 'Titular ficticio, DNI 00000000', documentoVerificado: true });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.historia.paciente.nombre).toBe('Luna Demo');
    expect(await contarExportaciones(pacienteId)).toBe(1);

    const { rows } = await obtenerPool().query(
      `SELECT despues FROM auditoria
       WHERE entidad = 'paciente' AND entidad_id = $1 AND accion = 'exportar'`,
      [pacienteId],
    );
    expect(rows[0].despues.entregadoA).toBe('Titular ficticio, DNI 00000000');
    expect(rows[0].despues.documentoVerificado).toBe(true);
  });

  it('no se exporta sin confirmar la verificación del documento', async () => {
    const respuesta = await agenteRecepcion
      .post(`/api/pacientes/${pacienteId}/historia-clinica/exportar`)
      .send({ entregadoA: 'Titular ficticio', documentoVerificado: false });

    expect(respuesta.status).toBe(400);
    expect(await contarExportaciones(pacienteId)).toBe(1);
  });

  it('recepción sigue sin poder crear ni editar nada clínico', async () => {
    const visita = await agenteRecepcion.post('/api/visitas').send({
      pacienteId,
      motivoConsulta: 'Intento ficticio',
    });
    expect(visita.status).toBe(403);

    const registro = await agenteRecepcion.post('/api/registros/vacuna').send({
      pacienteId,
      vacuna: 'Vacuna ficticia',
      fechaAplicacion: '2026-01-01',
    });
    expect(registro.status).toBe(403);

    const vacunaId = (
      await obtenerPool().query('SELECT id FROM registro_vacuna WHERE paciente_id = $1', [
        pacienteId,
      ])
    ).rows[0].id;

    const anulacion = await agenteRecepcion
      .post(`/api/registros/vacuna/${vacunaId}/anular`)
      .send({ motivo: 'Intento ficticio' });
    expect(anulacion.status).toBe(403);
  });
});
