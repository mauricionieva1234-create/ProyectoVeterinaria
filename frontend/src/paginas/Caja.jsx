import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  anularCobro,
  anularPago,
  listarCobros,
  listarDeudas,
  listarPendientes,
  obtenerCaja,
} from '../api/cobros.js';
import { FormularioAnular } from '../componentes/FormularioAnular.jsx';
import { FormularioCobro } from '../componentes/FormularioCobro.jsx';
import { FormularioPago } from '../componentes/FormularioPago.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezado } from '../componentes/tonos.js';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_ESTADO_COBRO,
  ETIQUETAS_MEDIO,
  claseEstadoCobro,
  etiqueta,
  formatearMoneda,
} from '../utils/etiquetasCobros.js';
import { ETIQUETAS_SERVICIO } from '../utils/etiquetasCola.js';
import { fechaHoy, formatearFecha, formatearHora } from '../utils/formato.js';

const claseBoton =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

const claseBotonPrincipal =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-teal-800 disabled:opacity-50';

const claseBotonPago =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50';

function Tarjeta({ titulo, valor, detalle, tono = 'teal' }) {
  const estilos = {
    teal: 'border-teal-200 bg-teal-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50',
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${estilos[tono] ?? estilos.teal}`}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-600">{detalle}</p>}
    </article>
  );
}

function EstadoCobro({ estado }) {
  return (
    <span
      className={['rounded-full px-2 py-0.5 text-xs font-medium', claseEstadoCobro(estado)].join(
        ' ',
      )}
    >
      {etiqueta(ETIQUETAS_ESTADO_COBRO, estado)}
    </span>
  );
}

// Tabla reutilizable para deudas y cobros del día, con acciones según permisos.
function TablaCobros({
  cobros,
  onPagar,
  onEditar,
  onAnular,
  puedePagar,
  puedeEditar,
  puedeAnular,
}) {
  if (cobros.length === 0) {
    return <p className="text-sm text-slate-500">No hay cobros para mostrar.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">Paciente</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Pagado</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cobros.map((cobro) => (
            <tr key={cobro.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link
                  to={`/pacientes/${cobro.paciente.id}`}
                  className="font-medium text-teal-800 hover:underline"
                >
                  {cobro.paciente.nombre}
                </Link>
                <p className="text-xs text-slate-500">{cobro.cliente.nombreCompleto}</p>
              </td>
              <td className="px-3 py-2">
                <EstadoCobro estado={cobro.estado} />
              </td>
              <td className="px-3 py-2 text-right text-slate-700">
                {formatearMoneda(cobro.total)}
              </td>
              <td className="px-3 py-2 text-right text-slate-700">
                {formatearMoneda(cobro.pagado)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-rose-700">
                {formatearMoneda(cobro.saldo)}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  {puedePagar && cobro.saldo > 0 && (
                    <button type="button" className={claseBotonPago} onClick={() => onPagar(cobro)}>
                      Registrar pago
                    </button>
                  )}
                  {puedeEditar && (
                    <button type="button" className={claseBoton} onClick={() => onEditar(cobro)}>
                      Editar total
                    </button>
                  )}
                  {puedeAnular && (
                    <button type="button" className={claseBoton} onClick={() => onAnular(cobro)}>
                      Anular
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Caja() {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puede = (accion) => permisos.includes(accion);

  const [fecha, setFecha] = useState(fechaHoy());
  const [pendienteCobro, setPendienteCobro] = useState(null);
  const [cobroEdicion, setCobroEdicion] = useState(null);
  const [cobroPago, setCobroPago] = useState(null);
  const [cobroAnular, setCobroAnular] = useState(null);
  const [pagoAnular, setPagoAnular] = useState(null);

  const caja = useQuery({ queryKey: ['caja', fecha], queryFn: () => obtenerCaja(fecha) });
  const pendientes = useQuery({ queryKey: ['pendientes'], queryFn: listarPendientes });
  const deudas = useQuery({
    queryKey: ['deudas'],
    queryFn: () => listarDeudas({ limite: 100 }),
  });
  const cobros = useQuery({
    queryKey: ['cobros', fecha],
    queryFn: () => listarCobros({ desde: fecha, hasta: fecha, limite: 100 }),
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['caja'] });
    queryClient.invalidateQueries({ queryKey: ['cobros'] });
    queryClient.invalidateQueries({ queryKey: ['deudas'] });
    queryClient.invalidateQueries({ queryKey: ['pendientes'] });
    queryClient.invalidateQueries({ queryKey: ['cola'] });
    queryClient.invalidateQueries({ queryKey: ['visita'] });
  }

  const anularCobroMutation = useMutation({
    mutationFn: ({ id, motivo }) => anularCobro(id, { motivo }),
    onSuccess: () => {
      invalidar();
      setCobroAnular(null);
    },
  });

  const anularPagoMutation = useMutation({
    mutationFn: ({ cobroId, pagoId, motivo }) => anularPago(cobroId, pagoId, { motivo }),
    onSuccess: () => {
      invalidar();
      setPagoAnular(null);
    },
  });

  const datosCaja = caja.data?.caja;
  const listaPendientes = pendientes.data?.pendientes ?? [];
  const listaDeudas = deudas.data?.datos ?? [];
  const listaCobros = cobros.data?.datos ?? [];
  const movimientos = datosCaja?.pagos ?? [];

  const errorConsulta = [caja, pendientes, deudas, cobros].find(
    (consulta) => consulta.isError,
  )?.error;

  const puedeCobrar = puede('cobros.crear');
  const puedeEditar = puede('cobros.editar');
  const puedePagar = puede('pagos.registrar');
  const puedeAnularCobro = puede('cobros.anular');
  const puedeAnularPago = puede('pagos.anular');

  return (
    <section className="space-y-5">
      <div className="print:hidden">
        <EncabezadoPagina
          tono="emerald"
          titulo="Caja"
          descripcion={
            <>
              {formatearFecha(fecha)} · {formatearMoneda(datosCaja?.totalCobrado ?? 0)} cobrado ·{' '}
              {listaPendientes.length} pendiente{listaPendientes.length === 1 ? '' : 's'} de cobro
            </>
          }
        >
          <Link to="/cola" className={claseBotonEncabezado}>
            Cola del día
          </Link>
        </EncabezadoPagina>
      </div>

      {errorConsulta && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          No se pudo cargar la caja: {errorConsulta.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Tarjeta
          titulo="Cobrado hoy"
          valor={formatearMoneda(datosCaja?.totalCobrado ?? 0)}
          detalle={`${datosCaja?.cantidadPagos ?? 0} pago${datosCaja?.cantidadPagos === 1 ? '' : 's'}`}
          tono="emerald"
        />
        <Tarjeta
          titulo="Cobros creados"
          valor={formatearMoneda(datosCaja?.totalCreado ?? 0)}
          detalle={`${datosCaja?.cobrosCreados ?? 0} cobro${datosCaja?.cobrosCreados === 1 ? '' : 's'} del día`}
        />
        <Tarjeta
          titulo="Deuda acumulada"
          valor={formatearMoneda(datosCaja?.deudaTotal ?? 0)}
          detalle={`${datosCaja?.cantidadDeudas ?? 0} cobro${datosCaja?.cantidadDeudas === 1 ? '' : 's'} con saldo`}
          tono="rose"
        />
        <Tarjeta
          titulo="Pendientes de cobro"
          valor={listaPendientes.length}
          detalle="Visitas cerradas sin cobro"
          tono="amber"
        />
      </div>

      <Panel
        tono="amber"
        titulo="Pendientes de cobro"
        descripcion="Visitas cerradas que todavía no tienen un cobro registrado."
        className="print:hidden"
      >
        {pendientes.isPending && <p className="text-sm text-slate-500">Cargando pendientes...</p>}

        {!pendientes.isPending && listaPendientes.length === 0 && (
          <p className="text-sm text-slate-500">No hay visitas pendientes de cobro.</p>
        )}

        {listaPendientes.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-amber-100/70 text-left text-xs uppercase tracking-wide text-amber-900">
                <tr>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">Dueño</th>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Cierre</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaPendientes.map((pendiente) => (
                  <tr
                    key={`${pendiente.origen}-${pendiente.visitaId}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/pacientes/${pendiente.paciente.id}`}
                        className="font-medium text-teal-800 hover:underline"
                      >
                        {pendiente.paciente.nombre}
                      </Link>
                      <p className="text-xs text-slate-500">{pendiente.paciente.codigoInterno}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-slate-800">{pendiente.cliente.nombreCompleto}</p>
                      <p className="text-xs text-slate-500">
                        {pendiente.cliente.telefonoPrincipal ?? 'Sin teléfono'}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {pendiente.origen === 'ingreso'
                        ? `Nº ${pendiente.numeroOrden} · ${etiqueta(ETIQUETAS_SERVICIO, pendiente.servicio)}`
                        : 'Visita sin ingreso'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {pendiente.cierreEn
                        ? `${formatearFecha(pendiente.cierreEn)} ${formatearHora(pendiente.cierreEn)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {puedeCobrar ? (
                        <button
                          type="button"
                          className={claseBotonPrincipal}
                          onClick={() => setPendienteCobro(pendiente)}
                        >
                          Cobrar
                        </button>
                      ) : (
                        <Link
                          to={`/visitas/${pendiente.visitaId}`}
                          className="text-xs text-teal-800 hover:underline"
                        >
                          Ver visita
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        tono="rose"
        titulo="Deudas"
        descripcion="Cobros activos con saldo pendiente, del más viejo al más nuevo."
        className="print:hidden"
      >
        {deudas.isPending && <p className="text-sm text-slate-500">Cargando deudas...</p>}
        {!deudas.isPending && (
          <TablaCobros
            cobros={listaDeudas}
            onPagar={setCobroPago}
            onEditar={setCobroEdicion}
            onAnular={setCobroAnular}
            puedePagar={puedePagar}
            puedeEditar={puedeEditar}
            puedeAnular={puedeAnularCobro}
          />
        )}
      </Panel>

      <Panel
        tono="sky"
        titulo="Cobros del día"
        descripcion="Cobros creados en la fecha seleccionada."
        className="print:hidden"
      >
        {cobros.isPending && <p className="text-sm text-slate-500">Cargando cobros...</p>}
        {!cobros.isPending && (
          <TablaCobros
            cobros={listaCobros}
            onPagar={setCobroPago}
            onEditar={setCobroEdicion}
            onAnular={setCobroAnular}
            puedePagar={puedePagar}
            puedeEditar={puedeEditar}
            puedeAnular={puedeAnularCobro}
          />
        )}
      </Panel>

      <Panel
        tono="emerald"
        titulo="Movimientos del día"
        descripcion="Pagos activos registrados en la fecha seleccionada."
        className="print:hidden"
      >
        {caja.isPending && <p className="text-sm text-slate-500">Cargando movimientos...</p>}

        {!caja.isPending && movimientos.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no hay pagos registrados en esta fecha.</p>
        )}

        {movimientos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-emerald-100/70 text-left text-xs uppercase tracking-wide text-emerald-900">
                <tr>
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">Medio</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2">Registró</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientos.map((pago) => (
                  <tr key={pago.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">{formatearHora(pago.fecha)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{pago.paciente?.nombre ?? '—'}</p>
                      <p className="text-xs text-slate-500">{pago.cliente?.nombreCompleto}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {etiqueta(ETIQUETAS_MEDIO, pago.medio)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {formatearMoneda(pago.monto)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{pago.registradoPorNombre ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {puedeAnularPago && (
                        <button
                          type="button"
                          className={claseBoton}
                          onClick={() => setPagoAnular(pago)}
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        tono="slate"
        titulo="Cierre del día"
        descripcion="Resumen calculado desde los pagos activos. No se guarda en la base."
        className="print:border-0 print:shadow-none"
      >
        <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label htmlFor="caja-fecha" className="block text-xs font-medium text-slate-600">
              Fecha del cierre
            </label>
            <input
              id="caja-fecha"
              type="date"
              className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => window.print()}
          >
            Imprimir cierre
          </button>
        </div>

        <div className="hidden print:mb-4 print:block">
          <h2 className="text-lg font-semibold text-slate-900">Cierre de caja</h2>
          <p className="text-sm text-slate-600">{formatearFecha(fecha)}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Medio</th>
                <th className="px-3 py-2 text-right">Pagos</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(datosCaja?.porMedio ?? []).map((fila) => (
                <tr key={fila.medio}>
                  <td className="px-3 py-2 text-slate-700">
                    {etiqueta(ETIQUETAS_MEDIO, fila.medio)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{fila.cantidad}</td>
                  <td className="px-3 py-2 text-right text-slate-800">
                    {formatearMoneda(fila.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-semibold text-slate-800">Total</th>
                <th className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                  {datosCaja?.cantidadPagos ?? 0}
                </th>
                <th className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                  {formatearMoneda(datosCaja?.totalCobrado ?? 0)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Deuda total al cierre: {formatearMoneda(datosCaja?.deudaTotal ?? 0)} en{' '}
          {datosCaja?.cantidadDeudas ?? 0} cobro{datosCaja?.cantidadDeudas === 1 ? '' : 's'}.
        </p>
      </Panel>

      <Modal
        abierto={Boolean(pendienteCobro)}
        titulo="Registrar cobro"
        onCerrar={() => setPendienteCobro(null)}
      >
        {pendienteCobro && (
          <FormularioCobro
            pendiente={pendienteCobro}
            onGuardado={() => setPendienteCobro(null)}
            onCancelar={() => setPendienteCobro(null)}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(cobroEdicion)}
        titulo="Editar total del cobro"
        onCerrar={() => setCobroEdicion(null)}
      >
        {cobroEdicion && (
          <FormularioCobro
            cobro={cobroEdicion}
            onGuardado={() => setCobroEdicion(null)}
            onCancelar={() => setCobroEdicion(null)}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(cobroPago)}
        titulo="Registrar pago"
        onCerrar={() => setCobroPago(null)}
      >
        {cobroPago && (
          <FormularioPago
            cobro={cobroPago}
            onGuardado={() => setCobroPago(null)}
            onCancelar={() => setCobroPago(null)}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(cobroAnular)}
        titulo="Anular cobro"
        onCerrar={() => setCobroAnular(null)}
      >
        <FormularioAnular
          entidad="cobro"
          onAnular={(motivo) => anularCobroMutation.mutate({ id: cobroAnular.id, motivo })}
          onCancelar={() => setCobroAnular(null)}
          pendiente={anularCobroMutation.isPending}
          error={anularCobroMutation.error}
        />
      </Modal>

      <Modal
        abierto={Boolean(pagoAnular)}
        titulo="Anular pago"
        onCerrar={() => setPagoAnular(null)}
      >
        <FormularioAnular
          entidad="pago"
          onAnular={(motivo) =>
            anularPagoMutation.mutate({
              cobroId: pagoAnular.cobroId,
              pagoId: pagoAnular.id,
              motivo,
            })
          }
          onCancelar={() => setPagoAnular(null)}
          pendiente={anularPagoMutation.isPending}
          error={anularPagoMutation.error}
        />
      </Modal>
    </section>
  );
}
