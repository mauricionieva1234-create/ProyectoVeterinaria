import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarClientes } from '../api/clientes.js';

function nombreDe(cliente) {
  if (cliente.nombreCompleto) return cliente.nombreCompleto;
  return `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();
}

// Buscador de clientes para elegir un dueño o el cliente que se conserva al
// unir duplicados. No lista todos: pide al menos dos caracteres.
export function SelectorCliente({ cliente, onSeleccionar, excluirId, error }) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['clientes', 'selector', texto],
    queryFn: () => listarClientes({ buscar: texto.trim(), limite: 8 }),
    enabled: buscando && texto.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const resultados = (data?.datos ?? []).filter(
    (candidato) => String(candidato.id) !== String(excluirId),
  );

  if (cliente && !buscando) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-800">{nombreDe(cliente)}</span>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            onClick={() => setBuscando(true)}
          >
            Cambiar
          </button>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="buscar-cliente" className="block text-sm font-medium text-slate-700">
        Buscar cliente
      </label>
      <input
        id="buscar-cliente"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Nombre, documento o teléfono"
        autoComplete="off"
      />

      {texto.trim().length < 2 && (
        <p className="text-xs text-slate-500">Escribí al menos dos caracteres para buscar.</p>
      )}

      {isFetching && <p className="text-sm text-slate-600">Buscando...</p>}

      {isError && (
        <p className="text-sm text-red-700" role="alert">
          No se pudieron buscar los clientes.
        </p>
      )}

      {buscando && texto.trim().length >= 2 && !isFetching && resultados.length === 0 && (
        <p className="text-sm text-slate-500">No se encontraron clientes.</p>
      )}

      {resultados.length > 0 && (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
          {resultados.map((candidato) => (
            <li key={candidato.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                onClick={() => {
                  onSeleccionar(candidato);
                  setBuscando(false);
                  setTexto('');
                }}
              >
                <span className="font-medium text-slate-800">{nombreDe(candidato)}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {candidato.nroDocumento}
                  {candidato.telefonoPrincipal ? ` — ${candidato.telefonoPrincipal}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cliente && (
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
          onClick={() => {
            setBuscando(false);
            setTexto('');
          }}
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
