import { useSalud } from '../api/salud.js';

export function Inicio() {
  const { data, isPending, isError, error } = useSalud();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sistema de gestión veterinaria</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Fase 3 lista: cola de espera diaria, urgencias, alta rápida e ingresos sin cerrar. Lo
          clínico y las visitas llegan en la próxima fase.
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
              Conectado — {data.servicio} —{' '}
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

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Recepción</h2>
          <p className="mt-1 text-sm text-slate-600">
            Administra clientes, pacientes y la cola diaria. No accede a datos clínicos.
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Veterinaria/o</h2>
          <p className="mt-1 text-sm text-slate-600">
            Carga visitas, medicación, registros y controles. Puede ver y editar lo clínico.
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Administración</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gestiona usuarios, roles y consulta la auditoría de cada cambio.
          </p>
        </article>
      </div>
    </section>
  );
}
