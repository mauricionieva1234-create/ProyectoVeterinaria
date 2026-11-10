import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cola } from './Cola.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const INGRESO = {
  id: 1,
  pacienteId: 10,
  fechaDia: '2026-11-10',
  numeroOrden: 1,
  horaLlegada: '2026-11-10T12:00:00.000Z',
  servicio: 'atencion_clinica',
  prioridad: 'urgente',
  urgenciaEstado: 'posible',
  estado: 'esperando',
  paciente: {
    id: 10,
    nombre: 'Paciente Demo',
    codigoInterno: 'PAC-000010',
    provisorio: false,
    especieId: 1,
    especieNombre: 'canino',
  },
  cliente: {
    id: 5,
    nombreCompleto: 'Demo, Cliente',
    telefonoPrincipal: '3815550001',
  },
};

function crearFetch(permisos) {
  return vi.fn(async (url) => {
    const ruta = String(url);

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Usuario Prueba', rol: 'recepcion' },
        permisos,
      });
    }

    if (ruta === '/api/cola') {
      return respuestaJson({ fecha: '2026-11-10', ingresos: [INGRESO] });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarCola() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Cola />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PERMISOS_RECEPCION = [
  'cola.ver',
  'cola.crear',
  'cola.editar',
  'cola.marcar_urgencia',
  'pacientes.alta_rapida',
];

const PERMISOS_VETERINARIO = [...PERMISOS_RECEPCION, 'cola.confirmar_urgencia', 'visitas.crear'];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Cola', () => {
  it('lista los ingresos del día con su urgencia y estado', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCola();

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByText('Demo, Cliente')).toBeInTheDocument();
    expect(screen.getByText('Posible')).toBeInTheDocument();
    expect(screen.getByText('Esperando')).toBeInTheDocument();
    expect(screen.getByText('10/11/2026 · 1 ingreso')).toBeInTheDocument();
  });

  it('recepción no ve las acciones de confirmar o descartar urgencia', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCola();

    await screen.findByText('Paciente Demo');

    expect(screen.getByRole('button', { name: 'Al consultorio' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));

    expect(screen.queryByRole('menuitem', { name: 'Confirmar urgencia' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Descartar urgencia' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Atendido' })).toBeInTheDocument();
  });

  it('el veterinario ve las acciones de confirmar y descartar urgencia', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_VETERINARIO));
    renderizarCola();

    await screen.findByRole('button', { name: 'Iniciar visita' });
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));

    expect(screen.getByRole('menuitem', { name: 'Confirmar urgencia' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Descartar urgencia' })).toBeInTheDocument();
  });

  it('el veterinario puede iniciar la visita desde la cola', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_VETERINARIO));
    renderizarCola();

    expect(await screen.findByRole('button', { name: 'Iniciar visita' })).toBeInTheDocument();
  });

  it('recepción no ve el botón para iniciar la visita', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCola();

    await screen.findByText('Paciente Demo');

    expect(screen.queryByRole('button', { name: 'Iniciar visita' })).toBeNull();
  });
});
