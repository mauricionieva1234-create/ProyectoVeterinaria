import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearControl, reprogramarControl } from '../api/controles.js';
import { hoyEnTucuman, textoONulo } from '../utils/formularios.js';

const fecha = z
  .string()
  .min(1, 'Elegí una fecha')
  .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Usá el formato aaaa-mm-dd');

const esquema = z.object({
  fechaControl: fecha,
  franja: z.enum(['manana', 'tarde', 'cualquiera']),
  motivo: z.string().trim().max(2000, 'El motivo es demasiado largo').optional(),
});

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

function Campo({ etiqueta, htmlFor, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

// Con `control` reprograma; sin él, crea un control nuevo para la visita.
export function FormularioControl({ visita, control, onGuardado, onCancelar }) {
  const queryClient = useQueryClient();
  const reprogramando = Boolean(control);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      fechaControl: control?.fechaControl ?? '',
      franja: control?.franja ?? 'cualquiera',
      motivo: control?.motivo ?? '',
    },
  });

  const guardar = useMutation({
    mutationFn: (datos) =>
      reprogramando ? reprogramarControl(control.id, datos) : crearControl(datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['controles'] });
      queryClient.invalidateQueries({ queryKey: ['visita', visita?.id] });
      onGuardado(datos.control ?? datos);
    },
  });

  function alEnviar(datos) {
    const cuerpo = {
      fechaControl: datos.fechaControl,
      franja: datos.franja,
      motivo: textoONulo(datos.motivo),
    };

    if (!reprogramando) cuerpo.visitaOrigenId = Number(visita.id);

    guardar.mutate(cuerpo);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      {reprogramando && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El control actual queda como reprogramado y se crea uno nuevo con la fecha elegida.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha del control" htmlFor="fechaControl" error={errors.fechaControl}>
          <input
            id="fechaControl"
            type="date"
            min={hoyEnTucuman()}
            className={claseControl}
            aria-invalid={errors.fechaControl ? 'true' : 'false'}
            {...register('fechaControl')}
          />
        </Campo>

        <Campo etiqueta="Franja" htmlFor="franja" error={errors.franja}>
          <select id="franja" className={claseControl} {...register('franja')}>
            <option value="manana">Mañana</option>
            <option value="tarde">Tarde</option>
            <option value="cualquiera">Cualquier horario</option>
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Motivo" htmlFor="motivo-control" error={errors.motivo}>
        <textarea id="motivo-control" rows={2} className={claseControl} {...register('motivo')} />
      </Campo>

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
          {guardar.isPending ? 'Guardando...' : reprogramando ? 'Reprogramar' : 'Crear control'}
        </button>
      </div>
    </form>
  );
}
