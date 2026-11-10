import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { crearAviso } from '../api/controles.js';
import { textoONulo } from '../utils/formularios.js';

// Los avisos son inmutables: si hubo un error se registra otro, no se edita.
export function FormularioAviso({ control, onGuardado, onCancelar }) {
  const queryClient = useQueryClient();
  const [canal, setCanal] = useState('llamada');
  const [resultado, setResultado] = useState('avisado');
  const [nota, setNota] = useState('');

  const guardar = useMutation({
    mutationFn: (datos) => crearAviso(control.id, datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['avisos', control.id] });
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      onGuardado(datos.aviso);
    },
  });

  function alEnviar(evento) {
    evento.preventDefault();
    guardar.mutate({ canal, resultado, nota: textoONulo(nota) });
  }

  return (
    <form className="space-y-4" onSubmit={alEnviar}>
      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Aviso para <span className="font-medium">{control.pacienteNombre}</span> ·{' '}
        {control.telefonoPrincipal ?? 'sin teléfono registrado'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="canal-aviso" className="block text-sm font-medium text-slate-700">
            Canal
          </label>
          <select
            id="canal-aviso"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={canal}
            onChange={(evento) => setCanal(evento.target.value)}
          >
            <option value="llamada">Llamada</option>
            <option value="whatsapp_manual">WhatsApp manual</option>
          </select>
        </div>

        <div>
          <label htmlFor="resultado-aviso" className="block text-sm font-medium text-slate-700">
            Resultado
          </label>
          <select
            id="resultado-aviso"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={resultado}
            onChange={(evento) => setResultado(evento.target.value)}
          >
            <option value="avisado">Avisado</option>
            <option value="no_contesta">No contesta</option>
            <option value="sin_telefono">Sin teléfono</option>
            <option value="pidio_reprogramar">Pidió reprogramar</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="nota-aviso" className="block text-sm font-medium text-slate-700">
          Nota
        </label>
        <textarea
          id="nota-aviso"
          rows={2}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
        />
      </div>

      {guardar.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {guardar.error.message}
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
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={guardar.isPending}
        >
          {guardar.isPending ? 'Guardando...' : 'Registrar aviso'}
        </button>
      </div>
    </form>
  );
}
