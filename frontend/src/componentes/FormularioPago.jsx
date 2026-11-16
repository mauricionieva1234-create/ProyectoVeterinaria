import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { registrarPago } from '../api/cobros.js';
import {
  ETIQUETAS_MEDIO,
  MEDIOS_PAGO,
  etiqueta,
  formatearMoneda,
} from '../utils/etiquetasCobros.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

const esquema = z.object({
  medio: z.enum(MEDIOS_PAGO, { message: 'Elegí un medio de pago válido' }),
  monto: z.preprocess(
    (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
    z
      .number({ message: 'Ingresá un monto válido' })
      .finite('El monto no es válido')
      .positive('El monto tiene que ser mayor que cero'),
  ),
});

// Registra un pago parcial o total sobre un cobro existente. El backend vuelve
// a validar el saldo dentro de la transacción.
export function FormularioPago({ cobro, onGuardado, onCancelar }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      medio: 'efectivo',
      monto: cobro.saldo > 0 ? cobro.saldo : '',
    },
  });

  const guardar = useMutation({
    mutationFn: (datos) => registrarPago(cobro.id, datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      queryClient.invalidateQueries({ queryKey: ['deudas'] });
      queryClient.invalidateQueries({ queryKey: ['pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['cola'] });
      queryClient.invalidateQueries({ queryKey: ['visita'] });
      onGuardado(datos.cobro);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((datos) => guardar.mutate(datos))}
      noValidate
    >
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p>
          Paciente: <span className="font-medium">{cobro.paciente?.nombre}</span>
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Total {formatearMoneda(cobro.total)} · Pagado {formatearMoneda(cobro.pagado)} ·{' '}
          <span className="font-medium text-rose-700">Saldo {formatearMoneda(cobro.saldo)}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pago-medio" className="block text-sm font-medium text-slate-700">
            Medio de pago
          </label>
          <select id="pago-medio" className={claseControl} {...register('medio')}>
            {MEDIOS_PAGO.map((medio) => (
              <option key={medio} value={medio}>
                {etiqueta(ETIQUETAS_MEDIO, medio)}
              </option>
            ))}
          </select>
          {errors.medio && (
            <p className="mt-1 text-sm text-red-700" role="alert">
              {errors.medio.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pago-monto" className="block text-sm font-medium text-slate-700">
            Monto
          </label>
          <input
            id="pago-monto"
            type="number"
            min="0.01"
            step="0.01"
            className={claseControl}
            {...register('monto')}
          />
          {errors.monto && (
            <p className="mt-1 text-sm text-red-700" role="alert">
              {errors.monto.message}
            </p>
          )}
        </div>
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
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          disabled={guardar.isPending}
        >
          {guardar.isPending ? 'Registrando...' : 'Registrar pago'}
        </button>
      </div>
    </form>
  );
}
