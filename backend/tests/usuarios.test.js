import { beforeAll, describe, expect, it } from 'vitest';
import { obtenerPool } from '../src/config/db.js';
import { cambiarEstadoUsuario } from '../src/modulos/usuarios/servicio.js';
import {
  contarAuditoria,
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';

function datosUsuario(email, extra = {}) {
  return {
    nombreCompleto: 'Usuario de Prueba',
    email,
    password: 'ClaveSegura123',
    rol: 'veterinario',
    matricula: 'MP-9999',
    activo: true,
    ...extra,
  };
}

describe('administración de usuarios', () => {
  let agenteAdmin;
  let adminId;

  beforeAll(async () => {
    await limpiarBase();

    const admin = await crearUsuario({
      email: 'admin@example.com',
      rol: 'admin',
      nombreCompleto: 'Admin de Prueba',
    });
    adminId = admin.id;

    agenteAdmin = crearAgente();
    const login = await iniciarSesion(agenteAdmin, 'admin@example.com');
    expect(login.status).toBe(200);
  });

  it('crea un usuario y registra la auditoría', async () => {
    const respuesta = await agenteAdmin
      .post('/api/usuarios')
      .send(datosUsuario('nuevo.vet@example.com', { nombreCompleto: 'Nuevo Veterinario' }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario.email).toBe('nuevo.vet@example.com');
    expect(respuesta.body.usuario.rol).toBe('veterinario');
    expect(respuesta.body.usuario.passwordHash).toBeUndefined();

    const total = await contarAuditoria('usuario', respuesta.body.usuario.id);
    expect(total).toBe(1);
  });

  it('rechaza un email duplicado con 409', async () => {
    await agenteAdmin.post('/api/usuarios').send(datosUsuario('duplicado@example.com'));

    const respuesta = await agenteAdmin
      .post('/api/usuarios')
      .send(datosUsuario('duplicado@example.com'));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CONFLICTO');
  });

  it('lista, pagina y busca usuarios', async () => {
    await agenteAdmin
      .post('/api/usuarios')
      .send(datosUsuario('busqueda@example.com', { nombreCompleto: 'Buscado Especial' }));

    const lista = await agenteAdmin.get('/api/usuarios?pagina=1&limite=5');
    expect(lista.status).toBe(200);
    expect(lista.body.datos.length).toBeGreaterThan(0);
    expect(lista.body.paginacion.pagina).toBe(1);
    expect(lista.body.paginacion.limite).toBe(5);

    const busqueda = await agenteAdmin.get('/api/usuarios?buscar=Buscado');
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.datos).toHaveLength(1);
    expect(busqueda.body.datos[0].nombreCompleto).toBe('Buscado Especial');
  });

  it('obtiene un usuario por id y devuelve 404 si no existe', async () => {
    const creado = await agenteAdmin
      .post('/api/usuarios')
      .send(datosUsuario('detalle@example.com'));

    const detalle = await agenteAdmin.get(`/api/usuarios/${creado.body.usuario.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.usuario.email).toBe('detalle@example.com');

    const inexistente = await agenteAdmin.get('/api/usuarios/999999');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('edita un usuario y guarda antes/después en la auditoría', async () => {
    const creado = await agenteAdmin.post('/api/usuarios').send(datosUsuario('editar@example.com'));

    const respuesta = await agenteAdmin.put(`/api/usuarios/${creado.body.usuario.id}`).send(
      datosUsuario('editar@example.com', {
        nombreCompleto: 'Nombre Editado',
        rol: 'recepcion',
        matricula: null,
      }),
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.nombreCompleto).toBe('Nombre Editado');
    expect(respuesta.body.usuario.rol).toBe('recepcion');
    expect(respuesta.body.usuario.matricula).toBeNull();

    const { rows } = await obtenerPool().query(
      `SELECT antes, despues FROM auditoria
       WHERE entidad = 'usuario' AND entidad_id = $1 AND accion = 'editar'
       ORDER BY id DESC LIMIT 1`,
      [creado.body.usuario.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].antes.nombreCompleto).toBe('Usuario de Prueba');
    expect(rows[0].despues.nombreCompleto).toBe('Nombre Editado');
  });

  it('desactiva un usuario y le impide iniciar sesión', async () => {
    const creado = await agenteAdmin
      .post('/api/usuarios')
      .send(datosUsuario('desactivar@example.com'));

    const respuesta = await agenteAdmin
      .patch(`/api/usuarios/${creado.body.usuario.id}/estado`)
      .send({ activo: false });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.activo).toBe(false);

    const login = await iniciarSesion(crearAgente(), 'desactivar@example.com');
    expect(login.status).toBe(403);
    expect(login.body.error.codigo).toBe('USUARIO_INACTIVO');
  });

  it('no permite que un admin se desactive a sí mismo', async () => {
    const respuesta = await agenteAdmin
      .patch(`/api/usuarios/${adminId}/estado`)
      .send({ activo: false });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toMatch(/tu propio usuario/i);
  });

  it('no permite dejar el sistema sin administradores activos', async () => {
    const recepcion = await crearUsuario({
      email: 'ejecutor.recepcion@example.com',
      rol: 'recepcion',
    });

    // Se llama al servicio directamente para probar la regla de negocio sin
    // depender de que exista otro admin que ejecute la acción.
    await expect(cambiarEstadoUsuario(adminId, false, { id: recepcion.id })).rejects.toMatchObject({
      codigo: 'CONFLICTO',
    });
  });

  it('recepción no puede crear usuarios', async () => {
    await crearUsuario({ email: 'recepcion@example.com', rol: 'recepcion' });
    const agenteRecepcion = crearAgente();
    await iniciarSesion(agenteRecepcion, 'recepcion@example.com');

    const respuesta = await agenteRecepcion
      .post('/api/usuarios')
      .send(datosUsuario('no-permitido@example.com'));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
  });
});
