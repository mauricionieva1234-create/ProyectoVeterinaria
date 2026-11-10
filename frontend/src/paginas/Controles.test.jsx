import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Controles } from './Controles.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function control(id, nombre, fechaControl) {
  return {
    id,
    pacienteId: id,
    visitaOrigenId: 1,
    fechaControl,
    franja: 'manana',
    motivo: 'Control de vacunación',
    estado: 'pendiente',
    controlNuevoId: null,
    visitaRealizadaId: null,
    anulado: false,
    motivoAnulacion: null,
    anuladoPor: null,
    anuladoEn: null,
    creadoEn: '2026-11-01T12:00:00.000Z',
    actualizadoEn: '2026-11-01T12:00:00.000Z',
    paciente: {
      id,
      nombre,
      codigoInterno: `PAC-00000${id}`,
      especieId: 1,
      especieNombre: 'canino',
    },
    cliente: {
      id: 5,
      nombreCompleto: 'Demo, Cliente',
      telefonoPrincipal: '3815550001',
      fichaIncompleta: false,
    },
    ultimoAviso: null,
  };
}

const HOY = control(1, 'Paciente Hoy', '2026-11-10');
const MANANA = control(2, 'Paciente Mañana', '2026-11-11');
const VENCIDO = { ...control(3, 'Paciente Vencido', '2026-11-09'), estado: 'ausente' };

const PERMISOS_RECEPCION = ['controles.ver', 'avisos.ver', 'avisos.crear'];
const PERMISOS_VETERINARIO = [...PERMISOS_RECEPCION, 'controles.editar'];

function crearFetch(permisos) {
  return vi.fn(async (url) => {
    const ruta = String(url);

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Usuario Prueba', rol: 'recepcion' },
        permisos,
      });
    }

    if (ruta === '/api/controles/recordar') {
      return respuestaJson({ hoy: [HOY], manana: [MANANA] });
    }

    if (ruta.startsWith('/api/controles?')) {
      return respuestaJson({
        datos: [VENCIDO],
        paginacion: { pagina: 1, limite: 50, total: 1, totalPaginas: 1 },
      });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Controles />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Controles', () => {
  it('muestra los controles de hoy, mañana y los vencidos', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizar();

    expect(await screen.findByText('Paciente Hoy')).toBeInTheDocument();
    expect(screen.getByText('Paciente Mañana')).toBeInTheDocument();
    expect(await screen.findByText('Paciente Vencido')).toBeInTheDocument();
    expect(screen.getAllByText('Control de vacunación').length).toBeGreaterThan(0);
  });

  it('recepción puede registrar avisos pero no reprogramar ni cerrar controles', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizar();

    await screen.findByText('Paciente Hoy');

    expect(screen.getAllByRole('button', { name: 'Avisos' }).length).toBe(3);
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Realizado' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });

  it('el veterinario ve las acciones de gestión de controles', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_VETERINARIO));
    renderizar();

    await screen.findByText('Paciente Hoy');

    expect(screen.getAllByRole('button', { name: 'Reprogramar' }).length).toBe(3);
    expect(screen.getAllByRole('button', { name: 'Realizado' }).length).toBe(3);
  });
});
