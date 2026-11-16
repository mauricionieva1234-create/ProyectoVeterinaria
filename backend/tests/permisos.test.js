import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { tienePermiso } from '../src/config/permisos.js';
import { manejarErrores } from '../src/middlewares/errores.js';
import { requiereAutenticacion } from '../src/middlewares/autenticacion.js';
import { requierePermiso } from '../src/middlewares/permisos.js';
import {
  crearAgente,
  crearUsuario,
  extraerCookie,
  iniciarSesion,
  limpiarBase,
} from './ayuda/base.js';

// App mínima para probar el middleware sin depender de un módulo real.
function crearAppDePrueba() {
  const app = express();
  app.use(cookieParser());
  app.get('/prueba', requiereAutenticacion, requierePermiso('visitas.editar'), (req, res) =>
    res.json({ ok: true }),
  );
  app.use(manejarErrores);
  return app;
}

describe('permisos por rol', () => {
  let cookieAdmin;
  let cookieVeterinario;
  let cookieRecepcion;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({ email: 'admin@example.com', rol: 'admin', nombreCompleto: 'Admin' });
    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Veterinario',
    });
    await crearUsuario({
      email: 'recepcion@example.com',
      rol: 'recepcion',
      nombreCompleto: 'Recepción',
    });

    const admin = await iniciarSesion(crearAgente(), 'admin@example.com');
    const veterinario = await iniciarSesion(crearAgente(), 'vet@example.com');
    const recepcion = await iniciarSesion(crearAgente(), 'recepcion@example.com');

    cookieAdmin = extraerCookie(admin);
    cookieVeterinario = extraerCookie(veterinario);
    cookieRecepcion = extraerCookie(recepcion);
  });

  it('el mapa de permisos no le da acceso clínico de escritura a recepción', () => {
    expect(tienePermiso('recepcion', 'visitas.ver_clinico')).toBe(false);
    expect(tienePermiso('recepcion', 'visitas.editar')).toBe(false);
    expect(tienePermiso('recepcion', 'registros.crear')).toBe(false);
    expect(tienePermiso('recepcion', 'usuarios.ver')).toBe(false);
    expect(tienePermiso('recepcion', 'auditoria.ver')).toBe(false);

    // La lectura y la exportación de la historia son un permiso aparte.
    expect(tienePermiso('recepcion', 'historia.ver')).toBe(true);
    expect(tienePermiso('recepcion', 'historia.exportar')).toBe(true);
    expect(tienePermiso('recepcion', 'asistente.usar')).toBe(true);

    expect(tienePermiso('veterinario', 'visitas.ver_clinico')).toBe(true);
    expect(tienePermiso('veterinario', 'visitas.editar')).toBe(true);
    expect(tienePermiso('veterinario', 'historia.ver')).toBe(true);
    expect(tienePermiso('veterinario', 'asistente.usar')).toBe(true);
    expect(tienePermiso('veterinario', 'usuarios.ver')).toBe(false);

    expect(tienePermiso('admin', 'usuarios.ver')).toBe(true);
    expect(tienePermiso('admin', 'auditoria.ver')).toBe(true);
    expect(tienePermiso('admin', 'asistente.usar')).toBe(true);
    expect(tienePermiso('rol_desconocido', 'asistente.usar')).toBe(false);
  });

  it('solo el admin puede listar usuarios', async () => {
    const admin = await crearAgente().get('/api/usuarios').set('Cookie', cookieAdmin);
    const veterinario = await crearAgente().get('/api/usuarios').set('Cookie', cookieVeterinario);
    const recepcion = await crearAgente().get('/api/usuarios').set('Cookie', cookieRecepcion);

    expect(admin.status).toBe(200);
    expect(veterinario.status).toBe(403);
    expect(recepcion.status).toBe(403);
  });

  it('recepción y veterinario reciben 403 en administración y auditoría', async () => {
    const usuariosRecepcion = await crearAgente()
      .get('/api/usuarios')
      .set('Cookie', cookieRecepcion);
    const usuariosVeterinario = await crearAgente()
      .get('/api/usuarios')
      .set('Cookie', cookieVeterinario);
    const auditoriaRecepcion = await crearAgente()
      .get('/api/auditoria')
      .set('Cookie', cookieRecepcion);
    const auditoriaVeterinario = await crearAgente()
      .get('/api/auditoria')
      .set('Cookie', cookieVeterinario);

    expect(usuariosRecepcion.status).toBe(403);
    expect(usuariosVeterinario.status).toBe(403);
    expect(auditoriaRecepcion.status).toBe(403);
    expect(auditoriaVeterinario.status).toBe(403);
  });

  it('el admin sí puede administrar usuarios y ver auditoría', async () => {
    const usuarios = await crearAgente().get('/api/usuarios').set('Cookie', cookieAdmin);
    const auditoria = await crearAgente().get('/api/auditoria').set('Cookie', cookieAdmin);

    expect(usuarios.status).toBe(200);
    expect(auditoria.status).toBe(200);
  });

  it('requierePermiso deja pasar a veterinario y admin, y bloquea a recepción', async () => {
    const app = crearAppDePrueba();

    const recepcion = await request(app).get('/prueba').set('Cookie', cookieRecepcion);
    const veterinario = await request(app).get('/prueba').set('Cookie', cookieVeterinario);
    const admin = await request(app).get('/prueba').set('Cookie', cookieAdmin);

    expect(recepcion.status).toBe(403);
    expect(recepcion.body.error.codigo).toBe('SIN_PERMISO');
    expect(veterinario.status).toBe(200);
    expect(admin.status).toBe(200);
  });
});
