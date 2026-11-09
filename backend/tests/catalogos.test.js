import { beforeAll, describe, expect, it } from 'vitest';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';

describe('catálogos de especies y razas', () => {
  let agenteAdmin;
  let agenteVet;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin Prueba',
    });
    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Vet Prueba',
    });

    agenteAdmin = crearAgente();
    agenteVet = crearAgente();

    expect((await iniciarSesion(agenteAdmin, 'admin@example.com')).status).toBe(200);
    expect((await iniciarSesion(agenteVet, 'vet@example.com')).status).toBe(200);
  });

  it('crea una especie y una raza, y las lista', async () => {
    const especie = await agenteAdmin.post('/api/catalogos/especies').send({ nombre: 'canino' });

    expect(especie.status).toBe(201);
    expect(especie.body.especie.nombre).toBe('canino');

    const raza = await agenteAdmin.post('/api/catalogos/razas').send({
      especieId: especie.body.especie.id,
      nombre: 'Mestizo',
    });

    expect(raza.status).toBe(201);
    expect(raza.body.raza.especieId).toBe(especie.body.especie.id);

    const lista = await agenteVet.get(`/api/catalogos/razas?especieId=${especie.body.especie.id}`);

    expect(lista.status).toBe(200);
    expect(lista.body.datos).toHaveLength(1);
    expect(lista.body.datos[0].nombre).toBe('Mestizo');
  });

  it('avisa si la especie ya existe aunque cambien mayúsculas o tildes', async () => {
    const respuesta = await agenteAdmin.post('/api/catalogos/especies').send({ nombre: 'Cánino' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CONFLICTO');
    expect(respuesta.body.error.detalles[0].sugerencias).toContain('canino');
  });

  it('rechaza una raza duplicada dentro de la misma especie', async () => {
    const { body } = await agenteAdmin.get('/api/catalogos/especies');
    const canino = body.datos.find((especie) => especie.nombre === 'canino');

    const respuesta = await agenteAdmin
      .post('/api/catalogos/razas')
      .send({ especieId: canino.id, nombre: 'mestizo' });

    expect(respuesta.status).toBe(409);
  });

  it('solo el admin crea especies y razas', async () => {
    const respuesta = await agenteVet.post('/api/catalogos/especies').send({ nombre: 'felino' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
  });

  it('devuelve 404 si se listan razas de una especie inexistente', async () => {
    const respuesta = await agenteVet.get('/api/catalogos/razas?especieId=999999');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });
});
