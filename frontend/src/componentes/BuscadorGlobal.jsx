import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarClientes } from '../api/clientes.js';
import { listarPacientes } from '../api/pacientes.js';

const ESPERA_MS = 300;
const LIMITE = 6;
const MINIMO_CARACTERES = 2;

// Evita disparar una consulta por cada tecla: el texto se estabiliza recién
// cuando el usuario deja de escribir por un instante.
function useTextoDemorado(texto) {
  const [textoDemorado, setTextoDemorado] = useState(texto);

  useEffect(() => {
    const temporizador = setTimeout(() => setTextoDemorado(texto), ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [texto]);

  return textoDemorado;
}

function IconoLupa() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Aviso({ children, error = false }) {
  return (
    <p
      className={`mt-2 text-xs ${error ? 'text-red-700' : 'text-slate-500'}`}
      role={error ? 'alert' : undefined}
    >
      {children}
    </p>
  );
}

function Contador({ total, mostrados }) {
  if (!total || total <= mostrados) return null;

  return <Aviso>Hay {total} coincidencias. Afiná la búsqueda para ver el resto.</Aviso>;
}

// Lupa de la barra superior. Busca clientes por nombre, apellido o DNI y
// mascotas por nombre, mostrando siempre el dueño de cada mascota porque en la
// veterinaria es habitual que varios animales compartan el mismo nombre.
export function BuscadorGlobal() {
  const [abierto, setAbierto] = useState(false);
  const [textoClientes, setTextoClientes] = useState('');
  const [textoPacientes, setTextoPacientes] = useState('');
  const contenedor = useRef(null);

  const busquedaClientes = useTextoDemorado(textoClientes).trim();
  const busquedaPacientes = useTextoDemorado(textoPacientes).trim();

  const clientes = useQuery({
    queryKey: ['clientes', 'buscador', busquedaClientes],
    queryFn: () => listarClientes({ buscar: busquedaClientes, limite: LIMITE }),
    enabled: abierto && busquedaClientes.length >= MINIMO_CARACTERES,
  });

  const pacientes = useQuery({
    queryKey: ['pacientes', 'buscador', busquedaPacientes],
    queryFn: () => listarPacientes({ buscar: busquedaPacientes, limite: LIMITE }),
    enabled: abierto && busquedaPacientes.length >= MINIMO_CARACTERES,
  });

  // Cerrar con Escape o al hacer clic fuera del panel.
  useEffect(() => {
    if (!abierto) return undefined;

    function alTeclear(evento) {
      if (evento.key === 'Escape') setAbierto(false);
    }

    function alHacerClic(evento) {
      if (contenedor.current && !contenedor.current.contains(evento.target)) {
        setAbierto(false);
      }
    }

    document.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alHacerClic);

    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('mousedown', alHacerClic);
    };
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setTextoClientes('');
    setTextoPacientes('');
  }

  const listaClientes = clientes.data?.datos ?? [];
  const totalClientes = clientes.data?.paginacion?.total ?? 0;
  const listaPacientes = pacientes.data?.datos ?? [];
  const totalPacientes = pacientes.data?.paginacion?.total ?? 0;

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        aria-label="Buscar"
        aria-expanded={abierto}
        className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        <IconoLupa />
        <span className="hidden sm:inline">Buscar</span>
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <label
                htmlFor="buscador-clientes"
                className="block text-xs font-medium text-slate-600"
              >
                Clientes: nombre, apellido o DNI
              </label>
              <input
                id="buscador-clientes"
                autoFocus
                autoComplete="off"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                placeholder="Ej.: Demo o 90000001"
                value={textoClientes}
                onChange={(evento) => setTextoClientes(evento.target.value)}
              />

              {textoClientes.trim().length < MINIMO_CARACTERES && (
                <Aviso>Escribí al menos dos caracteres.</Aviso>
              )}

              {clientes.isFetching && <Aviso>Buscando clientes...</Aviso>}

              {clientes.isError && <Aviso error>No se pudieron buscar los clientes.</Aviso>}

              {busquedaClientes.length >= MINIMO_CARACTERES &&
                !clientes.isFetching &&
                !clientes.isError &&
                listaClientes.length === 0 && <Aviso>No se encontraron clientes.</Aviso>}

              {listaClientes.length > 0 && (
                <>
                  <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
                    {listaClientes.map((cliente) => (
                      <li key={cliente.id}>
                        <Link
                          to={`/clientes/${cliente.id}`}
                          onClick={cerrar}
                          className="block px-3 py-2 hover:bg-teal-50"
                        >
                          <span className="block text-sm font-medium text-slate-800">
                            {cliente.apellido}, {cliente.nombre}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {cliente.nroDocumento} · {cliente.telefonoPrincipal ?? 'Sin teléfono'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Contador total={totalClientes} mostrados={listaClientes.length} />
                </>
              )}
            </section>

            <section>
              <label
                htmlFor="buscador-pacientes"
                className="block text-xs font-medium text-slate-600"
              >
                Mascotas: nombre
              </label>
              <input
                id="buscador-pacientes"
                autoComplete="off"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                placeholder="Ej.: Paciente Demo Alfa"
                value={textoPacientes}
                onChange={(evento) => setTextoPacientes(evento.target.value)}
              />

              {textoPacientes.trim().length < MINIMO_CARACTERES && (
                <Aviso>Escribí al menos dos caracteres.</Aviso>
              )}

              {pacientes.isFetching && <Aviso>Buscando mascotas...</Aviso>}

              {pacientes.isError && <Aviso error>No se pudieron buscar las mascotas.</Aviso>}

              {busquedaPacientes.length >= MINIMO_CARACTERES &&
                !pacientes.isFetching &&
                !pacientes.isError &&
                listaPacientes.length === 0 && <Aviso>No se encontraron mascotas.</Aviso>}

              {listaPacientes.length > 0 && (
                <>
                  <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
                    {listaPacientes.map((paciente) => (
                      <li key={paciente.id}>
                        <Link
                          to={`/pacientes/${paciente.id}`}
                          onClick={cerrar}
                          className="block px-3 py-2 hover:bg-teal-50"
                        >
                          <span className="block text-sm font-medium text-slate-800">
                            {paciente.nombre}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {paciente.especieNombre} · {paciente.codigoInterno}
                          </span>
                          <span className="block text-xs text-teal-800">
                            Dueño: {paciente.cliente?.nombreCompleto ?? 'Sin datos'}{' '}
                            {paciente.cliente?.telefonoPrincipal
                              ? `· ${paciente.cliente.telefonoPrincipal}`
                              : ''}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Contador total={totalPacientes} mostrados={listaPacientes.length} />
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
