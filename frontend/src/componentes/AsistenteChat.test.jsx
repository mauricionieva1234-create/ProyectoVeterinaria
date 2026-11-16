import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AsistenteChat } from './AsistenteChat.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const RESPUESTA_VACUNAS = {
  tipo: 'listado',
  titulo: 'Vacunas de Firulais Demo',
  resumen: '1 vacuna(s) registrada(s).',
  secciones: [
    {
      titulo: 'Vacunas',
      items: [
        {
          etiqueta: 'Vacuna Demo',
          valor: 'Aplicada el 10/11/2026',
          nota: 'Lote LOTE-1',
        },
      ],
    },
  ],
  opciones: [
    { etiqueta: 'Ver controles', mensaje: '@paciente:7' },
    { etiqueta: 'Ver última visita', mensaje: 'última visita de PAC-000007' },
  ],
  enlaces: [{ texto: 'Abrir ficha del paciente', href: '/pacientes/7' }],
};

async function abrirAsistente() {
  render(
    <MemoryRouter>
      <AsistenteChat />
    </MemoryRouter>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Abrir asistente' }));
  return screen.getByLabelText('Consulta para el asistente');
}

beforeAll(() => {
  // jsdom no implementa scrollIntoView y el chat lo usa para bajar al último mensaje.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AsistenteChat', () => {
  it('abre el panel y lo cierra con Escape', async () => {
    await abrirAsistente();

    expect(screen.getByRole('region', { name: 'Asistente de consultas' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(
      screen.queryByRole('region', { name: 'Asistente de consultas' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir asistente' })).toBeInTheDocument();
  });

  it('envía la consulta y muestra la respuesta con enlaces', async () => {
    const fetchFalso = vi.fn(async () => respuestaJson({ respuesta: RESPUESTA_VACUNAS }));
    vi.stubGlobal('fetch', fetchFalso);

    const entrada = await abrirAsistente();
    await userEvent.type(entrada, 'vacunas de Firulais Demo');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByText('Vacunas de Firulais Demo')).toBeInTheDocument();
    expect(screen.getByText('Vacuna Demo:')).toBeInTheDocument();
    expect(screen.getByText('Lote LOTE-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir ficha del paciente' })).toHaveAttribute(
      'href',
      '/pacientes/7',
    );

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('/api/asistente/consulta');
    expect(JSON.parse(opciones.body)).toEqual({ mensaje: 'vacunas de Firulais Demo' });
  });

  it('al elegir una opción resuelve el seguimiento por id interno', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaJson({ respuesta: RESPUESTA_VACUNAS }))
      .mockResolvedValueOnce(
        respuestaJson({
          respuesta: {
            tipo: 'listado',
            titulo: 'Controles de Firulais Demo',
            resumen: '1 control(es) encontrado(s).',
            secciones: [],
            opciones: [],
            enlaces: [],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchFalso);

    const entrada = await abrirAsistente();
    await userEvent.type(entrada, 'vacunas de Firulais Demo');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Ver controles' }));

    expect(await screen.findByText('Controles de Firulais Demo')).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body)).toEqual({ mensaje: '@paciente:7' });
  });

  it('muestra un error claro si la consulta falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuestaJson(
          { error: { codigo: 'ERROR_API', mensaje: 'No se pudo procesar la consulta' } },
          500,
        ),
      ),
    );

    const entrada = await abrirAsistente();
    await userEvent.type(entrada, 'controles de hoy');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo procesar la consulta'),
    );
  });
});
