import { beforeAll, describe, expect, it } from 'vitest';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';

describe('lista de precios', () => {
  let agenteAdmin;
  let agenteRecepcion;
  let agenteVet;
  let precioId;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin Precios',
    });
    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción Precios',
    });
    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Precios',
    });

    agenteAdmin = crearAgente();
    agenteRecepcion = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteRecepcion, 'recepcion@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea un precio y deja la primera versión del historial', async () => {
    const creado = await agenteAdmin.post('/api/precios').send({
      nombre: 'Consulta clínica ficticia',
      importe: 15000,
      observaciones: 'Precio de prueba',
    });

    expect(creado.status).toBe(201);
    expect(creado.body.precio).toMatchObject({
      nombre: 'Consulta clínica ficticia',
      importe: 15000,
      activo: true,
    });

    precioId = creado.body.precio.id;
    expect(await contarAuditoria('precio', precioId)).toBe(1);

    const detalle = await agenteRecepcion.get(`/api/precios/${precioId}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.precio.historial).toHaveLength(1);
    expect(detalle.body.precio.historial[0]).toMatchObject({
      nombreAnterior: null,
      nombreNuevo: 'Consulta clínica ficticia',
      importeAnterior: null,
      importeNuevo: 15000,
      motivo: 'Precio inicial',
      cambiadoPorNombre: 'Admin Precios',
    });

    const listado = await agenteVet.get('/api/precios');
    expect(listado.status).toBe(200);
    expect(listado.body.datos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: precioId, importe: 15000 })]),
    );
  });

  it('rechaza nombres activos repetidos sin importar mayúsculas ni tildes', async () => {
    const duplicado = await agenteAdmin.post('/api/precios').send({
      nombre: 'consulta clinica ficticia',
      importe: 20000,
    });

    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.codigo).toBe('CONFLICTO');
  });

  it('solo el admin crea y edita precios', async () => {
    const anonimo = await crearAgente().get('/api/precios');
    expect(anonimo.status).toBe(401);

    const crearVet = await agenteVet.post('/api/precios').send({
      nombre: 'Precio de veterinario',
      importe: 1000,
    });
    expect(crearVet.status).toBe(403);

    const editarRecepcion = await agenteRecepcion.patch(`/api/precios/${precioId}`).send({
      importe: 16000,
      motivo: 'Intento sin permiso',
    });
    expect(editarRecepcion.status).toBe(403);
  });

  it('exige motivo y registra el antes y el después del cambio', async () => {
    const sinMotivo = await agenteAdmin.patch(`/api/precios/${precioId}`).send({
      importe: 18000,
    });
    expect(sinMotivo.status).toBe(400);

    const editado = await agenteAdmin.patch(`/api/precios/${precioId}`).send({
      nombre: 'Consulta clínica general ficticia',
      importe: 18000,
      motivo: 'Actualización ficticia de la lista',
    });

    expect(editado.status).toBe(200);
    expect(editado.body.precio).toMatchObject({
      nombre: 'Consulta clínica general ficticia',
      importe: 18000,
    });

    const detalle = await agenteAdmin.get(`/api/precios/${precioId}`);
    expect(detalle.body.precio.historial).toHaveLength(2);

    const [ultimo] = detalle.body.precio.historial;
    expect(ultimo).toMatchObject({
      nombreAnterior: 'Consulta clínica ficticia',
      nombreNuevo: 'Consulta clínica general ficticia',
      importeAnterior: 15000,
      importeNuevo: 18000,
      motivo: 'Actualización ficticia de la lista',
    });

    expect(await contarAuditoria('precio', precioId)).toBe(2);
  });

  it('desactiva y reactiva sin borrar el historial', async () => {
    const desactivado = await agenteAdmin.patch(`/api/precios/${precioId}`).send({
      activo: false,
      motivo: 'Precio fuera de uso ficticio',
    });
    expect(desactivado.status).toBe(200);
    expect(desactivado.body.precio.activo).toBe(false);

    const activos = await agenteRecepcion.get('/api/precios');
    expect(activos.body.datos.some((fila) => fila.id === precioId)).toBe(false);

    const todos = await agenteRecepcion.get('/api/precios?incluirInactivos=true');
    expect(todos.body.datos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: precioId, activo: false })]),
    );

    const detalle = await agenteRecepcion.get(`/api/precios/${precioId}`);
    expect(detalle.body.precio.historial).toHaveLength(2);

    const reactivado = await agenteAdmin.patch(`/api/precios/${precioId}`).send({
      activo: true,
      motivo: 'Vuelve a estar disponible ficticio',
    });
    expect(reactivado.status).toBe(200);
    expect(reactivado.body.precio.activo).toBe(true);
  });
});
