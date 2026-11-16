import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Precios } from './Precios.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CONSULTA = {
  id: 1,
  nombre: 'Consulta demo',
  importe: 15000,
  activo: true,
  observaciones: 'Precio ficticio',
  creadoEn: '2026-11-10T12:00:00.000Z',
  actualizadoEn: '2026-11-15T12:00:00.000Z',
};

const VACUNA = {
  id: 2,
  nombre: 'Vacuna demo',
  importe: 8000,
  activo: false,
  observaciones: null,
  creadoEn: '2026-11-10T12:00:00.000Z',
  actualizadoEn: '2026-11-12T12:00:00.000Z',
};

const HISTORIAL = [
  {
    id: 2,
    precioId: 1,
    nombreAnterior: 'Consulta ficticia',
    nombreNuevo: 'Consulta demo',
    importeAnterior: 12000,
    importeNuevo: 15000,
    motivo: 'Ajuste ficticio de la lista',
    cambiadoPorNombre: 'Admin Prueba',
    cambiadoEn: '2026-11-15T12:00:00.000Z',
  },
  {
    id: 1,
    precioId: 1,
    nombreAnterior: null,
    nombreNuevo: 'Consulta ficticia',
    importeAnterior: null,
    importeNuevo: 12000,
    motivo: 'Precio inicial',
    cambiadoPorNombre: 'Admin Prueba',
    cambiadoEn: '2026-11-10T12:00:00.000Z',
  },
];

const PERMISOS_ADMIN = ['precios.ver', 'precios.crear', 'precios.editar'];
const PERMISOS_RECEPCION = ['precios.ver'];

function crearFetch(permisos) {
  return vi.fn(async (url, opciones = {}) => {
    const ruta = String(url);
    const metodo = opciones.method ?? 'GET';

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Usuario Prueba', rol: 'admin' },
        permisos,
      });
    }

    if (ruta === '/api/precios/1' && metodo === 'GET') {
      return respuestaJson({ precio: { ...CONSULTA, historial: HISTORIAL } });
    }

    if (ruta.startsWith('/api/precios?')) {
      return respuestaJson({ datos: [CONSULTA, VACUNA] });
    }

    if (ruta === '/api/precios' && metodo === 'POST') {
      const cuerpo = JSON.parse(opciones.body);
      return respuestaJson({ precio: { ...CONSULTA, ...cuerpo, id: 3 } }, 201);
    }

    if (ruta === '/api/precios/1' && metodo === 'PATCH') {
      const cuerpo = JSON.parse(opciones.body);
      return respuestaJson({ precio: { ...CONSULTA, ...cuerpo } });
    }

    throw new Error(`URL inesperada en el test: ${metodo} ${url}`);
  });
}

function renderizarPrecios() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Precios />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Precios', () => {
  it('lista los precios y permite abrir el historial', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_ADMIN));
    renderizarPrecios();

    expect(await screen.findByText('Consulta demo')).toBeInTheDocument();
    expect(screen.getByText('Vacuna demo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Historial' })[0]);

    expect(await screen.findByText(/Ajuste ficticio de la lista/)).toBeInTheDocument();
    expect(screen.getByText(/Precio inicial/)).toBeInTheDocument();
  });

  it('recepción solo puede consultar la lista', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarPrecios();

    await screen.findByText('Consulta demo');

    expect(screen.queryByRole('button', { name: 'Nuevo precio' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Historial' }).length).toBe(2);
  });

  it('da de alta un precio nuevo', async () => {
    const fetchMock = crearFetch(PERMISOS_ADMIN);
    vi.stubGlobal('fetch', fetchMock);
    renderizarPrecios();

    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo precio' }));

    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Nombre del servicio'), {
      target: { value: 'Control demo' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Importe'), {
      target: { value: '6000' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Agregar precio' }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([url, opciones]) => String(url) === '/api/precios' && opciones?.method === 'POST',
      );
      expect(llamada).toBeTruthy();
      expect(JSON.parse(llamada[1].body)).toMatchObject({
        nombre: 'Control demo',
        importe: 6000,
      });
    });
  });

  it('exige motivo al editar y envía el cambio', async () => {
    const fetchMock = crearFetch(PERMISOS_ADMIN);
    vi.stubGlobal('fetch', fetchMock);
    renderizarPrecios();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);

    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Importe'), {
      target: { value: '18000' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambio' }));

    expect(await within(dialogo).findByText(/Indicá el motivo del cambio/)).toBeInTheDocument();

    fireEvent.change(within(dialogo).getByLabelText('Motivo del cambio'), {
      target: { value: 'Actualización ficticia de la lista' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambio' }));

    await waitFor(() => {
      const llamada = fetchMock.mock.calls.find(
        ([url, opciones]) => String(url) === '/api/precios/1' && opciones?.method === 'PATCH',
      );
      expect(llamada).toBeTruthy();
      expect(JSON.parse(llamada[1].body)).toMatchObject({
        nombre: 'Consulta demo',
        importe: 18000,
        activo: true,
        motivo: 'Actualización ficticia de la lista',
      });
    });
  });
});
