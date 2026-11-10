import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioVisita } from './FormularioVisita.jsx';

const PACIENTE = {
  id: 10,
  nombre: 'Paciente Demo',
  codigoInterno: 'PAC-000010',
  especieId: 1,
  especieNombre: 'canino',
  provisorio: false,
};

const VISITA_BORRADOR = {
  id: 1,
  estado: 'borrador',
  motivoConsulta: '',
  anamnesis: '',
  temperaturaC: null,
  pesoKg: null,
  diagnostico: '',
  observaciones: '',
  actualizadoEn: '2026-11-10T12:00:00.000Z',
};

const VISITA_CERRADA = {
  ...VISITA_BORRADOR,
  estado: 'cerrada',
  motivoConsulta: 'Control anual',
  cierreEn: '2026-11-10T13:00:00.000Z',
};

function renderizar(visita) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <FormularioVisita
        visita={visita}
        paciente={PACIENTE}
        onGuardada={vi.fn()}
        onCancelar={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FormularioVisita', () => {
  it('exige motivo de consulta para cerrar una visita en borrador', async () => {
    const usuario = userEvent.setup();
    renderizar(VISITA_BORRADOR);

    await usuario.click(screen.getByRole('button', { name: 'Cerrar visita' }));

    expect(
      await screen.findByText('El motivo de consulta es obligatorio para cerrar la visita'),
    ).toBeInTheDocument();
  });

  it('exige motivo de cambio al corregir una visita cerrada', async () => {
    const usuario = userEvent.setup();
    renderizar(VISITA_CERRADA);

    await usuario.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    expect(
      await screen.findByText('Indicá el motivo del cambio (mínimo 3 caracteres)'),
    ).toBeInTheDocument();
  });

  it('en borrador los datos clínicos se editan sin motivo de cambio', () => {
    renderizar(VISITA_BORRADOR);

    expect(screen.getByLabelText('Anamnesis')).toBeEnabled();
    expect(screen.queryByLabelText('Motivo del cambio')).toBeNull();
  });
});
