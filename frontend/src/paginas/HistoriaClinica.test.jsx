import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoriaClinica } from './HistoriaClinica.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const HISTORIA = {
  paciente: {
    id: 10,
    nombre: 'Luna Demo',
    codigoInterno: 'PAC-000010',
    especieNombre: 'canino',
    razaNombre: null,
    sexo: 'hembra',
    fechaNacimiento: '2022-01-01',
    fechaDeceso: null,
    cliente: {
      id: 5,
      nombreCompleto: 'Demo, Cliente',
      telefonoPrincipal: '3815550001',
    },
  },
  visitas: [
    {
      id: 1,
      inicioEn: '2026-11-10T14:00:00.000Z',
      cierreEn: '2026-11-10T15:00:00.000Z',
      veterinarioNombre: 'Vet Prueba',
      estado: 'cerrada',
      motivoConsulta: 'Control ficticio',
      temperaturaC: 38.5,
      pesoKg: 12.4,
      anamnesis: 'Paciente ficticia sin novedades',
      diagnostico: 'Sin particularidades',
      observaciones: null,
      medicacion: [
        {
          id: 1,
          medicamento: 'Medicamento demo',
          dosis: '1 ml',
          via: 'oral',
          frecuencia: 'Cada 12 horas',
          duracionDias: 5,
        },
      ],
      notas: [
        {
          id: 1,
          texto: 'Nota ficticia de seguimiento',
          autorNombre: 'Vet Prueba',
          creadoEn: '2026-11-10T15:10:00.000Z',
        },
      ],
    },
  ],
  registros: {
    vacunas: [
      {
        id: 1,
        vacuna: 'Vacuna demo',
        lote: null,
        fechaAplicacion: '2026-11-10',
        fechaProximaDosis: null,
        aplicadaPorNombre: 'Vet Prueba',
      },
    ],
    antiparasitarios: [],
    estudios: [],
    cirugias: [],
  },
  controles: [
    {
      id: 1,
      fechaControl: '2026-12-01',
      franja: 'manana',
      motivo: 'Control posterior ficticio',
      estado: 'pendiente',
      avisos: [
        {
          id: 1,
          canal: 'llamada',
          resultado: 'avisado',
          nota: 'Aviso ficticio',
          realizadoPorNombre: 'Vet Prueba',
          realizadoEn: '2026-11-12T13:00:00.000Z',
        },
      ],
    },
  ],
  adjuntos: [
    {
      id: 1,
      nombreOriginal: 'estudio-demo.pdf',
      tamanoBytes: 1024,
      subidoPorNombre: 'Vet Prueba',
      creadoEn: '2026-11-10T15:20:00.000Z',
    },
  ],
  generadoEn: '2026-11-15T12:00:00.000Z',
};

function crearFetch({ alExportar } = {}) {
  return vi.fn(async (url, opciones = {}) => {
    const ruta = String(url);

    if (ruta === '/api/pacientes/10/historia-clinica' && opciones.method !== 'POST') {
      return respuestaJson({ historia: HISTORIA });
    }

    if (ruta === '/api/pacientes/10/historia-clinica/exportar' && opciones.method === 'POST') {
      alExportar?.(JSON.parse(opciones.body));
      return respuestaJson({ historia: HISTORIA });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarHistoria() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/pacientes/10/historia-clinica']}>
        <Routes>
          <Route path="/pacientes/:id/historia-clinica" element={<HistoriaClinica />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HistoriaClinica', () => {
  it('muestra la historia completa del paciente en modo lectura', async () => {
    vi.stubGlobal('fetch', crearFetch());
    renderizarHistoria();

    expect(await screen.findByRole('heading', { name: 'Historia clínica' })).toBeInTheDocument();
    expect(screen.getByText('Luna Demo')).toBeInTheDocument();
    expect(screen.getByText('Paciente ficticia sin novedades')).toBeInTheDocument();
    expect(screen.getByText('Medicamento demo')).toBeInTheDocument();
    expect(screen.getByText(/Nota ficticia de seguimiento/)).toBeInTheDocument();
    expect(screen.getByText('Vacuna demo')).toBeInTheDocument();
    expect(screen.getByText('Control posterior ficticio')).toBeInTheDocument();
    expect(screen.getByText(/Aviso ficticio/)).toBeInTheDocument();
    expect(screen.getByText(/estudio-demo\.pdf/)).toBeInTheDocument();
  });

  it('exige verificar el documento y registra la exportación antes de imprimir', async () => {
    const alExportar = vi.fn();
    vi.stubGlobal('fetch', crearFetch({ alExportar }));
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    const usuario = userEvent.setup();

    renderizarHistoria();

    await usuario.click(await screen.findByRole('button', { name: 'Imprimir / exportar' }));

    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText(/Verificá su documento/)).toBeInTheDocument();

    const confirmar = within(dialogo).getByRole('button', { name: 'Imprimir / exportar' });
    expect(confirmar).toBeDisabled();

    await usuario.click(within(dialogo).getByRole('checkbox'));
    await usuario.click(confirmar);

    await waitFor(() => {
      expect(alExportar).toHaveBeenCalledWith({
        entregadoA: 'Demo, Cliente',
        documentoVerificado: true,
      });
    });

    expect(
      await screen.findByText(/La exportación quedó registrada en la auditoría/),
    ).toBeInTheDocument();

    await waitFor(() => expect(imprimir).toHaveBeenCalled());
  });
});
