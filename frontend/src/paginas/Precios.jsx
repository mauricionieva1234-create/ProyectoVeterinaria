import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarPrecios, obtenerPrecio } from '../api/precios.js';
import { FormularioPrecio } from '../componentes/FormularioPrecio.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezadoSolido } from '../componentes/tonos.js';
import { useSesion } from '../hooks/useSesion.js';
import { formatearMoneda } from '../utils/etiquetasCobros.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

const claseBoton =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

function BadgeEstado({ activo }) {
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-xs font-medium',
        activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600',
      ].join(' ')}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// El historial se pide solo cuando la fila está abierta, así la lista no trae
// todos los cambios de todos los precios de una vez.
function HistorialPrecio({ precioId }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['precio', precioId],
    queryFn: () => obtenerPrecio(precioId),
  });

  if (isPending) {
    return <p className="px-3 py-2 text-sm text-slate-500">Cargando historial...</p>;
  }

  if (isError) {
    return (
      <p className="px-3 py-2 text-sm text-red-700" role="alert">
        No se pudo cargar el historial: {error.message}
      </p>
    );
  }

  const historial = data?.precio?.historial ?? [];

  if (historial.length === 0) {
    return <p className="px-3 py-2 text-sm text-slate-500">Este precio no tiene cambios.</p>;
  }

  return (
    <ol className="space-y-2 px-3 py-2">
      {historial.map((cambio) => (
        <li
          key={cambio.id}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
        >
          <p className="font-medium text-slate-800">
            {cambio.nombreAnterior === null
              ? `Alta: ${cambio.nombreNuevo}`
              : `${cambio.nombreAnterior} → ${cambio.nombreNuevo}`}
          </p>
          <p className="mt-0.5">
            {cambio.importeAnterior === null
              ? formatearMoneda(cambio.importeNuevo)
              : `${formatearMoneda(cambio.importeAnterior)} → ${formatearMoneda(
                  cambio.importeNuevo,
                )}`}
          </p>
          <p className="mt-1 text-slate-600">Motivo: {cambio.motivo}</p>
          <p className="text-slate-500">
            {cambio.cambiadoPorNombre ?? 'Usuario'} · {formatearFecha(cambio.cambiadoEn)}{' '}
            {formatearHora(cambio.cambiadoEn)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Precios() {
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puede = (accion) => permisos.includes(accion);

  const [buscar, setBuscar] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [formulario, setFormulario] = useState(null);
  const [historialId, setHistorialId] = useState(null);

  const precios = useQuery({
    queryKey: ['precios', { buscar, incluirInactivos }],
    queryFn: () => listarPrecios({ buscar, incluirInactivos }),
  });

  const lista = precios.data?.datos ?? [];
  const puedeCrear = puede('precios.crear');
  const puedeEditar = puede('precios.editar');

  function alternarHistorial(id) {
    setHistorialId((actual) => (actual === id ? null : id));
  }

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="indigo"
        titulo="Lista de precios"
        descripcion="Importes de referencia para armar el detalle de cada cobro. Los cambios quedan en el historial y no alteran cobros ya realizados."
      >
        {puedeCrear && (
          <button
            type="button"
            className={claseBotonEncabezadoSolido}
            onClick={() => setFormulario({ precio: null })}
          >
            Nuevo precio
          </button>
        )}
      </EncabezadoPagina>

      <Panel tono="indigo" cuerpoClassName="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="precios-buscar" className="block text-sm font-medium text-slate-700">
              Buscar por nombre
            </label>
            <input
              id="precios-buscar"
              type="search"
              className={claseControl}
              value={buscar}
              onChange={(evento) => setBuscar(evento.target.value)}
              placeholder="Ej.: consulta"
            />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="size-4"
              checked={incluirInactivos}
              onChange={(evento) => setIncluirInactivos(evento.target.checked)}
            />
            Incluir inactivos
          </label>
        </div>

        {precios.isPending && <p className="text-sm text-slate-500">Cargando precios...</p>}

        {precios.isError && (
          <p className="text-sm text-red-700" role="alert">
            No se pudieron cargar los precios: {precios.error.message}
          </p>
        )}

        {!precios.isPending && !precios.isError && lista.length === 0 && (
          <p className="text-sm text-slate-500">
            {buscar
              ? 'No hay precios que coincidan con la búsqueda.'
              : 'Todavía no hay precios cargados.'}
          </p>
        )}

        {lista.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Servicio</th>
                  <th className="px-3 py-2 text-right">Importe</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Actualizado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((precio) => (
                  <FragmentoPrecio
                    key={precio.id}
                    precio={precio}
                    historialAbierto={historialId === precio.id}
                    onHistorial={() => alternarHistorial(precio.id)}
                    onEditar={puedeEditar ? () => setFormulario({ precio }) : null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        abierto={Boolean(formulario)}
        titulo={formulario?.precio ? 'Editar precio' : 'Nuevo precio'}
        onCerrar={() => setFormulario(null)}
      >
        {formulario && (
          <FormularioPrecio
            precio={formulario.precio}
            onGuardado={() => setFormulario(null)}
            onCancelar={() => setFormulario(null)}
          />
        )}
      </Modal>
    </section>
  );
}

// Una fila de precio y, si está abierta, su historial justo debajo.
function FragmentoPrecio({ precio, historialAbierto, onHistorial, onEditar }) {
  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-2">
          <p className="font-medium text-slate-800">{precio.nombre}</p>
          {precio.observaciones && <p className="text-xs text-slate-500">{precio.observaciones}</p>}
        </td>
        <td className="px-3 py-2 text-right font-medium text-slate-700">
          {formatearMoneda(precio.importe)}
        </td>
        <td className="px-3 py-2">
          <BadgeEstado activo={precio.activo} />
        </td>
        <td className="px-3 py-2 text-slate-600">
          {formatearFecha(precio.actualizadoEn)} {formatearHora(precio.actualizadoEn)}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-wrap justify-end gap-1">
            <button type="button" className={claseBoton} onClick={onHistorial}>
              {historialAbierto ? 'Ocultar historial' : 'Historial'}
            </button>
            {onEditar && (
              <button type="button" className={claseBoton} onClick={onEditar}>
                Editar
              </button>
            )}
          </div>
        </td>
      </tr>
      {historialAbierto && (
        <tr className="bg-slate-50/80">
          <td colSpan={5}>
            <HistorialPrecio precioId={precio.id} />
          </td>
        </tr>
      )}
    </>
  );
}
