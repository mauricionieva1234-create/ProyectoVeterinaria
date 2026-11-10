import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { subirAdjunto, subirFotoPaciente } from '../api/adjuntos.js';
import { validarArchivo } from '../utils/archivos.js';

// La foto del paciente usa el endpoint propio; el resto va como adjunto común.
export function SubirAdjunto({ pacienteId, visitaId, estudioId, fotoPaciente = false, onSubido }) {
  const queryClient = useQueryClient();
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [errorLocal, setErrorLocal] = useState(null);

  const subir = useMutation({
    mutationFn: (seleccionado) =>
      fotoPaciente
        ? subirFotoPaciente(pacienteId, seleccionado)
        : subirAdjunto({ archivo: seleccionado, pacienteId, visitaId, estudioId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjuntos'] });
      queryClient.invalidateQueries({ queryKey: ['paciente', pacienteId] });
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
      onSubido?.();
    },
  });

  function alElegir(evento) {
    const seleccionado = evento.target.files?.[0] ?? null;
    const problema = validarArchivo(seleccionado);
    setErrorLocal(problema);
    setArchivo(problema ? null : seleccionado);
  }

  function alEnviar(evento) {
    evento.preventDefault();
    const problema = validarArchivo(archivo);

    if (problema) {
      setErrorLocal(problema);
      return;
    }

    setErrorLocal(null);
    subir.mutate(archivo);
  }

  const error = errorLocal ?? subir.error?.message;

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-dashed border-slate-300 p-3"
      onSubmit={alEnviar}
    >
      <div className="min-w-56 flex-1">
        <label htmlFor="archivo-adjunto" className="block text-sm font-medium text-slate-700">
          {fotoPaciente ? 'Foto del paciente' : 'Adjuntar archivo'}
        </label>
        <input
          ref={entrada}
          id="archivo-adjunto"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
          onChange={alElegir}
        />
        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG o WebP · hasta 10 MB.</p>
      </div>

      <button
        type="submit"
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        disabled={subir.isPending}
      >
        {subir.isPending ? 'Subiendo...' : fotoPaciente ? 'Subir foto' : 'Subir archivo'}
      </button>

      {error && (
        <p className="basis-full text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
