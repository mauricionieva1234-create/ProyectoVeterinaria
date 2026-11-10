import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listarVisitas } from '../api/visitas.js';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { SelectorPaciente } from '../componentes/SelectorPaciente.jsx';
import { ETIQUETAS_ESTADO_VISITA, etiqueta } from '../utils/etiquetasClinicas.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const LIMITE = 10;

function claseEstado(estado) {
  if (estado === 'borrador') return 'bg-amber-50 text-amber-800';
  if (estado === 'corregida') return 'bg-sky-50 text-sky-800';
  return 'bg-emerald-50 text-emerald-700';
}

export function Visitas() {
  const [paciente, setPaciente] = useState(null);
  const [filtros, setFiltros] = useState({
    pagina: 1,
    limite: LIMITE,
    estado: '',
    desde: '',
    hasta: '',
  });
  const [borrador, setBorrador] = useState({ estado: '', desde: '', hasta: '' });

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['visitas', 'listado', filtros, paciente?.id],
    queryFn: () =>
      listarVisitas({
        ...filtros,
        pacienteId: paciente?.id,
      }),
    placeholderData: keepPreviousData,
  });

  function alFiltrar(evento) {
    evento.preventDefault();
    setFiltros((actuales) => ({ ...actuales, ...borrador, pagina: 1 }));
  }

  function alElegirPaciente(elegido) {
    setPaciente(elegido);
    setFiltros((actuales) => ({ ...actuales, pagina: 1 }));
  }

  function limpiarPaciente() {
    setPaciente(null);
    setFiltros((actuales) => ({ ...actuales, pagina: 1 }));
  }

  const visitas = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="indigo"
        titulo="Visitas"
        descripcion="Visitas clínicas de todos los pacientes, con su estado y profesional responsable."
      />

      <Panel tono="indigo">
        <div className="space-y-4">
          <SelectorPaciente
            paciente={paciente}
            onSeleccionar={alElegirPaciente}
            error={undefined}
          />
          {paciente && (
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={limpiarPaciente}
            >
              Quitar filtro de paciente
            </button>
          )}

          <form className="flex flex-wrap items-end gap-3" onSubmit={alFiltrar}>
            <div>
              <label htmlFor="visitas-estado" className="block text-xs font-medium text-slate-600">
                Estado
              </label>
              <select
                id="visitas-estado"
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
                value={borrador.estado}
                onChange={(evento) =>
                  setBorrador((actual) => ({ ...actual, estado: evento.target.value }))
                }
              >
                <option value="">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="cerrada">Cerrada</option>
                <option value="corregida">Corregida</option>
              </select>
            </div>

            <div>
              <label htmlFor="visitas-desde" className="block text-xs font-medium text-slate-600">
                Desde
              </label>
              <input
                id="visitas-desde"
                type="date"
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
                value={borrador.desde}
                onChange={(evento) =>
                  setBorrador((actual) => ({ ...actual, desde: evento.target.value }))
                }
              />
            </div>

            <div>
              <label htmlFor="visitas-hasta" className="block text-xs font-medium text-slate-600">
                Hasta
              </label>
              <input
                id="visitas-hasta"
                type="date"
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
                value={borrador.hasta}
                onChange={(evento) =>
                  setBorrador((actual) => ({ ...actual, hasta: evento.target.value }))
                }
              />
            </div>

            <button
              type="submit"
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Filtrar
            </button>
          </form>
        </div>
      </Panel>

      <Panel tono="indigo" titulo="Visitas registradas" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-indigo-100/70 text-left text-xs uppercase tracking-wide text-indigo-900">
              <tr>
                <th className="px-3 py-3">Inicio</th>
                <th className="px-3 py-3">Paciente</th>
                <th className="px-3 py-3">Dueño</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Veterinario</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Cargando visitas...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-red-700" role="alert">
                    No se pudieron cargar las visitas: {error.message}
                  </td>
                </tr>
              )}

              {!isPending && !isError && visitas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No hay visitas que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {visitas.map((visita) => (
                <tr key={visita.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                    {formatearFecha(visita.inicioEn)} {formatearHora(visita.inicioEn)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/pacientes/${visita.paciente.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {visita.paciente.nombre}
                    </Link>
                    <p className="text-xs text-slate-500">{visita.paciente.codigoInterno}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{visita.cliente.nombreCompleto}</td>
                  <td className="px-3 py-3 text-slate-700">{visita.motivoConsulta ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{visita.veterinarioNombre ?? '—'}</td>
                  <td className="px-3 py-3">
                    {visita.anulado ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Anulada
                      </span>
                    ) : (
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          claseEstado(visita.estado),
                        ].join(' ')}
                      >
                        {etiqueta(ETIQUETAS_ESTADO_VISITA, visita.estado)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to={`/visitas/${visita.id}`}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-indigo-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
          <p>
            {paginacion
              ? `${paginacion.total} visita${paginacion.total === 1 ? '' : 's'} en total`
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
