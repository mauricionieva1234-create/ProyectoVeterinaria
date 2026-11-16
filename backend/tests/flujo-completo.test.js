import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { hoyEnTucuman } from '../src/utils/fechas.js';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';

async function contarAuditoria(entidad, entidadId, accion) {
  const { rows } = await obtenerPool().query(
    `SELECT count(*)::int AS total
     FROM auditoria
     WHERE entidad = $1 AND entidad_id = $2 AND accion = $3`,
    [entidad, entidadId, accion],
  );
  return rows[0].total;
}

async function estadoIngreso(ingresoId) {
  const { rows } = await obtenerPool().query('SELECT estado FROM ingreso WHERE id = $1', [
    ingresoId,
  ]);
  return rows[0]?.estado;
}

// Recorrido completo de una atención: recepción busca y crea al cliente, carga
// la mascota y la cola; el veterinario atiende y cierra; recepción cobra en
// caja. Es la prueba de integración de todas las etapas juntas.
describe('flujo completo de atención y cobro', () => {
  let agenteRecepcion;
  let agenteVet;
  let especieId;

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
      `INSERT INTO especie (nombre) VALUES ('canino'), ('felino') RETURNING id, nombre`,
    );
    especieId = especies.find((especie) => especie.nombre === 'canino').id;

    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('atiende un paciente desde el alta hasta el pago y el cierre de caja', async () => {
    const creado = await agenteRecepcion.post('/api/clientes').send({
      nombre: 'Flujo',
      apellido: 'Completo',
      tipoDocumento: 'DNI',
      nroDocumento: '95000123',
      telefonoPrincipal: '3815550123',
      telefonoEsWhatsapp: true,
      calleNumero: 'Calle Ficticia 123',
      localidadBarrio: 'Centro',
      provincia: 'Tucumán',
      pais: 'Argentina',
      aceptaCorreo: false,
      aceptaWhatsapp: true,
      observaciones: 'Datos ficticios de la prueba de flujo completo.',
    });

    expect(creado.status).toBe(201);
    const clienteId = creado.body.cliente.id;

    // La búsqueda por apellido y nombre en cualquier orden encuentra al cliente.
    const busqueda = await agenteRecepcion.get('/api/clientes?buscar=Completo%20Flujo');
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.datos.some((fila) => String(fila.id) === String(clienteId))).toBe(true);

    const paciente = await agenteRecepcion.post('/api/pacientes').send({
      clienteId,
      nombre: 'Mascota del Flujo',
      especieId,
      razaId: null,
      sexo: 'hembra',
      castrado: false,
      fechaNacimiento: '2021-04-15',
      nacimientoAproximado: false,
      esReproductor: false,
      provisorio: false,
      color: 'Marrón',
      comentario: 'Paciente ficticio de la prueba de flujo completo.',
    });

    expect(paciente.status).toBe(201);
    const pacienteId = paciente.body.paciente.id;

    const ingreso = await agenteRecepcion.post('/api/cola').send({
      pacienteId,
      servicio: 'atencion_clinica',
      comentario: 'Llegó a la consulta ficticia.',
    });

    expect(ingreso.status).toBe(201);
    expect(ingreso.body.ingreso.numeroOrden).toBe(1);
    const ingresoId = ingreso.body.ingreso.id;

    const consultorio = await agenteVet.patch(`/api/cola/${ingresoId}/consultorio`);
    expect(consultorio.status).toBe(200);

    const visita = await agenteVet.post('/api/visitas').send({
      pacienteId,
      ingresoId,
      motivoConsulta: 'Revisión general ficticia',
    });

    expect(visita.status).toBe(201);
    const visitaId = visita.body.visita.id;
    expect(visita.body.visita.ingreso.estado).toBe('en_consulta');

    const editada = await agenteVet
      .patch(`/api/visitas/${visitaId}`)
      .send({ diagnostico: 'Sin particularidades ficticias', pesoKg: 12.5 });
    expect(editada.status).toBe(200);

    const cerrada = await agenteVet
      .post(`/api/visitas/${visitaId}/cerrar`)
      .send({ motivoConsulta: 'Cierre ficticio de la consulta' });

    expect(cerrada.status).toBe(200);
    expect(cerrada.body.visita.estado).toBe('cerrada');
    expect(await estadoIngreso(ingresoId)).toBe('esperando_cobro');

    const pendientes = await agenteRecepcion.get('/api/cobros/pendientes');
    expect(pendientes.status).toBe(200);
    expect(
      pendientes.body.pendientes.some((fila) => String(fila.ingresoId) === String(ingresoId)),
    ).toBe(true);

    const cobro = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 12000,
      observaciones: 'Cobro ficticio de la consulta',
    });

    expect(cobro.status).toBe(201);
    const cobroId = cobro.body.cobro.id;

    const parcial = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 5000,
    });

    expect(parcial.status).toBe(201);
    expect(parcial.body.cobro.estado).toBe('parcial');
    expect(parcial.body.cobro.saldo).toBe(7000);

    const total = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'debito',
      monto: 7000,
    });

    expect(total.status).toBe(201);
    expect(total.body.cobro.estado).toBe('pagado');
    expect(total.body.cobro.saldo).toBe(0);
    expect(await estadoIngreso(ingresoId)).toBe('atendido');

    const detalle = await agenteRecepcion.get(`/api/cobros/${cobroId}`);
    expect(detalle.body.cobro.pagos).toHaveLength(2);

    const caja = await agenteRecepcion.get(`/api/cobros/caja?fecha=${hoyEnTucuman()}`);
    expect(caja.status).toBe(200);
    expect(caja.body.caja.totalCobrado).toBe(12000);
    expect(caja.body.caja.cantidadPagos).toBe(2);
    expect(caja.body.caja.deudaTotal).toBe(0);

    const porMedio = new Map(caja.body.caja.porMedio.map((fila) => [fila.medio, fila.total]));
    expect(porMedio.get('efectivo')).toBe(5000);
    expect(porMedio.get('debito')).toBe(7000);

    // Toda la cadena queda auditada.
    expect(await contarAuditoria('cliente', clienteId, 'crear')).toBe(1);
    expect(await contarAuditoria('paciente', pacienteId, 'crear')).toBe(1);
    expect(await contarAuditoria('ingreso', ingresoId, 'crear')).toBe(1);
    expect(await contarAuditoria('visita', visitaId, 'editar')).toBeGreaterThan(0);
    expect(await contarAuditoria('cobro', cobroId, 'crear')).toBe(1);
    expect(await contarAuditoria('pago', parcial.body.pago.id, 'crear')).toBe(1);
    expect(await contarAuditoria('pago', total.body.pago.id, 'crear')).toBe(1);
  });
});
