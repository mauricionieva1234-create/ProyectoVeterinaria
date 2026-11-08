import { beforeAll, describe, expect, it } from 'vitest';
import { crearAgente, crearUsuario, iniciarSesion, limpiarBase } from './ayuda/base.js';

describe('auditoría', () => {
  let agenteAdmin;
  let adminId;

  beforeAll(async () => {
    await limpiarBase();

    const admin = await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin de Auditoría',
    });
    adminId = admin.id;

    agenteAdmin = crearAgente();
    await iniciarSesion(agenteAdmin, 'admin@example.com');
  });

  it('registra altas y ediciones y las devuelve paginadas', async () => {
    const creado = await agenteAdmin.post('/api/usuarios').send({
      nombreCompleto: 'Auditado',
      email: 'auditado@example.com',
      password: 'ClaveSegura123',
      rol: 'veterinario',
      matricula: 'MP-123',
      activo: true,
    });

    expect(creado.status).toBe(201);

    const editado = await agenteAdmin.put(`/api/usuarios/${creado.body.usuario.id}`).send({
      nombreCompleto: 'Auditado Editado',
      email: 'auditado@example.com',
      rol: 'veterinario',
      matricula: 'MP-123',
      activo: true,
    });

    expect(editado.status).toBe(200);

    const lista = await agenteAdmin.get('/api/auditoria?pagina=1&limite=10');
    expect(lista.status).toBe(200);
    expect(lista.body.datos.length).toBeGreaterThanOrEqual(2);
    expect(lista.body.paginacion.total).toBeGreaterThanOrEqual(2);

    const crear = lista.body.datos.find((registro) => registro.accion === 'crear');
    const editar = lista.body.datos.find((registro) => registro.accion === 'editar');

    expect(crear.antes).toBeNull();
    expect(crear.despues.email).toBe('auditado@example.com');
    expect(editar.antes.nombreCompleto).toBe('Auditado');
    expect(editar.despues.nombreCompleto).toBe('Auditado Editado');

    // El hash de la contraseña nunca puede aparecer en la auditoría.
    expect(JSON.stringify(lista.body)).not.toMatch(/\$2[aby]\$/);
  });

  it('filtra por entidad, acción y usuario', async () => {
    const porEntidad = await agenteAdmin.get('/api/auditoria?entidad=usuario');
    expect(porEntidad.status).toBe(200);
    expect(porEntidad.body.datos.length).toBeGreaterThan(0);
    expect(porEntidad.body.datos.every((registro) => registro.entidad === 'usuario')).toBe(true);

    const porAccion = await agenteAdmin.get('/api/auditoria?accion=crear');
    expect(porAccion.status).toBe(200);
    expect(porAccion.body.datos.every((registro) => registro.accion === 'crear')).toBe(true);

    const porUsuario = await agenteAdmin.get(`/api/auditoria?usuarioId=${adminId}`);
    expect(porUsuario.status).toBe(200);
    expect(
      porUsuario.body.datos.every((registro) => String(registro.usuarioId) === String(adminId)),
    ).toBe(true);
  });

  it('acepta filtros de fecha en formato aaaa-mm-dd', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const respuesta = await agenteAdmin.get(`/api/auditoria?desde=${hoy}&hasta=${hoy}`);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.datos)).toBe(true);
  });

  it('recepción no puede ver la auditoría', async () => {
    await crearUsuario({ email: 'recepcion@example.com', rol: 'recepcion' });
    const agenteRecepcion = crearAgente();
    await iniciarSesion(agenteRecepcion, 'recepcion@example.com');

    const respuesta = await agenteRecepcion.get('/api/auditoria');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
  });
});
