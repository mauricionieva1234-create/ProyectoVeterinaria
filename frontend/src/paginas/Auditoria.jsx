import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarAuditoria } from '../api/auditoria.js';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { formatearFecha, formatearHora } from '../utils/formato.js';
import { etiquetaAccion } from '../utils/roles.js';

const LIMITE = 20;

function DetalleJson({ titulo, valor }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h4>
      <pre className="mt-1 max-h-56 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
        {valor ? JSON.stringify(valor, null, 2) : '—'}
      </pre>
    </div>
  );
}

export function Auditoria() {
  const [filtros, setFiltros] = useState({
    pagina: 1,
    limite: LIMITE,
    entidad: '',
    accion: '',
    desde: '',
    hasta: '',
  });
  const [detalleId, setDetalleId] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: () => listarAuditoria(filtros),
    placeholderData: keepPreviousData,
  });

  function actualizarFiltro(cambio) {
    setFiltros((actuales) => ({ ...actuales, ...cambio, pagina: 1 }));
    setDetalleId(null);
  }

  const registros = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="purple"
        titulo="Auditoría"
        descripcion="Registro de altas, ediciones, anulaciones y uniones, con el antes y el después."
      />

      <Panel tono="purple">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filtro-entidad" className="block text-xs font-medium text-slate-600">
              Entidad
            </label>
            <input
              id="filtro-entidad"
              className="mt-1 w-40 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.entidad}
              onChange={(evento) => actualizarFiltro({ entidad: evento.target.value })}
              placeholder="Ej.: usuario"
            />
          </div>

          <div>
            <label htmlFor="filtro-accion" className="block text-xs font-medium text-slate-600">
              Acción
            </label>
            <select
              id="filtro-accion"
              className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.accion}
              onChange={(evento) => actualizarFiltro({ accion: evento.target.value })}
            >
              <option value="">Todas</option>
              <option value="crear">Crear</option>
              <option value="editar">Editar</option>
              <option value="anular">Anular</option>
              <option value="unir">Unir</option>
              <option value="ver_sensible">Ver dato sensible</option>
              <option value="exportar">Exportar</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-desde" className="block text-xs font-medium text-slate-600">
              Desde
            </label>
            <input
              id="filtro-desde"
              type="date"
              className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.desde}
              onChange={(evento) => actualizarFiltro({ desde: evento.target.value })}
            />
          </div>

          <div>
            <label htmlFor="filtro-hasta" className="block text-xs font-medium text-slate-600">
              Hasta
            </label>
            <input
              id="filtro-hasta"
              type="date"
              className="mt-1 rounded border border-slate-300 px-3 py-2 text-sm"
              value={filtros.hasta}
              onChange={(evento) => actualizarFiltro({ hasta: evento.target.value })}
            />
          </div>
        </div>
      </Panel>

      <Panel tono="purple" titulo="Registros de auditoría" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-purple-100/70 text-left text-xs uppercase tracking-wide text-purple-900">
              <tr>
                <th className="px-4 py-3">Fecha y hora</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isPending && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Cargando auditoría...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-700" role="alert">
                    No se pudo cargar la auditoría: {error.message}
                  </td>
                </tr>
              )}

              {!isPending && !isError && registros.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No hay registros para los filtros elegidos.
                  </td>
                </tr>
              )}

              {registros.map((registro) => {
                const abierto = detalleId === registro.id;

                return (
                  <FragmentoRegistro
                    key={registro.id}
                    registro={registro}
                    abierto={abierto}
                    onAlternar={() => setDetalleId(abierto ? null : registro.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-purple-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
          <p>
            {paginacion
              ? `${paginacion.total} registro${paginacion.total === 1 ? '' : 's'} en total`
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

function FragmentoRegistro({ registro, abierto, onAlternar }) {
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
          {formatearFecha(registro.fecha)} {formatearHora(registro.fecha)}
        </td>
        <td className="px-4 py-3 text-slate-700">{registro.usuarioNombre}</td>
        <td className="px-4 py-3 text-slate-600">
          {registro.entidad} #{registro.entidadId}
        </td>
        <td className="px-4 py-3 text-slate-600">{etiquetaAccion(registro.accion)}</td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            onClick={onAlternar}
            aria-expanded={abierto}
          >
            {abierto ? 'Ocultar' : 'Ver detalle'}
          </button>
        </td>
      </tr>

      {abierto && (
        <tr>
          <td colSpan={5} className="bg-slate-50/60 px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <DetalleJson titulo="Antes" valor={registro.antes} />
              <DetalleJson titulo="Después" valor={registro.despues} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
