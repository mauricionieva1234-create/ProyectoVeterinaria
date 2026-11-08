import { Navigate } from 'react-router-dom';
import { useSesion } from '../hooks/useSesion.js';

// Se usa dentro de RutaProtegida: si no hay sesión, esa guarda ya redirige.
export function RutaAdmin({ children }) {
  const { data, isPending } = useSesion();

  if (isPending) {
    return (
      <p className="p-6 text-slate-600" role="status">
        Cargando sesión...
      </p>
    );
  }

  if (data?.usuario?.rol !== 'admin') {
    return <Navigate to="/no-autorizado" replace />;
  }

  return children;
}
