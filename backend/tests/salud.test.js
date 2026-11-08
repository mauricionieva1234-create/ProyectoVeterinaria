import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';

describe('GET /api/salud', () => {
  it('responde con el estado del servicio', async () => {
    const respuesta = await request(crearApp()).get('/api/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('ok');
    expect(respuesta.body.servicio).toBe('veterinaria-api');
    expect(respuesta.body.hora).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('devuelve el formato de error acordado para rutas inexistentes', async () => {
    const respuesta = await request(crearApp()).get('/api/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({
      error: {
        codigo: 'RUTA_NO_ENCONTRADA',
        mensaje: expect.stringContaining('/api/no-existe'),
        detalles: [],
      },
    });
  });
});
