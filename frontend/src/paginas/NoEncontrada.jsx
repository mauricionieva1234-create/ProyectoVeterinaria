import { Link } from 'react-router-dom';

export function NoEncontrada() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="text-slate-600">La dirección que buscás no existe.</p>
      <Link
        className="inline-block text-teal-700 underline underline-offset-4 hover:text-teal-900"
        to="/"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
