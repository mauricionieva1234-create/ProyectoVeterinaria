import { beforeAll, describe, expect, it } from 'vitest';
import {
  crearAgente,
  crearUsuario,
  iniciarSesion,
  limpiarBase,
  PASSWORD_PRUEBA,
} from './ayuda/base.js';

describe('autenticación', () => {
  let agente;

  beforeAll(async () => {
    await limpiarBase();

    await crearUsuario({
      email: 'vet@example.com',
      rol: 'veterinario',
      nombreCompleto: 'Veterinaria de Prueba',
      matricula: 'MP-1234',
    });

    await crearUsuario({
      email: 'inactivo@example.com',
      rol: 'recepcion',
      activo: false,
      nombreCompleto: 'Usuario Inactivo',
    });

    agente = crearAgente();
  });

  it('inicia sesión con credenciales correctas y setea la cookie httpOnly de 8 horas', async () => {
    const respuesta = await iniciarSesion(agente, 'vet@example.com');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.email).toBe('vet@example.com');
    expect(respuesta.body.usuario.rol).toBe('veterinario');
    expect(respuesta.body.permisos).toContain('visitas.editar');
    expect(respuesta.body.permisos).toContain('visitas.ver_clinico');
    expect(respuesta.body.permisos).not.toContain('usuarios.ver');

    const cookie = respuesta.headers['set-cookie'][0];
    expect(cookie).toMatch(/sesion_veterinaria=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=28800/);
  });

  it('rechaza una contraseña incorrecta sin revelar si el email existe', async () => {
    const respuesta = await iniciarSesion(agente, 'vet@example.com', 'clave-equivocada');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('rechaza un email inexistente', async () => {
    const respuesta = await iniciarSesion(agente, 'no-existe@example.com');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('rechaza a un usuario inactivo aunque la contraseña sea correcta', async () => {
    const respuesta = await iniciarSesion(agente, 'inactivo@example.com');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('USUARIO_INACTIVO');
  });

  it('devuelve la sesión en /me y la cierra con logout', async () => {
    const agentePropio = crearAgente();

    const login = await iniciarSesion(agentePropio, 'vet@example.com');
    expect(login.status).toBe(200);

    const sesion = await agentePropio.get('/api/auth/me');
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario.email).toBe('vet@example.com');
    expect(sesion.body.permisos).toContain('visitas.editar');

    const logout = await agentePropio.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const despues = await agentePropio.get('/api/auth/me');
    expect(despues.status).toBe(401);
    expect(despues.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('sin cookie, /me responde 401', async () => {
    const respuesta = await crearAgente().get('/api/auth/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('limita a 5 los intentos fallidos de login por email', async () => {
    const agenteLimite = crearAgente();
    const email = 'limite@example.com';

    for (let intento = 1; intento <= 5; intento += 1) {
      const respuesta = await iniciarSesion(agenteLimite, email, 'clave-equivocada');
      expect(respuesta.status).toBe(401);
    }

    const bloqueado = await iniciarSesion(agenteLimite, email, PASSWORD_PRUEBA);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
  });
});
