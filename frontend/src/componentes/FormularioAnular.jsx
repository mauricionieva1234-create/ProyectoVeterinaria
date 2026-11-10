import { useState } from 'react';

// Formulario mínimo y reutilizable para anular cualquier entidad clínica.
export function FormularioAnular({
  entidad = 'registro',
  onAnular,
  onCancelar,
  pendiente = false,
  error,
}) {
  const [motivo, setMotivo] = useState('');
  const [errorLocal, setErrorLocal] = useState(null);

  function alEnviar(evento) {
    evento.preventDefault();
    const limpio = motivo.trim();

    if (limpio.length < 3) {
      setErrorLocal('El motivo debe tener al menos 3 caracteres');
      return;
    }

    setErrorLocal(null);
    onAnular(limpio);
  }

  const mensajeError = errorLocal ?? error?.message;

  return (
    <form className="space-y-4" onSubmit={alEnviar}>
      <p className="text-sm text-slate-600">
        La {entidad} no se borra: queda anulada con el motivo y el usuario que lo hizo.
      </p>

      <div>
        <label htmlFor="motivo-anulacion" className="block text-sm font-medium text-slate-700">
          Motivo de anulación
        </label>
        <textarea
          id="motivo-anulacion"
          rows={3}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </div>

      {mensajeError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {mensajeError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
          disabled={pendiente}
        >
          {pendiente ? 'Anulando...' : 'Anular'}
        </button>
      </div>
    </form>
  );
}
