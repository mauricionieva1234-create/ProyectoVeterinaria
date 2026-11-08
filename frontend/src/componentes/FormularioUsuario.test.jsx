import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioUsuario } from './FormularioUsuario.jsx';

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
      <FormularioUsuario
        onGuardado={onGuardado}
        onCancelar={props.onCancelar ?? vi.fn()}
        usuario={props.usuario}
      />
    </QueryClientProvider>,
  );

  return { onGuardado };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FormularioUsuario', () => {
  it('exige los datos mínimos en el alta', async () => {
    const usuario = userEvent.setup();
    renderizarFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El nombre completo debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Ingresá un email')).toBeInTheDocument();
    expect(await screen.findByText('La contraseña es obligatoria')).toBeInTheDocument();
  });

  it('crea un usuario y avisa al terminar', async () => {
    const fetchFalso = vi.fn(async () =>
      respuestaJson(
        {
          usuario: {
            id: 7,
            nombreCompleto: 'Nuevo Usuario',
            email: 'nuevo@example.com',
            rol: 'veterinario',
            matricula: null,
            activo: true,
          },
        },
        201,
      ),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    const { onGuardado } = renderizarFormulario();

    await usuario.type(screen.getByLabelText('Nombre completo'), 'Nuevo Usuario');
    await usuario.type(screen.getByLabelText('Email'), 'nuevo@example.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'ClaveSegura123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());

    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/usuarios',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('en edición no exige contraseña y muestra la ayuda correspondiente', () => {
    renderizarFormulario({
      usuario: {
        id: 3,
        nombreCompleto: 'Usuario Existente',
        email: 'existente@example.com',
        rol: 'recepcion',
        matricula: null,
        activo: true,
      },
    });

    expect(
      screen.getByText('Dejala vacía para conservar la contraseña actual.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Usuario Existente');
    expect(screen.queryByLabelText('Matrícula')).not.toBeInTheDocument();
  });
});
