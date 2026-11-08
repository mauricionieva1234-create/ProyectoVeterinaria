import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inicio } from './Inicio.jsx';

function renderizarInicio() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Inicio />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Inicio', () => {
  it('muestra el estado del backend cuando la consulta funciona', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            estado: 'ok',
            servicio: 'veterinaria-api',
            hora: '2026-11-08T15:30:00.000Z',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    renderizarInicio();

    expect(await screen.findByText(/Conectado/)).toBeInTheDocument();
  });

  it('muestra un error visible si el backend no responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin conexión')));

    renderizarInicio();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
  });
});
