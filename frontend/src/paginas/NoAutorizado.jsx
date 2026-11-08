import { Link } from 'react-router-dom';

export function NoAutorizado() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Acceso no autorizado</h1>
      <p className="max-w-xl text-slate-600">
        Tu usuario no tiene permiso para ver esta sección. Si creés que es un error, pedile a un
        administrador que revise tu rol.
      </p>
      <Link
        className="inline-block text-teal-700 underline underline-offset-4 hover:text-teal-900"
        to="/"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
