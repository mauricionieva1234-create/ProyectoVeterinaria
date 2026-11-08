import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../hooks/useSesion.js';

export function RutaProtegida({ children }) {
  const { data, isPending, isError } = useSesion();
  const ubicacion = useLocation();

  if (isPending) {
    return (
      <p className="p-6 text-slate-600" role="status">
        Cargando sesión...
      </p>
    );
  }

  if (isError || !data?.usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  return children;
}
