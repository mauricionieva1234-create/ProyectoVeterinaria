import { Link } from 'react-router-dom';
import { useSalud } from '../api/salud.js';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';

const ACCESOS = [
  {
    to: '/cola',
    titulo: 'Cola del día',
    detalle: 'Ingresos, urgencias y orden de atención.',
    clase: 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100',
    badge: 'bg-amber-500',
  },
  {
    to: '/clientes',
    titulo: 'Clientes',
    detalle: 'Datos administrativos y mascotas de cada dueño.',
    clase: 'border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-sky-100',
    badge: 'bg-sky-500',
  },
  {
    to: '/controles',
    titulo: 'Controles',
    detalle: 'Recordatorios de hoy, mañana y vencidos.',
    clase: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100',
    badge: 'bg-emerald-500',
  },
  {
    to: '/catalogos',
    titulo: 'Catálogos',
    detalle: 'Especies y razas disponibles.',
    clase: 'border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100',
    badge: 'bg-cyan-500',
  },
];

const ROLES = [
  {
    titulo: 'Recepción',
    detalle: 'Administra clientes, pacientes y la cola diaria. No accede a datos clínicos.',
    clase: 'border-sky-200 bg-sky-50',
    tituloClase: 'text-sky-900',
  },
  {
    titulo: 'Veterinaria/o',
    detalle: 'Carga visitas, medicación, registros y controles. Puede ver y editar lo clínico.',
    clase: 'border-violet-200 bg-violet-50',
    tituloClase: 'text-violet-900',
  },
  {
    titulo: 'Administración',
    detalle: 'Gestiona usuarios, roles y consulta la auditoría de cada cambio.',
    clase: 'border-purple-200 bg-purple-50',
    tituloClase: 'text-purple-900',
  },
];

export function Inicio() {
  const { data, isPending, isError, error } = useSalud();

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        tono="teal"
        titulo="Sistema de gestión veterinaria"
        descripcion="Fase 4 lista: historia clínica con visitas, medicación, registros, controles, avisos y adjuntos. Recepción administra la cola y puede leer y exportar la historia completa sin editar nada clínico."
      />

      <Panel tono="teal" titulo="Estado del backend">
        {isPending && <p className="text-slate-600">Consultando...</p>}

        {isError && (
          <p className="text-red-700" role="alert">
            No se pudo conectar con el backend: {error.message}
          </p>
        )}

        {data && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
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
      </Panel>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Accesos rápidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACCESOS.map((acceso) => (
            <Link
              key={acceso.to}
              to={acceso.to}
              className={`rounded-2xl border p-4 shadow-sm transition-colors ${acceso.clase}`}
            >
              <span
                aria-hidden="true"
                className={`mb-3 block h-1.5 w-8 rounded-full ${acceso.badge}`}
              />
              <span className="block text-sm font-semibold text-slate-900">{acceso.titulo}</span>
              <span className="mt-1 block text-xs text-slate-600">{acceso.detalle}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((rol) => (
          <article key={rol.titulo} className={`rounded-2xl border p-4 shadow-sm ${rol.clase}`}>
            <h2 className={`text-sm font-semibold ${rol.tituloClase}`}>{rol.titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{rol.detalle}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
