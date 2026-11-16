import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { hoyEnTucuman } from '../src/utils/fechas.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';
import { crearControlDemo, crearVisitaDemo, sumarDias } from './ayuda/clinica.js';

async function crearCliente({ nombre, apellido, documento, telefono }) {
  const { rows } = await obtenerPool().query(
    `INSERT INTO cliente (
       nombre, apellido, tipo_documento, nro_documento, pais,
       telefono_principal, telefono_es_whatsapp
     )
     VALUES ($1, $2, 'DNI', $3, 'Argentina', $4, true)
     RETURNING id`,
    [nombre, apellido, documento, telefono],
  );
  return rows[0].id;
}

async function crearPaciente(clienteId, especieId, nombre) {
  const { rows } = await obtenerPool().query(
    `INSERT INTO paciente (cliente_id, nombre, especie_id, sexo)
     VALUES ($1, $2, $3, 'macho')
     RETURNING id`,
    [clienteId, nombre, especieId],
  );
  return rows[0].id;
}

async function contarPendientes() {
  const { rows } = await obtenerPool().query(
    `SELECT count(*)::int AS total FROM control WHERE estado = 'pendiente' AND anulado = false`,
  );
  return rows[0].total;
}

describe('asistente de consultas', () => {
  let agenteRecepcion;
  let agenteVet;
  let agenteAdmin;
  let pacienteFirulais;
  let pacienteMichi;
  let controlVencido;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin Prueba',
    });
    const vet = await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Prueba',
    });
    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción Prueba',
    });

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino') RETURNING id`,
    );
    const especieId = especies[0].id;

    const clienteAlfa = await crearCliente({
      nombre: 'Titular Demo Alfa',
      apellido: 'Pérez',
      documento: '93000101',
      telefono: '3815550111',
    });
    const clienteBeta = await crearCliente({
      nombre: 'Titular Demo Beta',
      apellido: 'Gómez',
      documento: '93000102',
      telefono: '3815550222',
    });
    const clienteGamma = await crearCliente({
      nombre: 'Titular Demo Gamma',
      apellido: 'Ruiz',
      documento: '93000103',
      telefono: '3815550333',
    });

    pacienteFirulais = await crearPaciente(clienteAlfa, especieId, 'Firulais Demo');
    pacienteMichi = await crearPaciente(clienteAlfa, especieId, 'Michi Demo');
    await crearPaciente(clienteBeta, especieId, 'Luna Demo');
    await crearPaciente(clienteGamma, especieId, 'Luna Demo');

    const hoy = hoyEnTucuman();
    const ayer = sumarDias(hoy, -1);
    const manana = sumarDias(hoy, 1);
    const haceUnaSemana = sumarDias(hoy, -7);

    const visitaId = await crearVisitaDemo({
      pacienteId: pacienteFirulais,
      veterinarioId: vet.id,
      estado: 'cerrada',
      motivoConsulta: 'Control ficticio de Firulais',
      diagnostico: 'Sin particularidades',
    });

    await obtenerPool().query(
      `UPDATE visita
       SET anamnesis = 'Paciente ficticio sin novedades',
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
       VALUES ($1, 'Medicamento Demo', '1 ml', 'oral', 'Cada 12 horas', 5, $2, $2)`,
      [visitaId, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO registro_vacuna (
         paciente_id, visita_id, vacuna, lote, fecha_aplicacion, fecha_proxima_dosis,
         aplicada_por, creado_por, actualizado_por
       )
       VALUES ($1, $2, 'Vacuna Demo Uno', 'LOTE-1', $3::date, $4::date, $5, $5, $5),
              ($1, $2, 'Vacuna Demo Dos', 'LOTE-2', $6::date, NULL, $5, $5, $5)`,
      [pacienteFirulais, visitaId, hoy, manana, vet.id, haceUnaSemana],
    );

    await obtenerPool().query(
      `INSERT INTO registro_antiparasitario (
         paciente_id, visita_id, producto, tipo, dosis, fecha_aplicacion, fecha_proxima,
         aplicado_por, creado_por, actualizado_por
       )
       VALUES ($1, $2, 'Pipeta Demo', 'externo', '1 pipeta', $3::date, $4::date, $5, $5, $5)`,
      [pacienteFirulais, visitaId, hoy, manana, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO registro_estudio (
         paciente_id, visita_id, tipo_estudio, fecha_pedido, estado,
         fecha_resultado, resultado_resumen, creado_por, actualizado_por
       )
       VALUES ($1, $2, 'Hemograma Demo', $3::date, 'resultado_cargado',
               $3::date, 'Sin particularidades', $4, $4)`,
      [pacienteFirulais, visitaId, hoy, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO registro_cirugia (
         paciente_id, visita_id, tipo_cirugia, fecha_programada, estado,
         cirujano_id, visita_origen_id, creado_por, actualizado_por
       )
       VALUES ($1, $2, 'Castración Demo', $3::date, 'realizada', $4, $2, $4, $4)`,
      [pacienteFirulais, visitaId, hoy, vet.id],
    );

    await obtenerPool().query(
      `INSERT INTO visita_nota (visita_id, texto, autor_id, creado_por, actualizado_por)
       VALUES ($1, 'Nota ficticia de seguimiento', $2, $2, $2)`,
      [visitaId, vet.id],
    );

    const visitaMichi = await crearVisitaDemo({
      pacienteId: pacienteMichi,
      veterinarioId: vet.id,
      estado: 'cerrada',
      motivoConsulta: 'Control ficticio de Michi',
    });

    controlVencido = await crearControlDemo({
      pacienteId: pacienteFirulais,
      visitaOrigenId: visitaId,
      fechaControl: ayer,
      motivo: 'Control vencido Demo',
    });

    await crearControlDemo({
      pacienteId: pacienteFirulais,
      visitaOrigenId: visitaId,
      fechaControl: hoy,
      motivo: 'Control de hoy Demo',
    });

    await crearControlDemo({
      pacienteId: pacienteFirulais,
      visitaOrigenId: visitaId,
      fechaControl: manana,
      motivo: 'Control de mañana Demo',
    });

    await crearControlDemo({
      pacienteId: pacienteMichi,
      visitaOrigenId: visitaMichi,
      fechaControl: hoy,
      motivo: 'Control de Michi Demo',
    });

    agenteAdmin = crearAgente();
    agenteVet = crearAgente();
    agenteRecepcion = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
  });

  it('sin sesión no se puede usar el asistente', async () => {
    const respuesta = await crearAgente()
      .post('/api/asistente/consulta')
      .send({ mensaje: 'vacunas de Firulais Demo' });

    expect(respuesta.status).toBe(401);
  });

  it('recepción consulta las vacunas exactas de una mascota', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'vacunas de Firulais Demo' });

    expect(respuesta.status).toBe(200);

    const { respuesta: datos } = respuesta.body;
    expect(datos.tipo).toBe('listado');
    expect(datos.titulo).toContain('Firulais Demo');
    expect(datos.secciones[0].items.map((item) => item.etiqueta)).toEqual([
      'Vacuna Demo Uno',
      'Vacuna Demo Dos',
    ]);
  });

  it('la última vacuna devuelve solo el registro más reciente', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'última vacuna de Firulais Demo' });

    const items = respuesta.body.respuesta.secciones[0].items;
    expect(items).toHaveLength(1);
    expect(items[0].etiqueta).toBe('Vacuna Demo Uno');
  });

  it('si hay varias mascotas con el mismo nombre ofrece opciones', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'resumen de Luna Demo' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta.tipo).toBe('opciones');
    expect(respuesta.body.respuesta.opciones).toHaveLength(2);
    expect(respuesta.body.respuesta.opciones[0].mensaje).toMatch(/^@paciente:\d+$/);
  });

  it('al elegir una opción resuelve la mascota por id', async () => {
    const opciones = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'resumen de Luna Demo' });

    const elegida = opciones.body.respuesta.opciones[0];
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: elegida.mensaje });

    expect(respuesta.status).toBe(200);
    expect(['ficha_paciente', 'listado']).toContain(respuesta.body.respuesta.tipo);
    expect(respuesta.body.respuesta.titulo).toContain('Luna Demo');
  });

  it('busca titulares por documento y por teléfono, con documento enmascarado', async () => {
    const porDocumento = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'documento 93000101' });

    expect(porDocumento.status).toBe(200);
    expect(porDocumento.body.respuesta.tipo).toBe('ficha_cliente');
    expect(porDocumento.body.respuesta.titulo).toContain('Titular Demo Alfa');
    expect(
      porDocumento.body.respuesta.opciones.some((opcion) => opcion.etiqueta.includes('Firulais')),
    ).toBe(true);
    expect(JSON.stringify(porDocumento.body)).toContain('***.***.101');
    expect(JSON.stringify(porDocumento.body)).not.toContain('93000101');

    const porTelefono = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'teléfono 3815550111' });

    expect(porTelefono.status).toBe(200);
    expect(porTelefono.body.respuesta.titulo).toContain('Titular Demo Alfa');
  });

  it('busca las mascotas de un titular por su nombre', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'mascotas de Demo Alfa' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta.tipo).toBe('ficha_cliente');
    expect(respuesta.body.respuesta.secciones[1].items.map((item) => item.etiqueta)).toEqual(
      expect.arrayContaining(['Firulais Demo', 'Michi Demo']),
    );
  });

  it('muestra los controles pendientes sin cambiar su estado', async () => {
    const antes = await contarPendientes();

    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'controles pendientes' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta.tipo).toBe('listado_controles');
    expect(JSON.stringify(respuesta.body)).toContain('Firulais Demo');
    expect(respuesta.body.respuesta.secciones.map((seccion) => seccion.titulo)).toEqual([
      'Vencidos sin cerrar',
      'Hoy',
      'Próximos',
    ]);

    const despues = await contarPendientes();
    expect(despues).toBe(antes);

    const { rows } = await obtenerPool().query('SELECT estado FROM control WHERE id = $1', [
      controlVencido,
    ]);
    expect(rows[0].estado).toBe('pendiente');
  });

  it('filtra los controles de hoy y de mañana', async () => {
    const hoyRespuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'controles de hoy' });

    expect(hoyRespuesta.status).toBe(200);
    expect(JSON.stringify(hoyRespuesta.body)).toContain('Control de hoy Demo');
    expect(JSON.stringify(hoyRespuesta.body)).not.toContain('Control de mañana Demo');
    expect(JSON.stringify(hoyRespuesta.body)).not.toContain('Control vencido Demo');

    const mananaRespuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'controles de mañana' });

    expect(mananaRespuesta.status).toBe(200);
    expect(JSON.stringify(mananaRespuesta.body)).toContain('Control de mañana Demo');
    expect(JSON.stringify(mananaRespuesta.body)).not.toContain('Control de hoy Demo');
  });

  it('muestra el titular de una mascota sin exponer el documento completo', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'dueño de Firulais Demo' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta.tipo).toBe('ficha_cliente');
    expect(JSON.stringify(respuesta.body)).toContain('Titular Demo Alfa');
    expect(JSON.stringify(respuesta.body)).toContain('3815550111');
    expect(JSON.stringify(respuesta.body)).toContain('Michi Demo');
    expect(JSON.stringify(respuesta.body)).toContain('***.***.101');
    expect(JSON.stringify(respuesta.body)).not.toContain('93000101');
  });

  it('no inventa resultados cuando no hay coincidencias', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/asistente/consulta')
      .send({ mensaje: 'vacunas de Mascota Inexistente' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta.tipo).toBe('sin_datos');
  });

  it('veterinario y admin también pueden usar el asistente', async () => {
    const vet = await agenteVet
      .post('/api/asistente/consulta')
      .send({ mensaje: 'controles de hoy' });
    const admin = await agenteAdmin
      .post('/api/asistente/consulta')
      .send({ mensaje: 'controles de hoy' });

    expect(vet.status).toBe(200);
    expect(admin.status).toBe(200);
  });

  it('rechaza una consulta vacía', async () => {
    const respuesta = await agenteRecepcion.post('/api/asistente/consulta').send({ mensaje: ' ' });

    expect(respuesta.status).toBe(400);
  });
});
