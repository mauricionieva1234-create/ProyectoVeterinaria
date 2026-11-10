import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarMedicacion, crearMedicacion } from '../api/visitas.js';
import { enteroONulo, numeroONulo, textoONulo } from '../utils/formularios.js';

function Campo({ etiqueta, htmlFor, error, children, ayuda }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

function esquemaDe(exigeMotivo) {
  return z
    .object({
      medicamento: z
        .string()
        .trim()
        .min(1, 'El medicamento es obligatorio')
        .max(200, 'El medicamento es demasiado largo'),
      dosis: z.string().trim().max(200, 'La dosis es demasiado larga').optional(),
      via: z.string().trim().max(100, 'La vía es demasiado larga').optional(),
      frecuencia: z.string().trim().max(200, 'La frecuencia es demasiado larga').optional(),
      duracionDias: z
        .string()
        .trim()
        .optional()
        .refine(
          (valor) => !valor || (Number.isInteger(Number(valor)) && Number(valor) >= 0),
          'La duración debe ser un número entero de días',
        ),
      indicaciones: z.string().trim().max(5000, 'Las indicaciones son demasiado largas').optional(),
      pesoReferenciaKg: z
        .string()
        .trim()
        .optional()
        .refine(
          (valor) => !valor || Number(valor) > 0,
          'El peso de referencia debe ser mayor que cero',
        ),
      motivoCambio: z
        .string()
        .trim()
        .max(2000, 'El motivo del cambio es demasiado largo')
        .optional(),
    })
    .superRefine((datos, contexto) => {
      if (exigeMotivo && (datos.motivoCambio ?? '').trim().length < 3) {
        contexto.addIssue({
          code: 'custom',
          path: ['motivoCambio'],
          message: 'Indicá el motivo del cambio (mínimo 3 caracteres)',
        });
      }
    });
}

export function FormularioMedicacion({ visita, medicacion, onGuardada, onCancelar }) {
  const queryClient = useQueryClient();
  const exigeMotivo = visita.estado !== 'borrador';

  const esquema = useMemo(() => esquemaDe(exigeMotivo), [exigeMotivo]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      medicamento: medicacion?.medicamento ?? '',
      dosis: medicacion?.dosis ?? '',
      via: medicacion?.via ?? '',
      frecuencia: medicacion?.frecuencia ?? '',
      duracionDias: medicacion?.duracionDias ?? '',
      indicaciones: medicacion?.indicaciones ?? '',
      pesoReferenciaKg: medicacion?.pesoReferenciaKg ?? '',
      motivoCambio: '',
    },
  });

  const guardar = useMutation({
    mutationFn: (datos) =>
      medicacion
        ? actualizarMedicacion(visita.id, medicacion.id, datos)
        : crearMedicacion(visita.id, datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['visita', visita.id] });
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      onGuardada(datos.medicacion);
    },
  });

  function alEnviar(datos) {
    const cuerpo = {
      medicamento: datos.medicamento.trim(),
      dosis: textoONulo(datos.dosis),
      via: textoONulo(datos.via),
      frecuencia: textoONulo(datos.frecuencia),
      duracionDias: enteroONulo(datos.duracionDias),
      indicaciones: textoONulo(datos.indicaciones),
      pesoReferenciaKg: numeroONulo(datos.pesoReferenciaKg),
    };

    if (exigeMotivo) cuerpo.motivoCambio = datos.motivoCambio.trim();

    guardar.mutate(cuerpo);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      <Campo etiqueta="Medicamento" htmlFor="medicamento" error={errors.medicamento}>
        <input
          id="medicamento"
          className={claseControl}
          aria-invalid={errors.medicamento ? 'true' : 'false'}
          {...register('medicamento')}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Dosis" htmlFor="dosis" error={errors.dosis}>
          <input id="dosis" className={claseControl} {...register('dosis')} />
        </Campo>
        <Campo etiqueta="Vía" htmlFor="via" error={errors.via}>
          <input id="via" className={claseControl} {...register('via')} />
        </Campo>
        <Campo etiqueta="Frecuencia" htmlFor="frecuencia" error={errors.frecuencia}>
          <input id="frecuencia" className={claseControl} {...register('frecuencia')} />
        </Campo>
        <Campo etiqueta="Duración (días)" htmlFor="duracionDias" error={errors.duracionDias}>
          <input
            id="duracionDias"
            type="number"
            min="0"
            className={claseControl}
            {...register('duracionDias')}
          />
        </Campo>
      </div>

      <Campo
        etiqueta="Peso de referencia (kg)"
        htmlFor="pesoReferenciaKg"
        error={errors.pesoReferenciaKg}
      >
        <input
          id="pesoReferenciaKg"
          type="number"
          step="0.01"
          className={claseControl}
          {...register('pesoReferenciaKg')}
        />
      </Campo>

      <Campo etiqueta="Indicaciones" htmlFor="indicaciones" error={errors.indicaciones}>
        <textarea
          id="indicaciones"
          rows={3}
          className={claseControl}
          {...register('indicaciones')}
        />
      </Campo>

      {exigeMotivo && (
        <Campo
          etiqueta="Motivo del cambio"
          htmlFor="medicacion-motivo-cambio"
          error={errors.motivoCambio}
          ayuda="La visita está cerrada: el cambio genera una versión."
        >
          <textarea
            id="medicacion-motivo-cambio"
            rows={2}
            className={claseControl}
            {...register('motivoCambio')}
          />
        </Campo>
      )}

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
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
