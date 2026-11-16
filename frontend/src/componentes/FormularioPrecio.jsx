import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarPrecio, crearPrecio } from '../api/precios.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

const numeroObligatorio = z.preprocess(
  (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
  z
    .number({ message: 'Ingresá un importe válido' })
    .finite('El importe no es válido')
    .min(0, 'El importe no puede ser negativo')
    .max(999999999.99, 'El importe es demasiado grande'),
);

function esquemaDe({ esEdicion }) {
  return z
    .object({
      nombre: z
        .string()
        .trim()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(120, 'El nombre es demasiado largo'),
      importe: numeroObligatorio,
      observaciones: z
        .string()
        .trim()
        .max(1000, 'Las observaciones son demasiado largas')
        .optional(),
      activo: z.boolean().optional(),
      motivo: z.string().trim().max(2000, 'El motivo es demasiado largo').optional(),
    })
    .superRefine((datos, contexto) => {
      if (esEdicion && (datos.motivo ?? '').length < 3) {
        contexto.addIssue({
          code: 'custom',
          path: ['motivo'],
          message: 'Indicá el motivo del cambio (mínimo 3 caracteres)',
        });
      }
    });
}

function Campo({ etiqueta: nombre, htmlFor, error, children, ayuda }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {nombre}
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

// Alta y edición de un precio de la lista. Toda edición pide un motivo para
// dejar rastro en el historial y en la auditoría.
export function FormularioPrecio({ precio, onGuardado, onCancelar }) {
  const esEdicion = Boolean(precio);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaDe({ esEdicion })),
    defaultValues: {
      nombre: esEdicion ? precio.nombre : '',
      importe: esEdicion ? precio.importe : '',
      observaciones: esEdicion ? (precio.observaciones ?? '') : '',
      activo: esEdicion ? precio.activo : true,
      motivo: '',
    },
  });

  const guardar = useMutation({
    mutationFn: (datos) => {
      const cuerpo = {
        nombre: datos.nombre.trim(),
        importe: datos.importe,
        observaciones: datos.observaciones?.trim() || null,
      };

      if (esEdicion) {
        return actualizarPrecio(precio.id, {
          ...cuerpo,
          activo: datos.activo,
          motivo: datos.motivo.trim(),
        });
      }

      return crearPrecio(cuerpo);
    },
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['precios'] });
      onGuardado(datos.precio);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      noValidate
    >
      <Campo etiqueta="Nombre del servicio" htmlFor="precio-nombre" error={errors.nombre}>
        <input id="precio-nombre" type="text" className={claseControl} {...register('nombre')} />
      </Campo>

      <Campo
        etiqueta="Importe"
        htmlFor="precio-importe"
        error={errors.importe}
        ayuda="Se puede usar 0 para una cortesía."
      >
        <input
          id="precio-importe"
          type="number"
          min="0"
          step="0.01"
          className={claseControl}
          {...register('importe')}
        />
      </Campo>

      <Campo etiqueta="Observaciones" htmlFor="precio-observaciones" error={errors.observaciones}>
        <textarea
          id="precio-observaciones"
          rows={2}
          className={claseControl}
          {...register('observaciones')}
        />
      </Campo>

      {esEdicion && (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="size-4" {...register('activo')} />
            Precio activo (se ofrece al cobrar)
          </label>

          <Campo
            etiqueta="Motivo del cambio"
            htmlFor="precio-motivo"
            error={errors.motivo}
            ayuda="Queda guardado en el historial del precio."
          >
            <textarea
              id="precio-motivo"
              rows={2}
              className={claseControl}
              {...register('motivo')}
            />
          </Campo>
        </>
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
          {guardar.isPending ? 'Guardando...' : esEdicion ? 'Guardar cambio' : 'Agregar precio'}
        </button>
      </div>
    </form>
  );
}
