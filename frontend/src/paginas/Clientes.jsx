import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarClientes } from '../api/clientes.js';
import { BusquedaPreviaCliente } from '../componentes/BusquedaPreviaCliente.jsx';
import { FormularioCliente } from '../componentes/FormularioCliente.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezadoSolido } from '../componentes/tonos.js';

const LIMITE = 10;

export function Clientes() {
  const navegar = useNavigate();

  const [filtros, setFiltros] = useState({ pagina: 1, limite: LIMITE, buscar: '' });
  const [textoBuscar, setTextoBuscar] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEnEdicion, setClienteEnEdicion] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['clientes', filtros],
    queryFn: () => listarClientes(filtros),
    placeholderData: keepPreviousData,
  });

  function alBuscar(evento) {
    evento.preventDefault();
    setFiltros((actuales) => ({ ...actuales, buscar: textoBuscar.trim(), pagina: 1 }));
  }

  function abrirAlta() {
    setClienteEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(cliente) {
    setClienteEnEdicion(cliente);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setClienteEnEdicion(null);
  }

  function alGuardar(cliente) {
    const esAlta = !clienteEnEdicion;
    cerrarModal();

    // Después del alta conviene seguir en la ficha para cargar pacientes.
    if (esAlta) {
      navegar(`/clientes/${cliente.id}`);
    }
  }

  const clientes = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="sky"
        titulo="Clientes"
        descripcion="Datos administrativos y mascotas de cada cliente."
      >
        <button type="button" className={claseBotonEncabezadoSolido} onClick={abrirAlta}>
          Nuevo cliente
        </button>
      </EncabezadoPagina>

      <Panel tono="sky">
        <form className="flex flex-wrap items-end gap-3" onSubmit={alBuscar}>
          <div className="min-w-56 flex-1">
            <label
              htmlFor="buscar-cliente-listado"
              className="block text-xs font-medium text-slate-600"
            >
              Buscar por nombre, apellido, documento o teléfono
            </label>
            <input
              id="buscar-cliente-listado"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={textoBuscar}
              onChange={(evento) => setTextoBuscar(evento.target.value)}
              placeholder="Ej.: Demo o 90000001"
            />
          </div>
          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Buscar
          </button>
        </form>
      </Panel>

      <Panel tono="sky" titulo="Listado de clientes" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-sky-100/70 text-left text-xs uppercase tracking-wide text-sky-900">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Localidad</th>
                <th className="px-4 py-3">Mascotas</th>
                <th className="px-4 py-3">Ficha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Cargando clientes...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-red-700" role="alert">
                    No se pudieron cargar los clientes: {error.message}
                  </td>
                </tr>
              )}

              {!isPending && !isError && clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No hay clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}

              {clientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/clientes/${cliente.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {cliente.apellido}, {cliente.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cliente.nroDocumento}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {cliente.telefonoPrincipal ?? '—'}
                    {cliente.telefonoEsWhatsapp && (
                      <span className="ml-1 text-xs text-emerald-700">WhatsApp</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cliente.localidadBarrio ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{cliente.pacientes ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        cliente.fichaIncompleta
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700',
                      ].join(' ')}
                    >
                      {cliente.fichaIncompleta ? 'Incompleta' : 'Completa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Ver ficha
                      </Link>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        onClick={() => abrirEdicion(cliente)}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
          <p>
            {paginacion
              ? `${paginacion.total} cliente${paginacion.total === 1 ? '' : 's'} en total`
              : 'Sin datos'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() =>
                setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina - 1 }))
              }
              disabled={!paginacion || paginacion.pagina <= 1}
            >
              Anterior
            </button>
            <span>
              Página {paginacion?.pagina ?? 1} de {paginacion?.totalPaginas ?? 1}
            </span>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() =>
                setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina + 1 }))
              }
              disabled={!paginacion || paginacion.pagina >= paginacion.totalPaginas}
            >
              Siguiente
            </button>
          </div>
        </div>
      </Panel>

      <Modal
        abierto={modalAbierto}
        titulo={clienteEnEdicion ? 'Editar cliente' : 'Nuevo cliente'}
        onCerrar={cerrarModal}
      >
        {!clienteEnEdicion && (
          <div className="mb-4">
            <BusquedaPreviaCliente />
          </div>
        )}

        <FormularioCliente
          cliente={clienteEnEdicion}
          onGuardado={alGuardar}
          onCancelar={cerrarModal}
        />
      </Modal>
    </section>
  );
}
