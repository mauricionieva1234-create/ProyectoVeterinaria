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
  crearIngresoDemo,
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

async function estadoIngreso(ingresoId) {
  const { rows } = await obtenerPool().query('SELECT estado FROM ingreso WHERE id = $1', [
    ingresoId,
  ]);
  return rows[0]?.estado;
}

describe('cobros y caja', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let veterinarioId;
  let especieId;
  let clienteId;

  async function crearVisitaCerrada({
    nombre = 'Paciente Cobro',
    conIngreso = true,
    estadoIngresoInicial = 'esperando_cobro',
  } = {}) {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, { nombre });
    const ingresoId = conIngreso
      ? await crearIngresoDemo(pacienteId, { estado: estadoIngresoInicial })
      : null;
    const visitaId = await crearVisitaDemo({
      pacienteId,
      veterinarioId,
      ingresoId,
      estado: 'cerrada',
    });

    return { pacienteId, ingresoId, visitaId };
  }

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
      `INSERT INTO especie (nombre) VALUES ('canino'), ('felino') RETURNING id, nombre`,
    );
    especieId = especies.find((fila) => fila.nombre === 'canino').id;
    clienteId = await crearClienteDemo('93000100');

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('al cerrar la visita el ingreso espera el cobro y aparece en pendientes', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, {
      nombre: 'Paciente Cierre',
    });
    const ingresoId = await crearIngresoDemo(pacienteId, { estado: 'en_consulta' });

    const creada = await agenteVet.post('/api/visitas').send({
      pacienteId,
      ingresoId,
      motivoConsulta: 'Consulta ficticia de control',
    });
    expect(creada.status).toBe(201);

    const cerrada = await agenteVet
      .post(`/api/visitas/${creada.body.visita.id}/cerrar`)
      .send({ motivoConsulta: 'Cierre ficticio de la consulta' });

    expect(cerrada.status).toBe(200);
    expect(cerrada.body.visita.ingreso.estado).toBe('esperando_cobro');
    expect(await estadoIngreso(ingresoId)).toBe('esperando_cobro');

    const pendientes = await agenteRecepcion.get('/api/cobros/pendientes');
    expect(pendientes.status).toBe(200);
    expect(pendientes.body.pendientes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          origen: 'ingreso',
          ingresoId,
          visitaId: creada.body.visita.id,
        }),
      ]),
    );

    const cobro = await agenteRecepcion.post('/api/cobros').send({
      visitaId: creada.body.visita.id,
      total: 15000,
      observaciones: 'Consulta ficticia',
    });

    expect(cobro.status).toBe(201);
    expect(cobro.body.cobro.estado).toBe('pendiente');
    expect(cobro.body.cobro.total).toBe(15000);
    expect(cobro.body.cobro.pagado).toBe(0);
    expect(cobro.body.cobro.saldo).toBe(15000);
    expect(cobro.body.cobro.paciente.nombre).toBe('Paciente Cierre');

    expect(await contarAuditoriaAccion('cobro', cobro.body.cobro.id, 'crear')).toBe(1);

    const despues = await agenteRecepcion.get('/api/cobros/pendientes');
    expect(despues.body.pendientes.some((fila) => fila.visitaId === creada.body.visita.id)).toBe(
      false,
    );
  });

  it('registra pagos parciales y al completar el total pasa el ingreso a atendido', async () => {
    const { ingresoId, visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Pagos' });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 10000,
    });
    const cobroId = creado.body.cobro.id;

    const parcial = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 4000,
    });

    expect(parcial.status).toBe(201);
    expect(parcial.body.cobro.estado).toBe('parcial');
    expect(parcial.body.cobro.pagado).toBe(4000);
    expect(parcial.body.cobro.saldo).toBe(6000);
    expect(await estadoIngreso(ingresoId)).toBe('esperando_cobro');
    expect(await contarAuditoriaAccion('pago', parcial.body.pago.id, 'crear')).toBe(1);

    const total = await agenteVet.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'debito',
      monto: 6000,
    });

    expect(total.status).toBe(201);
    expect(total.body.cobro.estado).toBe('pagado');
    expect(total.body.cobro.pagado).toBe(10000);
    expect(total.body.cobro.saldo).toBe(0);
    expect(await estadoIngreso(ingresoId)).toBe('atendido');

    const detalle = await agenteRecepcion.get(`/api/cobros/${cobroId}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.cobro.pagos).toHaveLength(2);
    expect(detalle.body.cobro.pagos.map((pago) => pago.medio)).toEqual(['efectivo', 'debito']);
  });

  it('rechaza sobrepagos, montos inválidos, medios desconocidos y cobros duplicados', async () => {
    const { visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Errores' });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 5000,
    });
    const cobroId = creado.body.cobro.id;

    const sobrepago = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 6000,
    });
    expect(sobrepago.status).toBe(400);
    expect(sobrepago.body.error.codigo).toBe('DATOS_INVALIDOS');

    const montoCero = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 0,
    });
    expect(montoCero.status).toBe(400);

    const medioInvalido = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'cheque',
      monto: 1000,
    });
    expect(medioInvalido.status).toBe(400);

    const duplicado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 9000,
    });
    expect(duplicado.status).toBe(409);

    const abiertaPaciente = await crearPacienteDemo(clienteId, especieId, {
      nombre: 'Paciente Abierto',
    });
    const visitaAbierta = await crearVisitaDemo({
      pacienteId: abiertaPaciente,
      veterinarioId,
      estado: 'borrador',
    });
    const abierta = await agenteRecepcion.post('/api/cobros').send({
      visitaId: visitaAbierta,
      total: 1000,
    });
    expect(abierta.status).toBe(409);

    const inexistente = await agenteRecepcion.post('/api/cobros').send({
      visitaId: 999999,
      total: 1000,
    });
    expect(inexistente.status).toBe(404);

    const detalle = await agenteRecepcion.get(`/api/cobros/${cobroId}`);
    expect(detalle.body.cobro.cantidadPagos).toBe(0);
  });

  it('permite un cobro sin cargo con observación y cierra el ingreso', async () => {
    const { ingresoId, visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Sin Cargo' });

    const sinCargo = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 0,
      observaciones: 'Cortesía ficticia de control',
    });

    expect(sinCargo.status).toBe(201);
    expect(sinCargo.body.cobro.estado).toBe('pagado');
    expect(sinCargo.body.cobro.total).toBe(0);
    expect(sinCargo.body.cobro.saldo).toBe(0);
    expect(await estadoIngreso(ingresoId)).toBe('atendido');

    const { visitaId: otraVisita } = await crearVisitaCerrada({
      nombre: 'Paciente Sin Observación',
    });
    const sinObservacion = await agenteRecepcion.post('/api/cobros').send({
      visitaId: otraVisita,
      total: 0,
    });
    expect(sinObservacion.status).toBe(400);
  });

  it('solo el admin anula pagos y la deuda vuelve a aparecer', async () => {
    const { visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Anulación Pago' });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 8000,
    });
    const cobroId = creado.body.cobro.id;

    const pago = await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 8000,
    });
    const pagoId = pago.body.pago.id;
    expect(pago.body.cobro.estado).toBe('pagado');

    const sinPermiso = await agenteRecepcion
      .post(`/api/cobros/${cobroId}/pagos/${pagoId}/anular`)
      .send({ motivo: 'Prueba de permiso' });
    expect(sinPermiso.status).toBe(403);

    const anulado = await agenteAdmin
      .post(`/api/cobros/${cobroId}/pagos/${pagoId}/anular`)
      .send({ motivo: 'Pago cargado por error en la prueba' });

    expect(anulado.status).toBe(200);
    expect(anulado.body.pago.anulado).toBe(true);
    expect(anulado.body.cobro.estado).toBe('pendiente');
    expect(anulado.body.cobro.pagado).toBe(0);
    expect(anulado.body.cobro.saldo).toBe(8000);
    expect(await contarAuditoriaAccion('pago', pagoId, 'anular')).toBe(1);

    const deudas = await agenteRecepcion.get('/api/cobros/deudas');
    expect(deudas.status).toBe(200);
    expect(deudas.body.datos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: cobroId, saldo: 8000 })]),
    );
  });

  it('no permite anular un cobro con pagos activos y libera la visita al anularlo', async () => {
    const { visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Anulación Cobro' });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 3000,
    });
    const cobroId = creado.body.cobro.id;

    await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 1000,
    });

    const conPagos = await agenteAdmin
      .post(`/api/cobros/${cobroId}/anular`)
      .send({ motivo: 'Intento con pagos activos' });
    expect(conPagos.status).toBe(409);

    const { visitaId: otraVisita } = await crearVisitaCerrada({
      nombre: 'Paciente Cobro Anulado',
    });
    const otro = await agenteRecepcion.post('/api/cobros').send({
      visitaId: otraVisita,
      total: 3000,
    });
    const otroId = otro.body.cobro.id;

    const sinPermiso = await agenteRecepcion
      .post(`/api/cobros/${otroId}/anular`)
      .send({ motivo: 'Prueba de permiso' });
    expect(sinPermiso.status).toBe(403);

    const anulado = await agenteAdmin
      .post(`/api/cobros/${otroId}/anular`)
      .send({ motivo: 'Cobro generado por error en la prueba' });
    expect(anulado.status).toBe(200);
    expect(anulado.body.cobro.anulado).toBe(true);

    const recreado = await agenteRecepcion.post('/api/cobros').send({
      visitaId: otraVisita,
      total: 2500,
    });
    expect(recreado.status).toBe(201);
    expect(recreado.body.cobro.visitaId).toBe(otraVisita);
  });

  it('corrige el total sin dejarlo por debajo de lo pagado', async () => {
    const { ingresoId, visitaId } = await crearVisitaCerrada({
      nombre: 'Paciente Corrección',
    });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 5000,
    });
    const cobroId = creado.body.cobro.id;

    await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 2000,
    });

    const menor = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      total: 1500,
      motivoCambio: 'Corrección ficticia del total',
    });
    expect(menor.status).toBe(409);

    const mayor = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      total: 7000,
      motivoCambio: 'Se agregó un servicio ficticio',
    });
    expect(mayor.status).toBe(200);
    expect(mayor.body.cobro.estado).toBe('parcial');
    expect(mayor.body.cobro.saldo).toBe(5000);

    const sinMotivo = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      total: 8000,
    });
    expect(sinMotivo.status).toBe(400);

    const saldado = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      total: 2000,
      motivoCambio: 'Ajuste ficticio al total pagado',
    });
    expect(saldado.status).toBe(200);
    expect(saldado.body.cobro.estado).toBe('pagado');
    expect(saldado.body.cobro.saldo).toBe(0);
    expect(await estadoIngreso(ingresoId)).toBe('atendido');
    expect(await contarAuditoriaAccion('cobro', cobroId, 'editar')).toBe(2);
  });

  it('cobra con ítems, calcula el total y conserva el snapshot del precio', async () => {
    const precio = await agenteAdmin.post('/api/precios').send({
      nombre: 'Consulta detallada ficticia',
      importe: 10000,
    });
    expect(precio.status).toBe(201);

    const precioId = precio.body.precio.id;
    const { visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Detalle' });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      items: [
        {
          precioId,
          nombre: 'Consulta detallada ficticia',
          cantidad: 1,
          importeUnitario: 10000,
        },
        {
          precioId: null,
          nombre: 'Concepto manual ficticio',
          cantidad: 2,
          importeUnitario: 2500,
        },
        {
          precioId,
          nombre: 'Consulta con ajuste ficticio',
          cantidad: 1,
          importeUnitario: 9500,
        },
      ],
    });

    expect(creado.status).toBe(201);
    expect(creado.body.cobro.total).toBe(24500);
    expect(creado.body.cobro.estado).toBe('pendiente');
    expect(creado.body.cobro.items).toHaveLength(3);
    expect(creado.body.cobro.items.map((item) => item.subtotal)).toEqual([10000, 5000, 9500]);
    expect(creado.body.cobro.items[0]).toMatchObject({
      precioId,
      nombre: 'Consulta detallada ficticia',
      cantidad: 1,
      importeUnitario: 10000,
      subtotal: 10000,
    });

    // Cambiar la lista no altera un cobro ya generado.
    const actualizado = await agenteAdmin.patch(`/api/precios/${precioId}`).send({
      importe: 12000,
      motivo: 'Ajuste ficticio de la lista',
    });
    expect(actualizado.status).toBe(200);

    const detalle = await agenteRecepcion.get(`/api/cobros/${creado.body.cobro.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.cobro.total).toBe(24500);
    expect(detalle.body.cobro.items[0].importeUnitario).toBe(10000);
    expect(detalle.body.cobro.items[0].nombre).toBe('Consulta detallada ficticia');
  });

  it('edita el detalle y no permite bajar el total de lo ya pagado', async () => {
    const precio = await agenteAdmin.post('/api/precios').send({
      nombre: 'Control detallado ficticio',
      importe: 5000,
    });
    const precioId = precio.body.precio.id;
    const { ingresoId, visitaId } = await crearVisitaCerrada({
      nombre: 'Paciente Edición Detalle',
    });

    const creado = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      items: [
        {
          precioId,
          nombre: 'Control detallado ficticio',
          cantidad: 1,
          importeUnitario: 5000,
        },
      ],
    });
    const cobroId = creado.body.cobro.id;
    expect(creado.body.cobro.total).toBe(5000);

    await agenteRecepcion.post(`/api/cobros/${cobroId}/pagos`).send({
      medio: 'efectivo',
      monto: 3000,
    });

    const soloTotal = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      total: 8000,
      motivoCambio: 'Intento de editar sin el detalle',
    });
    expect(soloTotal.status).toBe(409);

    const ampliado = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      items: [
        {
          precioId,
          nombre: 'Control detallado ficticio',
          cantidad: 1,
          importeUnitario: 5000,
        },
        {
          precioId: null,
          nombre: 'Estudio ficticio',
          cantidad: 1,
          importeUnitario: 4000,
        },
      ],
      motivoCambio: 'Se agregó un estudio ficticio al detalle',
    });

    expect(ampliado.status).toBe(200);
    expect(ampliado.body.cobro.total).toBe(9000);
    expect(ampliado.body.cobro.saldo).toBe(6000);
    expect(ampliado.body.cobro.estado).toBe('parcial');
    expect(ampliado.body.cobro.items).toHaveLength(2);

    const menor = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      items: [
        {
          precioId: null,
          nombre: 'Ajuste ficticio',
          cantidad: 1,
          importeUnitario: 2000,
        },
      ],
      motivoCambio: 'Ajuste ficticio por debajo de lo pagado',
    });
    expect(menor.status).toBe(409);

    const saldado = await agenteRecepcion.patch(`/api/cobros/${cobroId}`).send({
      items: [
        {
          precioId: null,
          nombre: 'Ajuste ficticio',
          cantidad: 1,
          importeUnitario: 3000,
        },
      ],
      motivoCambio: 'Ajuste ficticio al total pagado',
    });

    expect(saldado.status).toBe(200);
    expect(saldado.body.cobro.total).toBe(3000);
    expect(saldado.body.cobro.estado).toBe('pagado');
    expect(saldado.body.cobro.saldo).toBe(0);
    expect(saldado.body.cobro.items).toHaveLength(1);
    expect(await estadoIngreso(ingresoId)).toBe('atendido');
    expect(await contarAuditoriaAccion('cobro', cobroId, 'editar')).toBe(2);
  });

  it('exige observación en un detalle sin cargo y rechaza ítems inválidos', async () => {
    const { ingresoId, visitaId } = await crearVisitaCerrada({
      nombre: 'Paciente Detalle Sin Cargo',
    });

    const sinObservacion = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      items: [{ nombre: 'Cortesía ficticia', cantidad: 1, importeUnitario: 0 }],
    });
    expect(sinObservacion.status).toBe(400);
    expect(sinObservacion.body.error.detalles[0].campo).toBe('observaciones');

    const conObservacion = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      items: [{ nombre: 'Cortesía ficticia', cantidad: 1, importeUnitario: 0 }],
      observaciones: 'Cortesía ficticia de control',
    });

    expect(conObservacion.status).toBe(201);
    expect(conObservacion.body.cobro.total).toBe(0);
    expect(conObservacion.body.cobro.estado).toBe('pagado');
    expect(await estadoIngreso(ingresoId)).toBe('atendido');

    const { visitaId: otraVisita } = await crearVisitaCerrada({
      nombre: 'Paciente Detalle Inválido',
    });

    const cantidadCero = await agenteRecepcion.post('/api/cobros').send({
      visitaId: otraVisita,
      items: [{ nombre: 'Concepto ficticio', cantidad: 0, importeUnitario: 1000 }],
    });
    expect(cantidadCero.status).toBe(400);

    const precioInexistente = await agenteRecepcion.post('/api/cobros').send({
      visitaId: otraVisita,
      items: [
        {
          precioId: 999999,
          nombre: 'Concepto con precio inexistente',
          cantidad: 1,
          importeUnitario: 1000,
        },
      ],
    });
    expect(precioInexistente.status).toBe(400);
  });

  it('incluye en pendientes las visitas cerradas sin ingreso', async () => {
    const pacienteId = await crearPacienteDemo(clienteId, especieId, {
      nombre: 'Paciente Sin Ingreso',
    });
    const visitaId = await crearVisitaDemo({
      pacienteId,
      veterinarioId,
      estado: 'cerrada',
    });

    const pendientes = await agenteVet.get('/api/cobros/pendientes');
    expect(pendientes.status).toBe(200);
    expect(pendientes.body.pendientes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origen: 'visita', ingresoId: null, visitaId }),
      ]),
    );

    const creado = await agenteVet.post('/api/cobros').send({
      visitaId,
      total: 4500,
    });
    expect(creado.status).toBe(201);

    const despues = await agenteVet.get('/api/cobros/pendientes');
    expect(despues.body.pendientes.some((fila) => fila.visitaId === visitaId)).toBe(false);
  });

  it('calcula el cierre del día por medio y lista las deudas', async () => {
    const fecha = hoyEnTucuman();
    const baseline = await agenteRecepcion.get(`/api/cobros/caja?fecha=${fecha}`);
    expect(baseline.status).toBe(200);

    const totalBase = baseline.body.caja.totalCobrado;
    const cantidadBase = baseline.body.caja.cantidadPagos;
    const deudaBase = baseline.body.caja.deudaTotal;
    const deudasBase = baseline.body.caja.cantidadDeudas;
    const porMedioBase = new Map(
      baseline.body.caja.porMedio.map((fila) => [fila.medio, fila.total]),
    );

    const casos = [
      { nombre: 'Caja Efectivo', total: 1000, pago: 1000, medio: 'efectivo' },
      { nombre: 'Caja Débito', total: 2000, pago: 500, medio: 'debito' },
      { nombre: 'Caja Crédito', total: 3000, pago: 0, medio: 'credito' },
      { nombre: 'Caja Transferencia', total: 4000, pago: 4000, medio: 'transferencia' },
    ];

    const cobros = [];

    for (const caso of casos) {
      const { visitaId } = await crearVisitaCerrada({ nombre: caso.nombre });
      const creado = await agenteRecepcion.post('/api/cobros').send({
        visitaId,
        total: caso.total,
      });
      expect(creado.status).toBe(201);
      cobros.push(creado.body.cobro);

      if (caso.pago > 0) {
        const pago = await agenteRecepcion
          .post(`/api/cobros/${creado.body.cobro.id}/pagos`)
          .send({ medio: caso.medio, monto: caso.pago });
        expect(pago.status).toBe(201);
      }
    }

    const caja = await agenteVet.get(`/api/cobros/caja?fecha=${fecha}`);
    expect(caja.status).toBe(200);
    expect(caja.body.caja.totalCobrado).toBe(totalBase + 5500);
    expect(caja.body.caja.cantidadPagos).toBe(cantidadBase + 3);
    expect(caja.body.caja.deudaTotal).toBe(deudaBase + 4500);
    expect(caja.body.caja.cantidadDeudas).toBe(deudasBase + 2);

    const porMedio = new Map(caja.body.caja.porMedio.map((fila) => [fila.medio, fila.total]));
    expect(porMedio.get('efectivo')).toBe((porMedioBase.get('efectivo') ?? 0) + 1000);
    expect(porMedio.get('debito')).toBe((porMedioBase.get('debito') ?? 0) + 500);
    expect(porMedio.get('credito')).toBe(porMedioBase.get('credito') ?? 0);
    expect(porMedio.get('transferencia')).toBe((porMedioBase.get('transferencia') ?? 0) + 4000);

    const deudas = await agenteRecepcion.get('/api/cobros/deudas?limite=100');
    expect(deudas.status).toBe(200);
    const idsDeudas = deudas.body.datos.map((fila) => fila.id);
    expect(idsDeudas).toEqual(expect.arrayContaining([cobros[1].id, cobros[2].id]));
    expect(idsDeudas).not.toContain(cobros[0].id);
    expect(idsDeudas).not.toContain(cobros[3].id);

    const ayer = sumarDias(fecha, -1);
    const cajaAyer = await agenteRecepcion.get(`/api/cobros/caja?fecha=${ayer}`);
    expect(cajaAyer.status).toBe(200);
    const idsPagosHoy = new Set(caja.body.caja.pagos.map((pago) => pago.id));
    expect(cajaAyer.body.caja.pagos.some((pago) => idsPagosHoy.has(pago.id))).toBe(false);
  });

  it('bloquea anular una visita con un cobro activo', async () => {
    const { visitaId } = await crearVisitaCerrada({ nombre: 'Paciente Visita Cobrada' });

    const cobro = await agenteRecepcion.post('/api/cobros').send({
      visitaId,
      total: 1200,
    });
    expect(cobro.status).toBe(201);

    const anulada = await agenteVet
      .post(`/api/visitas/${visitaId}/anular`)
      .send({ motivo: 'Intento de anulación con cobro activo' });

    expect(anulada.status).toBe(409);
    expect(anulada.body.error.mensaje).toContain('cobro activo');
  });

  it('respeta los permisos de cobros y caja', async () => {
    const anonimo = await crearAgente().get('/api/cobros');
    expect(anonimo.status).toBe(401);

    const recepcion = await agenteRecepcion.get('/api/cobros');
    const vet = await agenteVet.get('/api/cobros');
    const admin = await agenteAdmin.get('/api/cobros');
    expect(recepcion.status).toBe(200);
    expect(vet.status).toBe(200);
    expect(admin.status).toBe(200);

    const cajaRecepcion = await agenteRecepcion.get('/api/cobros/caja');
    const cajaVet = await agenteVet.get('/api/cobros/caja');
    expect(cajaRecepcion.status).toBe(200);
    expect(cajaVet.status).toBe(200);

    expect(await contarAuditoria('cobro', 1)).toBeGreaterThan(0);
  });
});
