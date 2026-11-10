import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FichaPaciente } from './FichaPaciente.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PACIENTE = {
  id: 10,
  clienteId: 5,
  cliente: { id: 5, nombreCompleto: 'Demo, Cliente', telefonoPrincipal: '3815550001' },
  nombre: 'Paciente Demo',
  codigoInterno: 'PAC-000010',
  especieId: 1,
  especieNombre: 'canino',
  razaNombre: null,
  sexo: 'hembra',
  castrado: false,
  esReproductor: false,
  fechaNacimiento: '2022-01-01',
  nacimientoAproximado: false,
  fechaCastracion: null,
  fechaDeceso: null,
  provisorio: false,
  fichaIncompleta: false,
  origen: null,
  color: null,
  chipCodigo: null,
  comentario: null,
  fotoAdjuntoId: null,
  historial: [],
  actualizadoEn: '2026-11-10T12:00:00.000Z',
};

const PERMISOS_VETERINARIO = [
  'pacientes.ver',
  'pacientes.editar',
  'visitas.ver',
  'visitas.crear',
  'registros.ver',
  'controles.ver',
  'adjuntos.ver',
  'adjuntos.crear',
];

const PERMISOS_RECEPCION = [
  'pacientes.ver',
  'pacientes.editar',
  'controles.ver',
  'avisos.ver',
  'adjuntos.ver',
  'adjuntos.crear',
];

function crearFetch(permisos) {
  return vi.fn(async (url) => {
    const ruta = String(url);

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Usuario Prueba', rol: 'recepcion' },
        permisos,
      });
    }

    if (ruta === '/api/pacientes/10') {
      return respuestaJson({ paciente: PACIENTE });
    }

    if (ruta.startsWith('/api/visitas?')) {
      return respuestaJson({
        datos: [],
        paginacion: { pagina: 1, limite: 20, total: 0, totalPaginas: 0 },
      });
    }

    if (ruta.startsWith('/api/controles?')) {
      return respuestaJson({
        datos: [],
        paginacion: { pagina: 1, limite: 20, total: 0, totalPaginas: 0 },
      });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarFicha() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/pacientes/10']}>
        <Routes>
          <Route path="/pacientes/:id" element={<FichaPaciente />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FichaPaciente', () => {
  it('el veterinario ve las pestañas clínicas y el botón de nueva visita', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_VETERINARIO));
    renderizarFicha();

    expect(await screen.findByRole('tab', { name: 'Visitas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vacuna' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Antiparasitario' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estudio' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Cirugía' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Controles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Adjuntos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva visita' })).toBeInTheDocument();
  });

  it('recepción solo ve controles y adjuntos, sin acceso a lo clínico', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarFicha();

    expect(await screen.findByRole('tab', { name: 'Controles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Adjuntos' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Visitas' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Vacuna' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva visita' })).toBeNull();
  });
});
