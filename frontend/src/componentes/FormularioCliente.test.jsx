import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioCliente } from './FormularioCliente.jsx';

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

  const onGuardado = props.onGuardado ?? vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <FormularioCliente
        cliente={props.cliente}
        onGuardado={onGuardado}
        onCancelar={props.onCancelar ?? vi.fn()}
      />
    </QueryClientProvider>,
  );

  return { onGuardado };
}

async function completarDatosMinimos(usuario) {
  await usuario.type(screen.getByLabelText('Nombre'), 'Cliente');
  await usuario.type(screen.getByLabelText('Apellido'), 'Prueba');
  await usuario.type(screen.getByLabelText('Número de documento'), '90000001');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FormularioCliente', () => {
  it('exige nombre, apellido y documento en el alta', async () => {
    const usuario = userEvent.setup();
    renderizarFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El nombre debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('El apellido debe tener al menos 2 caracteres')).toBeInTheDocument();
    expect(screen.getByText('El documento debe tener al menos 3 caracteres')).toBeInTheDocument();
  });

  it('crea un cliente y avisa al terminar', async () => {
    const fetchFalso = vi.fn(async () => respuestaJson({ cliente: { id: 7 } }, 201));
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    const { onGuardado } = renderizarFormulario();

    await completarDatosMinimos(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());

    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/clientes',
      expect.objectContaining({ method: 'POST' }),
    );

    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(cuerpo.nroDocumento).toBe('90000001');
    expect(cuerpo.confirmarDuplicado).toBeUndefined();
  });

  it('muestra los candidatos y permite confirmar el documento duplicado', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(
        respuestaJson(
          {
            error: {
              codigo: 'CLIENTE_DUPLICADO',
              mensaje: 'Ya existe un cliente con ese documento',
              detalles: [
                {
                  campo: 'nroDocumento',
                  candidatos: [
                    {
                      id: 3,
                      nombreCompleto: 'Cliente Existente',
                      nroDocumento: '***.***.001',
                      telefonoPrincipal: '3815550001',
                      pacientes: 1,
                      creadoEn: '2026-01-01T00:00:00.000Z',
                    },
                  ],
                },
              ],
            },
          },
          409,
        ),
      )
      .mockResolvedValueOnce(respuestaJson({ cliente: { id: 8 } }, 201));

    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    const { onGuardado } = renderizarFormulario();

    await completarDatosMinimos(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ya existe un cliente con ese documento:')).toBeInTheDocument();
    expect(screen.getByText(/Cliente Existente/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Crear igual' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());

    const segundoCuerpo = JSON.parse(fetchFalso.mock.calls[1][1].body);
    expect(segundoCuerpo.confirmarDuplicado).toBe(true);
  });
});
