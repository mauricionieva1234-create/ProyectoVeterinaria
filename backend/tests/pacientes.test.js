import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';

function datosPaciente(extra = {}) {
  return {
    clienteId: null,
    nombre: 'Mascota de Prueba',
    especieId: null,
    razaId: null,
    sexo: 'hembra',
    castrado: false,
    fechaNacimiento: '2021-04-15',
    nacimientoAproximado: false,
    esReproductor: false,
    provisorio: false,
    color: 'Marrón',
    comentario: 'Paciente ficticio de prueba.',
    ...extra,
  };
}

async function contarAuditoria(entidad, entidadId, accion) {
  const { rows } = await obtenerPool().query(
    `SELECT count(*)::int AS total
     FROM auditoria
     WHERE entidad = $1 AND entidad_id = $2 AND accion = $3`,
    [entidad, entidadId, accion],
  );
  return rows[0].total;
}

describe('pacientes', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let clienteId;
  let otroClienteId;
  let especieId;
  let razaId;
  let otraRazaId;

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

    const { rows: clientes } = await obtenerPool().query(
      `INSERT INTO cliente (nombre, apellido, tipo_documento, nro_documento, telefono_principal)
       VALUES ('Cliente', 'Uno', 'DNI', '91000001', '3815551001'),
              ('Cliente', 'Dos', 'DNI', '91000002', '3815551002')
       RETURNING id`,
    );
    clienteId = clientes[0].id;
    otroClienteId = clientes[1].id;

    const { rows: especies } = await obtenerPool().query(
      `INSERT INTO especie (nombre) VALUES ('canino'), ('felino') RETURNING id, nombre`,
    );
    especieId = especies.find((especie) => especie.nombre === 'canino').id;
    const otraEspecieId = especies.find((especie) => especie.nombre === 'felino').id;

    const { rows: razas } = await obtenerPool().query(
      `INSERT INTO raza (especie_id, nombre)
       VALUES ($1, 'Mestizo'), ($2, 'Otra')
       RETURNING id, especie_id`,
      [especieId, otraEspecieId],
    );
    razaId = razas.find((raza) => raza.especie_id === especieId).id;
    otraRazaId = razas.find((raza) => raza.especie_id === otraEspecieId).id;

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea un paciente con código interno, historial y auditoría', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId, nombre: 'Mascota Uno', especieId, razaId }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.paciente.codigoInterno).toBe('PAC-000001');
    expect(respuesta.body.paciente.fichaIncompleta).toBe(false);

    const id = respuesta.body.paciente.id;
    expect(await contarAuditoria('paciente', id, 'crear')).toBe(1);

    const detalle = await agenteVet.get(`/api/pacientes/${id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.paciente.cliente.id).toBe(clienteId);
    expect(detalle.body.paciente.historial).toHaveLength(1);
    expect(detalle.body.paciente.historial[0].hasta).toBeNull();
  });

  it('rechaza una raza que no pertenece a la especie', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId, especieId, razaId: otraRazaId }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].campo).toBe('razaId');
  });

  it('rechaza un cliente inexistente', async () => {
    const respuesta = await agenteRecepcion
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId: 999999, especieId, razaId }));

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('al cambiar de dueño cierra el historial anterior y abre uno nuevo', async () => {
    const creado = await agenteRecepcion
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId, nombre: 'Mascota con Dos Dueños', especieId, razaId }));

    const editado = await agenteRecepcion.put(`/api/pacientes/${creado.body.paciente.id}`).send(
      datosPaciente({
        clienteId: otroClienteId,
        nombre: 'Mascota con Dos Dueños',
        especieId,
        razaId,
      }),
    );

    expect(editado.status).toBe(200);
    expect(editado.body.paciente.clienteId).toBe(otroClienteId);

    const detalle = await agenteVet.get(`/api/pacientes/${creado.body.paciente.id}`);
    expect(detalle.body.paciente.historial).toHaveLength(2);

    const abiertos = detalle.body.paciente.historial.filter((fila) => fila.hasta === null);
    const cerrados = detalle.body.paciente.historial.filter((fila) => fila.hasta !== null);

    expect(abiertos).toHaveLength(1);
    expect(abiertos[0].clienteId).toBe(otroClienteId);
    expect(cerrados).toHaveLength(1);
    expect(cerrados[0].clienteId).toBe(clienteId);

    expect(await contarAuditoria('paciente', creado.body.paciente.id, 'editar')).toBe(1);
  });

  it('recalcula la ficha incompleta al editar los datos que faltaban', async () => {
    const creado = await agenteRecepcion.post('/api/pacientes').send(
      datosPaciente({
        clienteId,
        nombre: 'Mascota sin Datos',
        especieId,
        razaId: null,
        fechaNacimiento: null,
      }),
    );

    expect(creado.status).toBe(201);
    expect(creado.body.paciente.fichaIncompleta).toBe(true);

    const editado = await agenteRecepcion
      .put(`/api/pacientes/${creado.body.paciente.id}`)
      .send(datosPaciente({ clienteId, nombre: 'Mascota sin Datos', especieId, razaId }));

    expect(editado.status).toBe(200);
    expect(editado.body.paciente.fichaIncompleta).toBe(false);
  });

  it('rechaza una fecha de deceso anterior al nacimiento', async () => {
    const respuesta = await agenteRecepcion.post('/api/pacientes').send(
      datosPaciente({
        clienteId,
        nombre: 'Mascota con Fechas Inválidas',
        especieId,
        razaId,
        fechaNacimiento: '2022-01-01',
        fechaDeceso: '2021-01-01',
      }),
    );

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].campo).toBe('fechaDeceso');
  });

  it('lista los pacientes de un cliente y busca por nombre', async () => {
    const lista = await agenteVet.get(`/api/pacientes?clienteId=${clienteId}`);
    expect(lista.status).toBe(200);
    expect(lista.body.datos.length).toBeGreaterThan(0);

    const busqueda = await agenteVet.get(`/api/pacientes?clienteId=${clienteId}&buscar=sin datos`);
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.datos).toHaveLength(1);
    expect(busqueda.body.datos[0].nombre).toBe('Mascota sin Datos');
  });

  it('permite crear pacientes a recepción y veterinario', async () => {
    const deRecepcion = await agenteRecepcion
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId, nombre: 'Mascota de Recepción', especieId, razaId }));

    const deVeterinario = await agenteVet
      .post('/api/pacientes')
      .send(datosPaciente({ clienteId, nombre: 'Mascota de Veterinario', especieId, razaId }));

    expect(deRecepcion.status).toBe(201);
    expect(deVeterinario.status).toBe(201);
  });
});
