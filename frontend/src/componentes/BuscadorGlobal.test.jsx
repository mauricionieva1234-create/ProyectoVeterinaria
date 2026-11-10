import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuscadorGlobal } from './BuscadorGlobal.jsx';

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
  nroDocumento: '90000001',
  telefonoPrincipal: '3815550001',
};

const PACIENTE_UNO = {
  id: 10,
  nombre: 'Paciente Demo Gamma',
  codigoInterno: 'PAC-000003',
  especieNombre: 'canino',
  cliente: { id: 2, nombreCompleto: 'Cliente Demo B', telefonoPrincipal: '3815550002' },
};

const PACIENTE_DOS = {
  id: 11,
  nombre: 'Paciente Demo Gamma',
  codigoInterno: 'PAC-000005',
  especieNombre: 'canino',
  cliente: { id: 3, nombreCompleto: 'Cliente Demo C', telefonoPrincipal: '3815550003' },
};

function crearFetch() {
  return vi.fn(async (url) => {
    const destino = String(url);

    if (destino.startsWith('/api/clientes')) {
      return respuestaJson({
        datos: [CLIENTE],
        paginacion: { pagina: 1, limite: 6, total: 1, totalPaginas: 1 },
      });
    }

    if (destino.startsWith('/api/pacientes')) {
      return respuestaJson({
        datos: [PACIENTE_UNO, PACIENTE_DOS],
        paginacion: { pagina: 1, limite: 6, total: 2, totalPaginas: 1 },
      });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarBuscador() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BuscadorGlobal />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function abrirBuscador() {
  const usuario = userEvent.setup();
  renderizarBuscador();
  await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
  return usuario;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BuscadorGlobal', () => {
  it('abre la lupa y busca clientes por nombre, apellido o DNI', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = await abrirBuscador();

    await usuario.type(screen.getByLabelText('Clientes: nombre, apellido o DNI'), 'demo');

    expect(await screen.findByText('Demo, Cliente')).toBeInTheDocument();
    expect(screen.getByText(/90000001/)).toBeInTheDocument();
    expect(screen.getByText(/3815550001/)).toBeInTheDocument();
  });

  it('muestra el dueño de cada mascota cuando el nombre se repite', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = await abrirBuscador();

    await usuario.type(screen.getByLabelText('Mascotas: nombre'), 'gamma');

    expect(await screen.findAllByText('Paciente Demo Gamma')).toHaveLength(2);
    expect(screen.getByText(/Dueño: Cliente Demo B/)).toBeInTheDocument();
    expect(screen.getByText(/Dueño: Cliente Demo C/)).toBeInTheDocument();
  });

  it('se cierra con la tecla Escape', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = await abrirBuscador();

    expect(screen.getByLabelText('Mascotas: nombre')).toBeInTheDocument();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByLabelText('Mascotas: nombre')).not.toBeInTheDocument();
  });
});
