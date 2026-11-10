import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { crearEspecie, crearRaza, listarEspecies, listarRazas } from '../api/catalogos.js';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { useSesion } from '../hooks/useSesion.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

function MensajeError({ error }) {
  if (!error) return null;

  const sugerencias = error.detalles?.[0]?.sugerencias ?? [];

  return (
    <div
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      <p>{error.message}</p>
      {sugerencias.length > 0 && (
        <p className="mt-1 text-xs">Ya existe algo parecido: {sugerencias.join(', ')}.</p>
      )}
    </div>
  );
}

export function Catalogos() {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const esAdmin = sesion?.usuario?.rol === 'admin';

  const [especieSeleccionada, setEspecieSeleccionada] = useState('');
  const [nuevaEspecie, setNuevaEspecie] = useState('');
  const [nuevaRaza, setNuevaRaza] = useState('');

  const especies = useQuery({
    queryKey: ['especies'],
    queryFn: () => listarEspecies(),
    staleTime: 5 * 60 * 1000,
  });

  // Al cargar, se muestra la primera especie para no listar todas las razas
  // mezcladas.
  useEffect(() => {
    if (!especieSeleccionada && especies.data?.datos?.length > 0) {
      setEspecieSeleccionada(String(especies.data.datos[0].id));
    }
  }, [especies.data, especieSeleccionada]);

  const razas = useQuery({
    queryKey: ['razas', especieSeleccionada],
    queryFn: () => listarRazas({ especieId: especieSeleccionada }),
    enabled: Boolean(especieSeleccionada),
    staleTime: 5 * 60 * 1000,
  });

  const crearEspecieMut = useMutation({
    mutationFn: crearEspecie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['especies'] });
      setNuevaEspecie('');
    },
  });

  const crearRazaMut = useMutation({
    mutationFn: crearRaza,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['razas'] });
      setNuevaRaza('');
    },
  });

  function alCrearEspecie(evento) {
    evento.preventDefault();
    const nombre = nuevaEspecie.trim();
    if (!nombre) return;
    crearEspecieMut.mutate({ nombre });
  }

  function alCrearRaza(evento) {
    evento.preventDefault();
    const nombre = nuevaRaza.trim();
    if (!nombre || !especieSeleccionada) return;
    crearRazaMut.mutate({ especieId: Number(especieSeleccionada), nombre });
  }

  const listaEspecies = especies.data?.datos ?? [];
  const listaRazas = razas.data?.datos ?? [];

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="cyan"
        titulo="Catálogos"
        descripcion="Especies y razas disponibles para cargar pacientes. Cualquier usuario puede consultarlos; solo el administrador agrega nuevos."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel tono="cyan" titulo="Especies" cuerpoClassName="space-y-4">
          {especies.isPending && <p className="text-sm text-slate-600">Cargando especies...</p>}
          {especies.isError && (
            <p className="text-sm text-red-700" role="alert">
              No se pudieron cargar las especies: {especies.error.message}
            </p>
          )}

          {!especies.isPending && !especies.isError && listaEspecies.length === 0 && (
            <p className="text-sm text-slate-500">Todavía no hay especies cargadas.</p>
          )}

          {listaEspecies.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded border border-slate-200">
              {listaEspecies.map((especie) => (
                <li key={especie.id} className="px-3 py-2 text-sm text-slate-700">
                  {especie.nombre}
                </li>
              ))}
            </ul>
          )}

          {esAdmin && (
            <form className="space-y-2 border-t border-slate-200 pt-4" onSubmit={alCrearEspecie}>
              <label htmlFor="nueva-especie" className="block text-sm font-medium text-slate-700">
                Nueva especie
              </label>
              <div className="flex gap-2">
                <input
                  id="nueva-especie"
                  className={claseControl}
                  value={nuevaEspecie}
                  onChange={(evento) => setNuevaEspecie(evento.target.value)}
                  placeholder="Ej.: equino"
                />
                <button
                  type="submit"
                  className="mt-1 rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  disabled={crearEspecieMut.isPending}
                >
                  {crearEspecieMut.isPending ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
              <MensajeError error={crearEspecieMut.error} />
            </form>
          )}
        </Panel>

        <Panel tono="cyan" titulo="Razas" cuerpoClassName="space-y-4">
          <div>
            <label htmlFor="especie-razas" className="block text-sm font-medium text-slate-700">
              Especie
            </label>
            <select
              id="especie-razas"
              className={claseControl}
              value={especieSeleccionada}
              onChange={(evento) => setEspecieSeleccionada(evento.target.value)}
            >
              {listaEspecies.map((especie) => (
                <option key={especie.id} value={especie.id}>
                  {especie.nombre}
                </option>
              ))}
            </select>
          </div>

          {razas.isFetching && <p className="text-sm text-slate-600">Cargando razas...</p>}
          {razas.isError && (
            <p className="text-sm text-red-700" role="alert">
              No se pudieron cargar las razas: {razas.error.message}
            </p>
          )}

          {!razas.isFetching && !razas.isError && listaRazas.length === 0 && (
            <p className="text-sm text-slate-500">Esta especie todavía no tiene razas cargadas.</p>
          )}

          {listaRazas.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded border border-slate-200">
              {listaRazas.map((raza) => (
                <li key={raza.id} className="px-3 py-2 text-sm text-slate-700">
                  {raza.nombre}
                </li>
              ))}
            </ul>
          )}

          {esAdmin && (
            <form className="space-y-2 border-t border-slate-200 pt-4" onSubmit={alCrearRaza}>
              <label htmlFor="nueva-raza" className="block text-sm font-medium text-slate-700">
                Nueva raza para la especie elegida
              </label>
              <div className="flex gap-2">
                <input
                  id="nueva-raza"
                  className={claseControl}
                  value={nuevaRaza}
                  onChange={(evento) => setNuevaRaza(evento.target.value)}
                  placeholder="Ej.: Criollo"
                />
                <button
                  type="submit"
                  className="mt-1 rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  disabled={crearRazaMut.isPending || !especieSeleccionada}
                >
                  {crearRazaMut.isPending ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
              <MensajeError error={crearRazaMut.error} />
            </form>
          )}
        </Panel>
      </div>
    </section>
  );
}
