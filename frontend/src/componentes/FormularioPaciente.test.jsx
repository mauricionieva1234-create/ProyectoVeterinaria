import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormularioPaciente } from './FormularioPaciente.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CLIENTE = { id: 5, nombreCompleto: 'Cliente Demo' };

function crearFetch() {
  return vi.fn(async (url) => {
    if (String(url).startsWith('/api/catalogos/especies')) {
      return respuestaJson({ datos: [{ id: 1, nombre: 'canino' }] });
    }

    if (String(url).startsWith('/api/catalogos/razas')) {
      return respuestaJson({ datos: [{ id: 2, especieId: 1, nombre: 'Mestizo' }] });
    }

    if (String(url).startsWith('/api/clientes?')) {
      return respuestaJson({
        datos: [CLIENTE],
        paginacion: { pagina: 1, limite: 8, total: 1 },
      });
    }

    if (String(url) === '/api/pacientes') {
      return respuestaJson({ paciente: { id: 9, clienteId: 5, nombre: 'Mascota de Prueba' } }, 201);
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarFormulario(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const onGuardado = props.onGuardado ?? vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <FormularioPaciente
        paciente={props.paciente}
        cliente={props.cliente === undefined ? CLIENTE : props.cliente}
        permitirCambioDueno={props.permitirCambioDueno}
        onGuardado={onGuardado}
        onCancelar={props.onCancelar ?? vi.fn()}
      />
    </QueryClientProvider>,
  );

  return { onGuardado };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FormularioPaciente', () => {
  it('exige nombre y especie en el alta', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = userEvent.setup();
    renderizarFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Elegí una especie')).toBeInTheDocument();
  });

  it('crea un paciente con el dueño indicado', async () => {
    const fetchFalso = crearFetch();
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    const { onGuardado } = renderizarFormulario();

    await usuario.type(screen.getByLabelText('Nombre'), 'Mascota de Prueba');

    // Las especies llegan del catálogo antes de poder elegirlas.
    await screen.findByRole('option', { name: 'canino' });
    await usuario.selectOptions(screen.getByLabelText('Especie'), '1');

    await screen.findByRole('option', { name: 'Mestizo' });
    await usuario.selectOptions(screen.getByLabelText('Raza'), '2');

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalled());

    const llamada = fetchFalso.mock.calls.find(([url]) => String(url) === '/api/pacientes');
    expect(llamada).toBeDefined();

    const cuerpo = JSON.parse(llamada[1].body);
    expect(cuerpo.clienteId).toBe(5);
    expect(cuerpo.especieId).toBe(1);
    expect(cuerpo.razaId).toBe(2);
    expect(cuerpo.provisorio).toBe(false);
  });

  it('en edición conserva los datos del paciente y muestra el dueño', () => {
    vi.stubGlobal('fetch', crearFetch());
    renderizarFormulario({
      paciente: {
        id: 9,
        clienteId: 5,
        nombre: 'Mascota Existente',
        especieId: 1,
        razaId: 2,
        sexo: 'hembra',
        castrado: true,
        fechaNacimiento: '2021-04-15',
        nacimientoAproximado: false,
        esReproductor: false,
        provisorio: false,
        origen: 'adoptado',
        chipCodigo: null,
        color: 'Marrón',
        comentario: null,
        fechaCastracion: null,
        fechaDeceso: null,
      },
    });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Mascota Existente');
    expect(screen.getByText('Cliente Demo')).toBeInTheDocument();
    expect(screen.getByLabelText('Sexo')).toHaveValue('hembra');
    expect(screen.getByLabelText('Está castrado')).toBeChecked();
  });

  it('busca el dueño sin tener que tocar «Cambiar»', async () => {
    vi.stubGlobal('fetch', crearFetch());
    const usuario = userEvent.setup();
    renderizarFormulario({ cliente: null, permitirCambioDueno: true });

    await usuario.type(screen.getByLabelText('Buscar cliente'), 'Demo');

    expect(await screen.findByRole('button', { name: /Cliente Demo/ })).toBeInTheDocument();
  });
});
