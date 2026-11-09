import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarClientes } from '../api/clientes.js';

const ETIQUETAS_COINCIDENCIA = {
  documento: 'documento',
  telefono: 'teléfono',
};

// Antes de crear un cliente se recuerda buscar por documento o teléfono para
// no duplicar fichas. Los resultados muestran por qué coincidieron.
export function BusquedaPreviaCliente() {
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [filtros, setFiltros] = useState(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['clientes', 'previa', filtros],
    queryFn: () => buscarClientes(filtros),
    enabled: Boolean(filtros && (filtros.documento || filtros.telefono)),
  });

  function alBuscar(evento) {
    evento.preventDefault();
    setFiltros({ documento: documento.trim(), telefono: telefono.trim() });
  }

  const resultados = data?.datos ?? [];

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">¿Ya está registrado?</p>
      <p className="mt-1 text-xs text-slate-600">
        Buscá por documento o teléfono antes de crear el cliente.
      </p>

      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={alBuscar}>
        <div>
          <label htmlFor="previa-documento" className="block text-xs font-medium text-slate-600">
            Documento
          </label>
          <input
            id="previa-documento"
            className="mt-1 w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={documento}
            onChange={(evento) => setDocumento(evento.target.value)}
          />
        </div>

        <div>
          <label htmlFor="previa-telefono" className="block text-xs font-medium text-slate-600">
            Teléfono
          </label>
          <input
            id="previa-telefono"
            className="mt-1 w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          Buscar
        </button>
      </form>

      {isFetching && <p className="mt-2 text-sm text-slate-600">Buscando...</p>}

      {isError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          No se pudo completar la búsqueda.
        </p>
      )}

      {filtros && !isFetching && !isError && resultados.length === 0 && (
        <p className="mt-2 text-sm text-slate-600">No se encontraron coincidencias.</p>
      )}

      {resultados.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {resultados.map((cliente) => (
            <li key={cliente.id} className="rounded bg-white px-2 py-1.5">
              <span className="font-medium text-slate-800">
                {cliente.nombre} {cliente.apellido}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                {cliente.nroDocumento}
                {cliente.telefonoPrincipal ? ` — ${cliente.telefonoPrincipal}` : ''} — coincide por{' '}
                {cliente.coincidePor
                  .map((valor) => ETIQUETAS_COINCIDENCIA[valor] ?? valor)
                  .join(' y ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
