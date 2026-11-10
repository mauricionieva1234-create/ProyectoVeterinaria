import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useSesion } from '../hooks/useSesion.js';
import { etiquetaRol } from '../utils/roles.js';

function claseEnlace({ isActive }) {
  return [
    'rounded px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-teal-50 font-medium text-teal-800'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');
}

export function Layout() {
  const { data } = useSesion();
  const cerrarSesion = useLogout();
  const navegar = useNavigate();

  const usuario = data?.usuario;
  const permisos = data?.permisos ?? [];

  function alSalir() {
    cerrarSesion.mutate(undefined, {
      onSettled: () => navegar('/login', { replace: true }),
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" end className="text-lg font-semibold tracking-tight text-teal-800">
            Veterinaria
          </NavLink>

          <nav className="flex flex-wrap items-center gap-1" aria-label="Navegación principal">
            <NavLink to="/" end className={claseEnlace}>
              Inicio
            </NavLink>

            <NavLink to="/cola" className={claseEnlace}>
              Cola del día
            </NavLink>
            <NavLink to="/cola/sin-cerrar" className={claseEnlace}>
              Sin cerrar
            </NavLink>
            {permisos.includes('visitas.ver') && (
              <NavLink to="/visitas" className={claseEnlace}>
                Visitas
              </NavLink>
            )}
            {permisos.includes('controles.ver') && (
              <NavLink to="/controles" className={claseEnlace}>
                Controles
              </NavLink>
            )}
            <NavLink to="/clientes" className={claseEnlace}>
              Clientes
            </NavLink>
            <NavLink to="/fichas-incompletas" className={claseEnlace}>
              Fichas incompletas
            </NavLink>
            <NavLink to="/catalogos" className={claseEnlace}>
              Catálogos
            </NavLink>

            {usuario?.rol === 'admin' && (
              <>
                <NavLink to="/usuarios" className={claseEnlace}>
                  Usuarios
                </NavLink>
                <NavLink to="/auditoria" className={claseEnlace}>
                  Auditoría
                </NavLink>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {usuario && (
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-slate-800">{usuario.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{etiquetaRol(usuario.rol)}</p>
              </div>
            )}

            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              onClick={alSalir}
              disabled={cerrarSesion.isPending}
            >
              {cerrarSesion.isPending ? 'Saliendo...' : 'Salir'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
