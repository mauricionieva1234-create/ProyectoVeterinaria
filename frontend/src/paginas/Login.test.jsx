import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

function crearFetch(login) {
  return vi.fn(async (url) => {
    if (String(url).endsWith('/auth/me')) {
      return respuestaJson(
        {
          error: {
            codigo: 'NO_AUTENTICADO',
            mensaje: 'Tenés que iniciar sesión',
            detalles: [],
          },
        },
        401,
      );
    }

    if (String(url).endsWith('/auth/login')) {
      return login();
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      { path: '/login', element: <Login /> },
      { path: '/', element: <p>Inicio protegido</p> },
    ],
    { initialEntries: ['/login'] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Login', () => {
  it('inicia sesión y navega al inicio', async () => {
    vi.stubGlobal(
      'fetch',
      crearFetch(() =>
        respuestaJson({
          usuario: {
            id: 1,
            nombreCompleto: 'Veterinario Demo',
            email: 'demo.veterinario@example.com',
            rol: 'veterinario',
            matricula: 'DEMO-001',
            activo: true,
          },
          permisos: ['visitas.editar'],
        }),
      ),
    );

    const usuario = userEvent.setup();
    renderizarLogin();

    await usuario.type(screen.getByLabelText('Email'), 'demo.veterinario@example.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'ClaveSegura123');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Inicio protegido')).toBeInTheDocument();
  });

  it('muestra el error del backend cuando las credenciales son incorrectas', async () => {
    vi.stubGlobal(
      'fetch',
      crearFetch(() =>
        respuestaJson(
          {
            error: {
              codigo: 'CREDENCIALES_INVALIDAS',
              mensaje: 'El email o la contraseña no son correctos',
              detalles: [],
            },
          },
          401,
        ),
      ),
    );

    const usuario = userEvent.setup();
    renderizarLogin();

    await usuario.type(screen.getByLabelText('Email'), 'demo.veterinario@example.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-equivocada');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El email o la contraseña no son correctos',
    );
  });

  it('valida los campos antes de enviar', async () => {
    const fetchFalso = crearFetch(() => respuestaJson({}));
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderizarLogin();

    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingresá tu email')).toBeInTheDocument();
    expect(await screen.findByText('Ingresá tu contraseña')).toBeInTheDocument();

    // Nunca se llamó al endpoint de login.
    expect(fetchFalso.mock.calls.some(([url]) => String(url).endsWith('/auth/login'))).toBe(false);
  });
});
