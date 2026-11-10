import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioAltaRapida } from './FormularioAltaRapida.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderizarFormulario(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const onCreado = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <FormularioAltaRapida puedeConfirmar onCreado={onCreado} onCancelar={() => {}} {...props} />
    </QueryClientProvider>,
  );

  return { onCreado };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FormularioAltaRapida', () => {
  it('valida los datos obligatorios antes de enviar', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderizarFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Crear alta rápida' }));

    expect(
      await screen.findByText('El nombre debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('El apellido debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(screen.getByText('El documento debe tener al menos 3 caracteres')).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('envía el cuerpo esperado con la urgencia confirmada', async () => {
    const fetchFalso = vi.fn(async () =>
      respuestaJson({ cliente: {}, paciente: {}, ingreso: { id: 7 } }, 201),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    const { onCreado } = renderizarFormulario();

    await usuario.type(screen.getByLabelText('Nombre'), 'Urgencia');
    await usuario.type(screen.getByLabelText('Apellido'), 'Demo');
    await usuario.type(screen.getByLabelText('Número de documento'), '90000300');
    await usuario.selectOptions(screen.getByLabelText('Urgencia'), 'confirmada');
    await usuario.type(screen.getByLabelText('Comentario'), 'Datos inventados.');
    await usuario.click(screen.getByRole('button', { name: 'Crear alta rápida' }));

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('/api/cola/alta-rapida');
    expect(opciones.method).toBe('POST');

    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo).toMatchObject({
      nombre: 'Urgencia',
      apellido: 'Demo',
      tipoDocumento: 'DNI',
      nroDocumento: '90000300',
      servicio: 'atencion_clinica',
      urgencia: 'confirmada',
      comentario: 'Datos inventados.',
    });

    await waitFor(() => expect(onCreado).toHaveBeenCalledWith({ id: 7 }));
  });

  it('muestra los candidatos cuando el documento ya existe', async () => {
    const fetchFalso = vi.fn(async () =>
      respuestaJson(
        {
          error: {
            codigo: 'CLIENTE_DUPLICADO',
            mensaje: 'Ya existe un cliente con ese documento',
            detalles: [
              {
                campo: 'nroDocumento',
                mensaje: 'Revisá los clientes encontrados o confirmá el alta igual',
                candidatos: [
                  {
                    id: 9,
                    nombreCompleto: 'Cliente Existente',
                    nroDocumento: '***.***.001',
                    telefonoPrincipal: '3815550001',
                    pacientes: 2,
                  },
                ],
              },
            ],
          },
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderizarFormulario();

    await usuario.type(screen.getByLabelText('Nombre'), 'Urgencia');
    await usuario.type(screen.getByLabelText('Apellido'), 'Demo');
    await usuario.type(screen.getByLabelText('Número de documento'), '90000001');
    await usuario.click(screen.getByRole('button', { name: 'Crear alta rápida' }));

    expect(await screen.findByText(/Ya existe un cliente con ese documento/)).toBeInTheDocument();
    expect(screen.getByText(/Cliente Existente/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear igual' })).toBeInTheDocument();
  });
});
