import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Caja } from './Caja.jsx';

function respuestaJson(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PENDIENTE = {
  origen: 'ingreso',
  ingresoId: 1,
  ingresoFecha: '2026-11-15',
  numeroOrden: 3,
  servicio: 'atencion_clinica',
  ingresoEstado: 'esperando_cobro',
  horaLlegada: '2026-11-15T12:00:00.000Z',
  visitaId: 12,
  visitaEstado: 'cerrada',
  cierreEn: '2026-11-15T18:00:00.000Z',
  paciente: { id: 10, nombre: 'Paciente Pendiente', codigoInterno: 'PAC-000010' },
  cliente: { id: 5, nombreCompleto: 'Cliente Demo', telefonoPrincipal: '3815550100' },
};

const DEUDA = {
  id: 20,
  visitaId: 21,
  total: 8000,
  pagado: 4000,
  saldo: 4000,
  estado: 'parcial',
  paciente: { id: 11, nombre: 'Paciente Deuda', codigoInterno: 'PAC-000011' },
  cliente: { id: 5, nombreCompleto: 'Cliente Demo' },
};

const COBRO_PAGADO = {
  ...DEUDA,
  id: 21,
  visitaId: 22,
  total: 5000,
  pagado: 5000,
  saldo: 0,
  estado: 'pagado',
  paciente: { id: 12, nombre: 'Paciente Pagado', codigoInterno: 'PAC-000012' },
};

const DETALLE_COBRO = {
  ...DEUDA,
  items: [
    {
      id: '1',
      precioId: '1',
      nombre: 'Consulta demo',
      cantidad: 2,
      importeUnitario: 3000,
      subtotal: 6000,
    },
    {
      id: '2',
      precioId: null,
      nombre: 'Concepto manual demo',
      cantidad: 1,
      importeUnitario: 2000,
      subtotal: 2000,
    },
  ],
  pagos: [
    {
      id: 9,
      cobroId: 20,
      medio: 'efectivo',
      monto: 4000,
      fecha: '2026-11-15T15:00:00.000Z',
      registradoPorNombre: 'Recepción Prueba',
      anulado: false,
    },
  ],
  observaciones: 'Detalle de prueba',
};

const CAJA = {
  fecha: '2026-11-15',
  porMedio: [
    { medio: 'efectivo', cantidad: 1, total: 4000 },
    { medio: 'debito', cantidad: 1, total: 1500 },
    { medio: 'credito', cantidad: 0, total: 0 },
    { medio: 'transferencia', cantidad: 0, total: 0 },
  ],
  totalCobrado: 5500,
  cantidadPagos: 2,
  pagos: [
    {
      id: 1,
      cobroId: 20,
      medio: 'efectivo',
      monto: 4000,
      fecha: '2026-11-15T15:00:00.000Z',
      registradoPorNombre: 'Recepción Prueba',
      paciente: { id: 10, nombre: 'Paciente Pendiente', codigoInterno: 'PAC-000010' },
      cliente: { nombreCompleto: 'Cliente Demo' },
    },
    {
      id: 2,
      cobroId: 20,
      medio: 'debito',
      monto: 1500,
      fecha: '2026-11-15T16:00:00.000Z',
      registradoPorNombre: 'Recepción Prueba',
      paciente: { id: 10, nombre: 'Paciente Pendiente', codigoInterno: 'PAC-000010' },
      cliente: { nombreCompleto: 'Cliente Demo' },
    },
  ],
  cobrosCreados: 2,
  totalCreado: 13000,
  deudaTotal: 4000,
  cantidadDeudas: 1,
  pendientes: 1,
};

function crearFetch(permisos) {
  return vi.fn(async (url) => {
    const ruta = String(url);

    if (ruta === '/api/auth/me') {
      return respuestaJson({
        usuario: { id: 1, nombreCompleto: 'Usuario Prueba', rol: 'recepcion' },
        permisos,
      });
    }

    if (ruta.startsWith('/api/cobros/caja')) {
      return respuestaJson({ caja: CAJA });
    }

    if (ruta === '/api/cobros/pendientes') {
      return respuestaJson({ pendientes: [PENDIENTE] });
    }

    if (ruta.startsWith('/api/cobros/deudas')) {
      return respuestaJson({ datos: [DEUDA], paginacion: { pagina: 1, limite: 100, total: 1 } });
    }

    if (ruta.startsWith('/api/cobros?')) {
      return respuestaJson({
        datos: [COBRO_PAGADO],
        paginacion: { pagina: 1, limite: 100, total: 1 },
      });
    }

    if (ruta === '/api/cobros/20') {
      return respuestaJson({ cobro: DETALLE_COBRO });
    }

    if (ruta.startsWith('/api/precios')) {
      return respuestaJson({
        datos: [
          { id: 1, nombre: 'Consulta demo', importe: 3000, activo: true },
          { id: 2, nombre: 'Vacuna demo', importe: 2500, activo: true },
        ],
      });
    }

    throw new Error(`URL inesperada en el test: ${url}`);
  });
}

function renderizarCaja() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Caja />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PERMISOS_RECEPCION = [
  'caja.ver',
  'cobros.ver',
  'cobros.crear',
  'cobros.editar',
  'pagos.registrar',
];

const PERMISOS_ADMIN = [...PERMISOS_RECEPCION, 'cobros.anular', 'pagos.anular'];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Caja', () => {
  it('muestra pendientes, deudas, cobros del día y el cierre por medio', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    expect((await screen.findAllByText('Paciente Pendiente')).length).toBeGreaterThan(0);
    expect(screen.getByText('Paciente Deuda')).toBeInTheDocument();
    expect(screen.getByText('Paciente Pagado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThan(0);
    expect(screen.getByText('Deuda acumulada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir cierre' })).toBeInTheDocument();
  });

  it('abre el formulario de cobro desde un pendiente', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByLabelText('Total del cobro')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Observaciones')).toBeInTheDocument();

    // El pago inicial aparece recién cuando el total es mayor que cero.
    fireEvent.change(within(dialogo).getByLabelText('Total del cobro'), {
      target: { value: '5000' },
    });
    expect(await within(dialogo).findByLabelText('Monto')).toBeInTheDocument();
  });

  it('abre el formulario de pago con el saldo de la deuda', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByLabelText('Medio de pago')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Monto')).toHaveValue(4000);
  });

  it('recepción no ve acciones de anulación', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    await screen.findAllByText('Paciente Pendiente');

    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
  });

  it('el admin ve anular cobros y pagos', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_ADMIN));
    renderizarCaja();

    await screen.findAllByText('Paciente Pendiente');

    // Deuda, cobro del día y los dos movimientos del día.
    expect(screen.getAllByRole('button', { name: 'Anular' }).length).toBe(4);
  });

  it('abre el detalle del cobro con ítems, pagos y observaciones', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    const botones = await screen.findAllByRole('button', { name: 'Detalle' });
    fireEvent.click(botones[0]);

    const dialogo = await screen.findByRole('dialog');
    expect(await within(dialogo).findByText('Consulta demo')).toBeInTheDocument();
    expect(within(dialogo).getByText('Concepto manual demo')).toBeInTheDocument();
    expect(within(dialogo).getByText('Detalle de prueba')).toBeInTheDocument();
    expect(within(dialogo).getByText('Recepción Prueba')).toBeInTheDocument();
  });

  it('calcula el total al cargar un cobro detallado por ítem', async () => {
    vi.stubGlobal('fetch', crearFetch(PERMISOS_RECEPCION));
    renderizarCaja();

    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog');

    fireEvent.click(within(dialogo).getByLabelText('Detallado por ítem'));

    fireEvent.change(await within(dialogo).findByLabelText('Concepto del ítem 1'), {
      target: { value: 'Consulta demo' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Cantidad del ítem 1'), {
      target: { value: '2' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Importe unitario del ítem 1'), {
      target: { value: '5000' },
    });

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Agregar ítem' }));
    fireEvent.change(within(dialogo).getByLabelText('Concepto del ítem 2'), {
      target: { value: 'Vacuna demo' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Importe unitario del ítem 2'), {
      target: { value: '3000' },
    });

    expect(within(dialogo).getAllByText(/13\.000/).length).toBeGreaterThan(0);
  });
});
