import { Navigate } from 'react-router-dom';
import { useSesion } from '../hooks/useSesion.js';

// Guarda de rutas por permiso. Se usa dentro de RutaProtegida, igual que
// RutaAdmin: la sesión y su lista de permisos ya están cargadas.
export function RutaPermiso({ permiso, children }) {
  const { data, isPending } = useSesion();

  if (isPending) {
    return (
      <p className="p-6 text-slate-600" role="status">
        Cargando sesión...
      </p>
    );
  }

  if (!(data?.permisos ?? []).includes(permiso)) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return children;
}
