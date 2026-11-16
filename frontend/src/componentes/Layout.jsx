import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useSesion } from '../hooks/useSesion.js';
import { etiquetaRol } from '../utils/roles.js';
import { BuscadorGlobal } from './BuscadorGlobal.jsx';
import { AsistenteChat } from './AsistenteChat.jsx';

function claseEnlace({ isActive }) {
  return [
    'rounded-lg px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-linear-to-r from-teal-100 to-emerald-100 font-medium text-teal-900 shadow-sm'
      : 'text-slate-600 hover:bg-white hover:text-teal-800',
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
    <div className="min-h-screen bg-linear-to-br from-teal-50 via-slate-50 to-sky-50 text-slate-900 print:bg-white">
      <header className="sticky top-0 z-40 border-b border-teal-100/80 bg-white/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-teal-900"
          >
            <img
              src="/logo-veterinaria.svg"
              alt=""
              className="size-9 drop-shadow-sm"
              width="36"
              height="36"
            />
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
            <BuscadorGlobal />

            {usuario && (
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-slate-800">{usuario.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{etiquetaRol(usuario.rol)}</p>
              </div>
            )}

            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              onClick={alSalir}
              disabled={cerrarSesion.isPending}
            >
              {cerrarSesion.isPending ? 'Saliendo...' : 'Salir'}
            </button>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="h-1 bg-linear-to-r from-teal-500 via-sky-500 to-violet-500"
        />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <Outlet />
      </main>

      {permisos.includes('asistente.usar') && <AsistenteChat />}
    </div>
  );
}
