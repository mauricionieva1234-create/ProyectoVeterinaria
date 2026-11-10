import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cambiarEstadoIngreso, listarIngresosSinCerrar } from '../api/cola.js';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_SERVICIO,
  ETIQUETAS_URGENCIA,
  etiqueta,
} from '../utils/etiquetasCola.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const LIMITE = 10;

const claseBotonAccion =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

export function IngresosSinCerrar() {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const puedeEditar = (sesion?.permisos ?? []).includes('cola.editar');

  const [filtros, setFiltros] = useState({ pagina: 1, limite: LIMITE });

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['cola-sin-cerrar', filtros],
    queryFn: () => listarIngresosSinCerrar(filtros),
    placeholderData: keepPreviousData,
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) => cambiarEstadoIngreso(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cola-sin-cerrar'] });
      queryClient.invalidateQueries({ queryKey: ['cola'] });
    },
  });

  const ingresos = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingresos sin cerrar</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Ingresos de días anteriores que quedaron abiertos. Revisalos y cerralos con el estado
            que corresponda.
          </p>
        </div>
        <Link
          to="/cola"
          className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Volver a la cola
        </Link>
      </div>

      {cambiarEstado.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {cambiarEstado.error.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Nº</th>
              <th className="px-3 py-3">Paciente</th>
              <th className="px-3 py-3">Dueño</th>
              <th className="px-3 py-3">Servicio</th>
              <th className="px-3 py-3">Urgencia</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Llegada</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isPending && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Cargando ingresos...
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-red-700" role="alert">
                  No se pudieron cargar los ingresos: {error.message}
                </td>
              </tr>
            )}

            {!isPending && !isError && ingresos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  No hay ingresos sin cerrar. Todo al día.
                </td>
              </tr>
            )}

            {ingresos.map((ingreso) => (
              <tr key={ingreso.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-slate-600">{formatearFecha(ingreso.fechaDia)}</td>
                <td className="px-3 py-3 font-medium text-slate-700">{ingreso.numeroOrden}</td>
                <td className="px-3 py-3">
                  <Link
                    to={`/pacientes/${ingreso.paciente.id}`}
                    className="font-medium text-teal-800 hover:underline"
                  >
                    {ingreso.paciente.nombre}
                  </Link>
                  <p className="text-xs text-slate-500">{ingreso.paciente.codigoInterno}</p>
                </td>
                <td className="px-3 py-3">
                  <Link
                    to={`/clientes/${ingreso.cliente.id}`}
                    className="text-slate-800 hover:underline"
                  >
                    {ingreso.cliente.nombreCompleto}
                  </Link>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {etiqueta(ETIQUETAS_SERVICIO, ingreso.servicio)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {etiqueta(ETIQUETAS_URGENCIA, ingreso.urgenciaEstado)}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {etiqueta(ETIQUETAS_ESTADO, ingreso.estado)}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatearHora(ingreso.horaLlegada)}</td>
                <td className="px-3 py-3 text-right">
                  {puedeEditar ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        className={claseBotonAccion}
                        onClick={() => cambiarEstado.mutate({ id: ingreso.id, estado: 'atendido' })}
                        disabled={cambiarEstado.isPending}
                      >
                        Atendido
                      </button>
                      <button
                        type="button"
                        className={claseBotonAccion}
                        onClick={() =>
                          cambiarEstado.mutate({ id: ingreso.id, estado: 'se_retiro' })
                        }
                        disabled={cambiarEstado.isPending}
                      >
                        Se retiró
                      </button>
                      <button
                        type="button"
                        className={claseBotonAccion}
                        onClick={() =>
                          cambiarEstado.mutate({ id: ingreso.id, estado: 'cancelado' })
                        }
                        disabled={cambiarEstado.isPending}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          {paginacion
            ? `${paginacion.total} ingreso${paginacion.total === 1 ? '' : 's'} sin cerrar`
            : 'Sin datos'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina - 1 }))}
            disabled={!paginacion || paginacion.pagina <= 1}
          >
            Anterior
          </button>
          <span>
            Página {paginacion?.pagina ?? 1} de {paginacion?.totalPaginas ?? 1}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setFiltros((actuales) => ({ ...actuales, pagina: actuales.pagina + 1 }))}
            disabled={!paginacion || paginacion.pagina >= paginacion.totalPaginas}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
