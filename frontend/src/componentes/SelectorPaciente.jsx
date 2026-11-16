import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarPacientes } from '../api/pacientes.js';

function detalleDe(paciente) {
  const partes = [paciente.codigoInterno, paciente.especieNombre];

  if (paciente.provisorio) {
    partes.push('provisorio');
  }

  return partes.filter(Boolean).join(' · ');
}

// Buscador de pacientes para agregar un ingreso a la cola. No lista todos:
// pide al menos dos caracteres del nombre o del código interno.
export function SelectorPaciente({ paciente, onSeleccionar, error }) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['pacientes', 'selector', texto],
    queryFn: () => listarPacientes({ buscar: texto.trim(), limite: 8 }),
    // La búsqueda se habilita con el texto, sin esperar a que se pise "Cambiar":
    // el selector se usa también la primera vez que se agrega un paciente.
    enabled: texto.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const resultados = data?.datos ?? [];

  if (paciente && !buscando) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span>
            <span className="font-medium text-slate-800">{paciente.nombre}</span>
            <span className="ml-2 text-xs text-slate-500">{detalleDe(paciente)}</span>
          </span>
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
      <label htmlFor="buscar-paciente" className="block text-sm font-medium text-slate-700">
        Buscar paciente
      </label>
      <input
        id="buscar-paciente"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Nombre o código interno (PAC-000001)"
        autoComplete="off"
      />

      {texto.trim().length < 2 && (
        <p className="text-xs text-slate-500">Escribí al menos dos caracteres para buscar.</p>
      )}

      {isFetching && <p className="text-sm text-slate-600">Buscando...</p>}

      {isError && (
        <p className="text-sm text-red-700" role="alert">
          No se pudieron buscar los pacientes.
        </p>
      )}

      {texto.trim().length >= 2 && !isFetching && resultados.length === 0 && (
        <p className="text-sm text-slate-500">No se encontraron pacientes.</p>
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
                <span className="font-medium text-slate-800">{candidato.nombre}</span>
                <span className="ml-2 text-xs text-slate-500">{detalleDe(candidato)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error.message}
        </p>
      )}

      {paciente && (
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
