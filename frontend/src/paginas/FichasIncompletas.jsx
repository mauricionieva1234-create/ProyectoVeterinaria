import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listarFichasIncompletas } from '../api/clientes.js';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { formatearFecha } from '../utils/formato.js';

const LIMITE = 10;

export function FichasIncompletas() {
  const [filtros, setFiltros] = useState({ pagina: 1, limite: LIMITE });

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['fichas-incompletas', filtros],
    queryFn: () => listarFichasIncompletas(filtros),
    placeholderData: keepPreviousData,
  });

  const clientes = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="rose"
        titulo="Fichas incompletas"
        descripcion="Clientes sin teléfono principal. Se recuerda completar la ficha al cerrar la visita."
      />

      <Panel tono="rose" titulo="Clientes a completar" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-rose-100/70 text-left text-xs uppercase tracking-wide text-rose-900">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Mascotas</th>
                <th className="px-4 py-3">Creada por</th>
                <th className="px-4 py-3">Alta</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Cargando fichas...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-red-700" role="alert">
                    No se pudieron cargar las fichas: {error.message}
                  </td>
                </tr>
              )}

              {!isPending && !isError && clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No hay fichas incompletas. Todo al día.
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
                  <td className="px-4 py-3 text-amber-800">Sin teléfono principal</td>
                  <td className="px-4 py-3 text-slate-600">{cliente.pacientes ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{cliente.creadoPorNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(cliente.creadoEn)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/clientes/${cliente.id}`}
                      className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Completar ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rose-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
          <p>
            {paginacion
              ? `${paginacion.total} ficha${paginacion.total === 1 ? '' : 's'} incompleta${
                  paginacion.total === 1 ? '' : 's'
                }`
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
    </section>
  );
}
