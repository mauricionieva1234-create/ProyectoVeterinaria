import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Clientes } from './Clientes.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CLIENTE = {
  id: 1,
  nombre: 'Cliente',
  apellido: 'Demo',
  tipoDocumento: 'DNI',
  nroDocumento: '***.***.001',
  telefonoPrincipal: '3815550001',
  telefonoEsWhatsapp: true,
  localidadBarrio: 'Centro',
  fichaIncompleta: false,
  pacientes: 2,
};

function crearFetch() {
  return vi.fn(async (url) => {
    if (String(url).startsWith('/api/clientes')) {
      return respuestaJson({
        datos: [CLIENTE],
        paginacion: { pagina: 1, limite: 10, total: 1, totalPaginas: 1 },
      });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarClientes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Clientes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Clientes', () => {
  it('lista los clientes con el documento enmascarado', async () => {
    vi.stubGlobal('fetch', crearFetch());
    renderizarClientes();

    expect(await screen.findByText('Demo, Cliente')).toBeInTheDocument();
    expect(screen.getByText('***.***.001')).toBeInTheDocument();
    expect(screen.getByText('1 cliente en total')).toBeInTheDocument();
    expect(screen.getByText('Completa')).toBeInTheDocument();
  });

  it('abre el alta con la búsqueda previa por documento o teléfono', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = userEvent.setup();
    renderizarClientes();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));

    expect(await screen.findByText('¿Ya está registrado?')).toBeInTheDocument();
    expect(screen.getByLabelText('Documento')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });
});
