import { useSalud } from '../api/salud.js';

export function Inicio() {
  const { data, isPending, isError, error } = useSalud();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sistema de gestión veterinaria</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Base del proyecto lista. En la próxima fase se agregan la base de datos, el inicio de
          sesión y los permisos.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-500">Estado del backend</h2>

        {isPending && <p className="mt-2 text-slate-600">Consultando...</p>}

        {isError && (
          <p className="mt-2 text-red-700" role="alert">
            No se pudo conectar con el backend: {error.message}
          </p>
        )}

        {data && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <p className="text-slate-700">
              Conectado · {data.servicio} ·{' '}
              {new Date(data.hora).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
