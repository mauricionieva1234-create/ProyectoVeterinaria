import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FichaCliente } from './FichaCliente.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CLIENTE = {
  id: 1,
  nombre: 'Cliente',
  apellido: 'Demo',
  tipoDocumento: 'DNI',
  nroDocumento: '90000001',
  telefonoPrincipal: '3815550001',
  telefonoEsWhatsapp: true,
  telefonoAlternativo: null,
  email: null,
  calleNumero: null,
  localidadBarrio: null,
  provincia: null,
  pais: 'Argentina',
  aceptaCorreo: false,
  aceptaWhatsapp: false,
  fechaConsentimiento: null,
  observaciones: null,
  altaRapida: false,
  fichaIncompleta: false,
  fusionadoEnClienteId: null,
  creadoEn: '2026-11-10T12:00:00.000Z',
  actualizadoEn: '2026-11-10T12:00:00.000Z',
  pacientes: [],
};

const PACIENTE_CREADO = {
  id: 9,
  clienteId: 1,
  nombre: 'Mascota Nueva',
  especieId: 1,
  razaId: null,
  sexo: 'desconocido',
  fechaDeceso: null,
};

function crearFetch() {
  return vi.fn(async (url, opciones = {}) => {
    const ruta = String(url);

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Admin Prueba', rol: 'admin' },
        permisos: [
          'clientes.ver',
          'clientes.editar',
          'pacientes.ver',
          'pacientes.crear',
          'cola.ver',
          'cola.crear',
        ],
      });
    }

    if (ruta === '/api/clientes/1') {
      return respuestaJson({ cliente: CLIENTE });
    }

    if (ruta.startsWith('/api/catalogos/especies')) {
      return respuestaJson({ datos: [{ id: 1, nombre: 'canino' }] });
    }

    if (ruta.startsWith('/api/catalogos/razas')) {
      return respuestaJson({ datos: [] });
    }

    if (ruta === '/api/pacientes' && opciones.method === 'POST') {
      return respuestaJson({ paciente: PACIENTE_CREADO }, 201);
    }

    if (ruta === '/api/cola' && opciones.method === 'POST') {
      return respuestaJson({ ingreso: { id: 5, pacienteId: 9 } }, 201);
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
      <MemoryRouter initialEntries={['/clientes/1']}>
        <Routes>
          <Route path="/clientes/:id" element={<FichaCliente />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FichaCliente', () => {
  it('pregunta si el paciente nuevo va a la lista de espera y lo agrega', async () => {
    const fetchFalso = crearFetch();
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();
    renderizarFicha();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo paciente' }));
    await usuario.type(await screen.findByLabelText('Nombre'), 'Mascota Nueva');

    await screen.findByRole('option', { name: 'canino' });
    await usuario.selectOptions(screen.getByLabelText('Especie'), '1');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/¿Querés ingresar a/)).toBeInTheDocument();
    expect(screen.getByText('Mascota Nueva')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Sí, agregar' }));

    // El formulario de la cola llega con la mascota ya elegida.
    expect(await screen.findByRole('button', { name: 'Agregar a la cola' })).toBeInTheDocument();
    expect(screen.getByLabelText('Servicio')).toHaveValue('atencion_clinica');

    await usuario.click(screen.getByRole('button', { name: 'Agregar a la cola' }));

    expect(
      await screen.findByText(/Mascota Nueva se agregó a la lista de espera/),
    ).toBeInTheDocument();

    const llamada = fetchFalso.mock.calls.find(
      ([url, opciones]) => String(url) === '/api/cola' && opciones.method === 'POST',
    );
    expect(llamada).toBeDefined();
    expect(JSON.parse(llamada[1].body)).toMatchObject({
      pacienteId: 9,
      servicio: 'atencion_clinica',
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
