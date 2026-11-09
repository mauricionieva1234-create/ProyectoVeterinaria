import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';

function datosCliente(extra = {}) {
  return {
    nombre: 'Cliente',
    apellido: 'Prueba',
    tipoDocumento: 'DNI',
    nroDocumento: '90000001',
    telefonoPrincipal: '381 555 0001',
    telefonoEsWhatsapp: true,
    email: 'cliente.prueba@example.com',
    calleNumero: 'Calle Ficticia 123',
    localidadBarrio: 'Centro',
    provincia: 'Tucumán',
    pais: 'Argentina',
    aceptaCorreo: false,
    aceptaWhatsapp: true,
    observaciones: 'Cliente de prueba, datos inventados.',
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

describe('clientes', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let especieId;
  let razaId;

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
      `INSERT INTO especie (nombre) VALUES ('canino') RETURNING id`,
    );
    especieId = especies[0].id;

    const { rows: razas } = await obtenerPool().query(
      `INSERT INTO raza (especie_id, nombre) VALUES ($1, 'Mestizo') RETURNING id`,
      [especieId],
    );
    razaId = razas[0].id;

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea un cliente con ficha completa y registra la auditoría', async () => {
    const respuesta = await agenteRecepcion.post('/api/clientes').send(datosCliente());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cliente.nroDocumento).toBe('90000001');
    expect(respuesta.body.cliente.telefonoPrincipal).toBe('3815550001');
    expect(respuesta.body.cliente.fichaIncompleta).toBe(false);

    expect(await contarAuditoria('cliente', respuesta.body.cliente.id, 'crear')).toBe(1);
  });

  it('avisa por documento duplicado y permite confirmar el alta igual', async () => {
    const aviso = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ apellido: 'Duplicado' }));

    expect(aviso.status).toBe(409);
    expect(aviso.body.error.codigo).toBe('CLIENTE_DUPLICADO');
    expect(aviso.body.error.detalles[0].candidatos).toHaveLength(1);
    expect(aviso.body.error.detalles[0].candidatos[0].nroDocumento).toMatch(/^\*\*\*\.\*\*\*\./);

    const confirmado = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ apellido: 'Duplicado', confirmarDuplicado: true }));

    expect(confirmado.status).toBe(201);
    expect(confirmado.body.cliente.apellido).toBe('Duplicado');
  });

  it('busca clientes por documento y teléfono antes del alta', async () => {
    const porDocumento = await agenteRecepcion.get('/api/clientes/buscar?documento=90.000.001');

    expect(porDocumento.status).toBe(200);
    expect(porDocumento.body.datos.length).toBeGreaterThan(0);
    expect(porDocumento.body.datos[0].coincidePor).toContain('documento');

    const porTelefono = await agenteRecepcion.get('/api/clientes/buscar?telefono=381-555-0001');

    expect(porTelefono.body.datos.length).toBeGreaterThan(0);
    expect(porTelefono.body.datos[0].coincidePor).toContain('telefono');
  });

  it('enmascara el documento en los listados', async () => {
    const lista = await agenteVet.get('/api/clientes?buscar=90000001');

    expect(lista.status).toBe(200);
    expect(lista.body.datos.length).toBeGreaterThan(0);
    expect(lista.body.datos[0].nroDocumento).toMatch(/^\*\*\*\.\*\*\*\.\d{3}$/);
  });

  it('muestra el documento completo en la ficha y audita el dato sensible', async () => {
    const lista = await agenteVet.get('/api/clientes?buscar=90000001');
    const id = lista.body.datos[0].id;

    const detalle = await agenteVet.get(`/api/clientes/${id}`);

    expect(detalle.status).toBe(200);
    expect(detalle.body.cliente.nroDocumento).toBe('90000001');
    expect(await contarAuditoria('cliente', id, 'ver_sensible')).toBeGreaterThan(0);
  });

  it('lista las fichas incompletas con quién las creó', async () => {
    const creado = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ nroDocumento: '90000099', telefonoPrincipal: '' }));

    expect(creado.status).toBe(201);
    expect(creado.body.cliente.fichaIncompleta).toBe(true);

    const lista = await agenteRecepcion.get('/api/clientes/fichas-incompletas');
    const encontrado = lista.body.datos.find((cliente) => cliente.id === creado.body.cliente.id);

    expect(encontrado).toBeDefined();
    expect(encontrado.creadoPorNombre).toBe('Recepción Prueba');
  });

  it('completa la ficha al editar el teléfono y audita el cambio', async () => {
    const creado = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ nroDocumento: '90000098', telefonoPrincipal: '' }));

    const editado = await agenteRecepcion
      .put(`/api/clientes/${creado.body.cliente.id}`)
      .send(datosCliente({ nroDocumento: '90000098', telefonoPrincipal: '3815550098' }));

    expect(editado.status).toBe(200);
    expect(editado.body.cliente.fichaIncompleta).toBe(false);
    expect(await contarAuditoria('cliente', creado.body.cliente.id, 'editar')).toBe(1);
  });

  it('une clientes duplicados solo con permiso de admin', async () => {
    const duplicado = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ nombre: 'Duplicado', nroDocumento: '90000101' }));

    const conservado = await agenteRecepcion
      .post('/api/clientes')
      .send(datosCliente({ nombre: 'Conservado', nroDocumento: '90000102' }));

    const paciente = await agenteRecepcion.post('/api/pacientes').send({
      clienteId: duplicado.body.cliente.id,
      nombre: 'Mascota de Prueba',
      especieId,
      razaId,
      sexo: 'macho',
    });

    expect(paciente.status).toBe(201);

    const sinPermiso = await agenteVet
      .post(`/api/clientes/${duplicado.body.cliente.id}/unir`)
      .send({ clienteConservadoId: conservado.body.cliente.id });

    expect(sinPermiso.status).toBe(403);

    const union = await agenteAdmin
      .post(`/api/clientes/${duplicado.body.cliente.id}/unir`)
      .send({ clienteConservadoId: conservado.body.cliente.id });

    expect(union.status).toBe(200);
    expect(union.body.pacientesReasignados).toBe(1);

    const fichaPaciente = await agenteAdmin.get(`/api/pacientes/${paciente.body.paciente.id}`);
    expect(fichaPaciente.body.paciente.clienteId).toBe(conservado.body.cliente.id);

    const fichaDuplicado = await agenteAdmin.get(`/api/clientes/${duplicado.body.cliente.id}`);
    expect(fichaDuplicado.body.cliente.fusionadoEnClienteId).toBe(conservado.body.cliente.id);
    expect(await contarAuditoria('cliente', duplicado.body.cliente.id, 'unir')).toBe(1);
  });
});
