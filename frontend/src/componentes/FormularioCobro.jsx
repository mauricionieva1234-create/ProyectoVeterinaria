import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarCobro, crearCobro, registrarPago } from '../api/cobros.js';
import {
  ETIQUETAS_MEDIO,
  MEDIOS_PAGO,
  etiqueta,
  formatearMoneda,
} from '../utils/etiquetasCobros.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

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

const numeroObligatorio = z.preprocess(
  (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
  z
    .number({ message: 'Ingresá un importe válido' })
    .finite('El importe no es válido')
    .min(0, 'El importe no puede ser negativo')
    .max(999999999.99, 'El importe es demasiado grande'),
);

const montoOpcional = z.preprocess(
  (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
  z
    .number({ message: 'Ingresá un monto válido' })
    .finite('El monto no es válido')
    .positive('El monto tiene que ser mayor que cero')
    .optional(),
);

function esquemaDe({ esEdicion }) {
  return z
    .object({
      total: numeroObligatorio,
      observaciones: z
        .string()
        .trim()
        .max(2000, 'Las observaciones son demasiado largas')
        .optional(),
      motivoCambio: z.string().trim().max(2000, 'El motivo es demasiado largo').optional(),
      medio: z.enum(MEDIOS_PAGO).optional(),
      montoPago: montoOpcional,
    })
    .superRefine((datos, contexto) => {
      if (esEdicion) {
        if ((datos.motivoCambio ?? '').length < 3) {
          contexto.addIssue({
            code: 'custom',
            path: ['motivoCambio'],
            message: 'Indicá el motivo del cambio (mínimo 3 caracteres)',
          });
        }
        return;
      }

      if (datos.total === 0 && (datos.observaciones ?? '').length < 3) {
        contexto.addIssue({
          code: 'custom',
          path: ['observaciones'],
          message: 'Indicá una observación para un cobro sin cargo',
        });
      }

      if (datos.montoPago !== undefined && datos.montoPago > datos.total) {
        contexto.addIssue({
          code: 'custom',
          path: ['montoPago'],
          message: 'El pago no puede superar el total del cobro',
        });
      }
    });
}

// Formulario de cobro. En creación acepta un pago inicial; en edición solo
// corrige el total con motivo, sin tocar los pagos ya registrados.
export function FormularioCobro({ pendiente, cobro, onGuardado, onCancelar }) {
  const esEdicion = Boolean(cobro);
  const queryClient = useQueryClient();
  const esquema = useMemo(() => esquemaDe({ esEdicion }), [esEdicion]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      total: esEdicion ? cobro.total : '',
      observaciones: esEdicion ? (cobro.observaciones ?? '') : '',
      motivoCambio: '',
      medio: 'efectivo',
      montoPago: '',
    },
  });

  const totalObservado = Number(watch('total') ?? 0);

  const guardar = useMutation({
    mutationFn: async (datos) => {
      const observaciones = datos.observaciones?.trim() || null;

      if (esEdicion) {
        return actualizarCobro(cobro.id, {
          total: datos.total,
          observaciones,
          motivoCambio: datos.motivoCambio.trim(),
        });
      }

      const creado = await crearCobro({
        visitaId: pendiente.visitaId,
        total: datos.total,
        observaciones,
      });

      // El pago inicial va en un segundo paso: el cobro ya existe y el backend
      // valida el saldo dentro de su propia transacción.
      if (datos.montoPago !== undefined) {
        return registrarPago(creado.cobro.id, {
          medio: datos.medio ?? 'efectivo',
          monto: datos.montoPago,
        });
      }

      return creado;
    },
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      queryClient.invalidateQueries({ queryKey: ['deudas'] });
      queryClient.invalidateQueries({ queryKey: ['pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['cola'] });
      queryClient.invalidateQueries({ queryKey: ['visita'] });
      onGuardado(datos.cobro ?? datos);
    },
  });

  const paciente = esEdicion ? cobro.paciente : pendiente.paciente;
  const cliente = esEdicion ? cobro.cliente : pendiente.cliente;

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      noValidate
    >
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm text-slate-700">
          Paciente: <span className="font-medium">{paciente?.nombre}</span>{' '}
          <span className="font-mono text-xs text-slate-500">{paciente?.codigoInterno}</span>
        </p>
        <p className="text-xs text-slate-500">{cliente?.nombreCompleto}</p>
        {esEdicion && (
          <p className="mt-1 text-xs text-slate-600">
            Pagado: {formatearMoneda(cobro.pagado)} · Saldo: {formatearMoneda(cobro.saldo)}
          </p>
        )}
      </div>

      <Campo
        etiqueta="Total del cobro"
        htmlFor="cobro-total"
        error={errors.total}
        ayuda={
          totalObservado === 0 && !esEdicion
            ? 'Un total en cero registra la visita sin cargo y pide una observación.'
            : undefined
        }
      >
        <input
          id="cobro-total"
          type="number"
          min="0"
          step="0.01"
          className={claseControl}
          {...register('total')}
        />
      </Campo>

      <Campo etiqueta="Observaciones" htmlFor="cobro-observaciones" error={errors.observaciones}>
        <textarea
          id="cobro-observaciones"
          rows={3}
          className={claseControl}
          {...register('observaciones')}
        />
      </Campo>

      {!esEdicion && totalObservado > 0 && (
        <fieldset className="space-y-3 rounded border border-emerald-200 bg-emerald-50/60 p-3">
          <legend className="px-1 text-sm font-medium text-emerald-900">
            Pago inicial (opcional)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Medio" htmlFor="cobro-medio" error={errors.medio}>
              <select id="cobro-medio" className={claseControl} {...register('medio')}>
                {MEDIOS_PAGO.map((medio) => (
                  <option key={medio} value={medio}>
                    {etiqueta(ETIQUETAS_MEDIO, medio)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              etiqueta="Monto"
              htmlFor="cobro-monto"
              error={errors.montoPago}
              ayuda="Dejalo vacío para cobrar después."
            >
              <input
                id="cobro-monto"
                type="number"
                min="0.01"
                step="0.01"
                className={claseControl}
                {...register('montoPago')}
              />
            </Campo>
          </div>
        </fieldset>
      )}

      {esEdicion && (
        <Campo etiqueta="Motivo del cambio" htmlFor="cobro-motivo" error={errors.motivoCambio}>
          <textarea
            id="cobro-motivo"
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
          {guardar.isPending ? 'Guardando...' : esEdicion ? 'Guardar cambio' : 'Registrar cobro'}
        </button>
      </div>
    </form>
  );
}
