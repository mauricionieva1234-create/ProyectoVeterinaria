import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarCobro, crearCobro, registrarPago } from '../api/cobros.js';
import { listarPrecios } from '../api/precios.js';
import {
  ETIQUETAS_MEDIO,
  MEDIOS_PAGO,
  etiqueta,
  formatearMoneda,
} from '../utils/etiquetasCobros.js';

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

const claseBotonSecundario =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

function redondear(valor) {
  return Math.round(Number(valor ?? 0) * 100) / 100;
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

const numeroManual = z.preprocess(
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

const numeroItem = (mensaje) =>
  z.preprocess(
    (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
    z
      .number({ message: mensaje })
      .finite('El importe no es válido')
      .min(0, 'El importe no puede ser negativo')
      .max(999999999.99, 'El importe es demasiado grande'),
  );

const esquemaItem = z.object({
  precioId: z.string().optional(),
  nombre: z
    .string()
    .trim()
    .min(2, 'El concepto debe tener al menos 2 caracteres')
    .max(200, 'El concepto es demasiado largo'),
  cantidad: z.preprocess(
    (valor) => (valor === '' || valor == null ? undefined : Number(valor)),
    z
      .number({ message: 'Ingresá la cantidad' })
      .int('La cantidad tiene que ser un número entero')
      .min(1, 'La cantidad tiene que ser mayor que cero')
      .max(9999, 'La cantidad es demasiado grande'),
  ),
  importeUnitario: numeroItem('Ingresá el importe unitario'),
});

// El total de un detalle es la suma de los subtotales redondeados por línea,
// igual que lo calcula el backend.
function totalDeItems(items = []) {
  return redondear(
    items.reduce(
      (suma, item) =>
        suma + redondear(Number(item.cantidad ?? 0) * Number(item.importeUnitario ?? 0)),
      0,
    ),
  );
}

function camposComunes() {
  return {
    observaciones: z.string().trim().max(2000, 'Las observaciones son demasiado largas').optional(),
    motivoCambio: z.string().trim().max(2000, 'El motivo es demasiado largo').optional(),
    medio: z.enum(MEDIOS_PAGO).optional(),
    montoPago: montoOpcional,
  };
}

// Validaciones que aplican a los dos modos. El total sale del detalle cuando el
// cobro es por ítem y del campo manual en el otro caso.
function validarComun(datos, contexto, { esEdicion, totalPagado }) {
  const total = datos.modo === 'detallado' ? totalDeItems(datos.items) : redondear(datos.total);

  if (esEdicion && (datos.motivoCambio ?? '').trim().length < 3) {
    contexto.addIssue({
      code: 'custom',
      path: ['motivoCambio'],
      message: 'Indicá el motivo del cambio (mínimo 3 caracteres)',
    });
  }

  if (total === 0 && (datos.observaciones ?? '').trim().length < 3) {
    contexto.addIssue({
      code: 'custom',
      path: ['observaciones'],
      message: 'Indicá una observación para un cobro sin cargo',
    });
  }

  if (esEdicion && total < totalPagado) {
    contexto.addIssue({
      code: 'custom',
      path: datos.modo === 'detallado' ? ['items'] : ['total'],
      message: `El total no puede quedar por debajo de lo ya pagado (${formatearMoneda(
        totalPagado,
      )})`,
    });
  }

  if (!esEdicion && datos.montoPago !== undefined && datos.montoPago > total) {
    contexto.addIssue({
      code: 'custom',
      path: ['montoPago'],
      message: 'El pago no puede superar el total del cobro',
    });
  }
}

function esquemaDe({ esEdicion, totalPagado }) {
  const comun = camposComunes();
  const validar = (datos, contexto) => validarComun(datos, contexto, { esEdicion, totalPagado });

  const manual = z
    .object({
      modo: z.literal('manual'),
      total: numeroManual,
      items: z.array(z.any()).optional(),
      ...comun,
    })
    .superRefine(validar);

  const detallado = z
    .object({
      modo: z.literal('detallado'),
      total: z.any().optional(),
      items: z
        .array(esquemaItem)
        .min(1, 'Agregá al menos un ítem o usá el total manual')
        .max(50, 'El cobro tiene demasiados ítems'),
      ...comun,
    })
    .superRefine(validar);

  return z.discriminatedUnion('modo', [manual, detallado]);
}

function itemInicial(item) {
  return {
    precioId: item?.precioId ? String(item.precioId) : '',
    nombre: item?.nombre ?? '',
    cantidad: item?.cantidad ?? 1,
    importeUnitario: item?.importeUnitario ?? '',
  };
}

// Una línea del detalle. Al elegir un precio de la lista se copian el nombre y
// el importe, pero se pueden corregir solo para este cobro.
function FilaItem({ indice, idFila, register, watch, setValue, errors, precios, onQuitar }) {
  const precioId = watch(`items.${indice}.precioId`) ?? '';
  const cantidad = Number(watch(`items.${indice}.cantidad`) ?? 0);
  const importe = Number(watch(`items.${indice}.importeUnitario`) ?? 0);
  const subtotal = redondear(cantidad * importe);
  const numero = indice + 1;

  const enLista = precios.some((precio) => String(precio.id) === String(precioId));

  function aplicarPrecio(valor) {
    if (!valor) return;

    const precio = precios.find((fila) => String(fila.id) === String(valor));

    if (!precio) return;

    setValue(`items.${indice}.nombre`, precio.nombre, { shouldDirty: true });
    setValue(`items.${indice}.importeUnitario`, precio.importe, { shouldDirty: true });
  }

  const errorItem = (campo) => errors?.items?.[indice]?.[campo];

  return (
    <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Ítem {numero}</p>
        <button
          type="button"
          className={claseBotonSecundario}
          onClick={() => onQuitar(indice)}
          aria-label={`Quitar ítem ${numero}`}
        >
          Quitar
        </button>
      </div>

      <Campo
        etiqueta={`Precio de la lista (ítem ${numero})`}
        htmlFor={`item-precio-${idFila}`}
        error={errorItem('precioId')}
      >
        <select
          id={`item-precio-${idFila}`}
          className={claseControl}
          {...register(`items.${indice}.precioId`, {
            onChange: (evento) => aplicarPrecio(evento.target.value),
          })}
        >
          <option value="">Concepto manual</option>
          {precios.map((precio) => (
            <option key={precio.id} value={precio.id}>
              {precio.nombre} · {formatearMoneda(precio.importe)}
            </option>
          ))}
          {precioId && !enLista && (
            <option value={precioId}>Precio actual (no disponible en la lista)</option>
          )}
        </select>
      </Campo>

      <Campo
        etiqueta={`Concepto del ítem ${numero}`}
        htmlFor={`item-nombre-${idFila}`}
        error={errorItem('nombre')}
      >
        <input
          id={`item-nombre-${idFila}`}
          type="text"
          className={claseControl}
          {...register(`items.${indice}.nombre`)}
        />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          etiqueta={`Cantidad del ítem ${numero}`}
          htmlFor={`item-cantidad-${idFila}`}
          error={errorItem('cantidad')}
        >
          <input
            id={`item-cantidad-${idFila}`}
            type="number"
            min="1"
            step="1"
            className={claseControl}
            {...register(`items.${indice}.cantidad`)}
          />
        </Campo>

        <Campo
          etiqueta={`Importe unitario del ítem ${numero}`}
          htmlFor={`item-importe-${idFila}`}
          error={errorItem('importeUnitario')}
        >
          <input
            id={`item-importe-${idFila}`}
            type="number"
            min="0"
            step="0.01"
            className={claseControl}
            {...register(`items.${indice}.importeUnitario`)}
          />
        </Campo>

        <div className="sm:pt-6">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Subtotal</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{formatearMoneda(subtotal)}</p>
        </div>
      </div>
    </div>
  );
}

// Formulario de cobro. En creación acepta un pago inicial. En edición corrige
// el total o el detalle con motivo, sin tocar los pagos ya registrados.
export function FormularioCobro({ pendiente, cobro, onGuardado, onCancelar }) {
  const esEdicion = Boolean(cobro);
  const queryClient = useQueryClient();
  const totalPagado = esEdicion ? Number(cobro.pagado ?? 0) : 0;

  const itemsIniciales =
    esEdicion && cobro.items?.length > 0 ? cobro.items.map(itemInicial) : [itemInicial(null)];

  const modoInicial = esEdicion && cobro.items?.length > 0 ? 'detallado' : 'manual';

  const esquema = useMemo(() => esquemaDe({ esEdicion, totalPagado }), [esEdicion, totalPagado]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      modo: modoInicial,
      total: esEdicion && modoInicial === 'manual' ? cobro.total : '',
      items: itemsIniciales,
      observaciones: esEdicion ? (cobro.observaciones ?? '') : '',
      motivoCambio: '',
      medio: 'efectivo',
      montoPago: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const modo = watch('modo');
  const observados = watch('items') ?? [];
  const totalItems = totalDeItems(observados);
  const totalManual = redondear(Number(watch('total') ?? 0));
  const totalObservado = modo === 'detallado' ? totalItems : totalManual;

  const precios = useQuery({
    queryKey: ['precios', 'activos'],
    queryFn: () => listarPrecios(),
    enabled: modo === 'detallado',
    staleTime: 60 * 1000,
  });

  const listaPrecios = precios.data?.datos ?? [];

  const guardar = useMutation({
    mutationFn: async (datos) => {
      const observaciones = datos.observaciones?.trim() || null;
      const detallado = datos.modo === 'detallado';

      const cuerpo = detallado
        ? {
            observaciones,
            items: datos.items.map((item) => ({
              precioId: item.precioId ? Number(item.precioId) : null,
              nombre: item.nombre.trim(),
              cantidad: Number(item.cantidad),
              importeUnitario: Number(item.importeUnitario),
            })),
          }
        : { total: Number(datos.total), observaciones };

      if (esEdicion) {
        return actualizarCobro(cobro.id, {
          ...cuerpo,
          motivoCambio: datos.motivoCambio.trim(),
        });
      }

      const creado = await crearCobro({
        visitaId: pendiente.visitaId,
        ...cuerpo,
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
      queryClient.invalidateQueries({ queryKey: ['precios'] });
      onGuardado(datos.cobro ?? datos);
    },
  });

  const paciente = esEdicion ? cobro.paciente : pendiente.paciente;
  const cliente = esEdicion ? cobro.cliente : pendiente.cliente;
  const mensajeItems = errors.items?.message ?? errors.items?.root?.message;

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

      {esEdicion ? (
        <p className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          {modo === 'detallado'
            ? 'Este cobro tiene detalle por ítem: se edita el detalle completo.'
            : 'Este cobro se cargó con total manual: se edita el total.'}
        </p>
      ) : (
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">Forma del cobro</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" value="manual" {...register('modo')} />
              Total manual
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" value="detallado" {...register('modo')} />
              Detallado por ítem
            </label>
          </div>
        </fieldset>
      )}

      {modo === 'manual' ? (
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
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Detalle del cobro</h3>
            <button
              type="button"
              className={claseBotonSecundario}
              onClick={() => append(itemInicial(null))}
            >
              Agregar ítem
            </button>
          </div>

          {precios.isError && (
            <p className="text-sm text-red-700" role="alert">
              No se pudo cargar la lista de precios. Igual podés escribir conceptos manuales.
            </p>
          )}

          {fields.map((field, indice) => (
            <FilaItem
              key={field.id}
              indice={indice}
              idFila={field.id}
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              precios={listaPrecios}
              onQuitar={remove}
            />
          ))}

          {mensajeItems && (
            <p className="text-sm text-red-700" role="alert">
              {mensajeItems}
            </p>
          )}

          <div
            className="flex items-center justify-between rounded border border-teal-200 bg-teal-50 px-3 py-2"
            aria-live="polite"
          >
            <span className="text-sm font-medium text-teal-900">Total del cobro</span>
            <span className="text-lg font-semibold text-teal-900">
              {formatearMoneda(totalItems)}
            </span>
          </div>

          {totalItems === 0 && (
            <p className="text-xs text-slate-500">
              Un total en cero registra la visita sin cargo y pide una observación.
            </p>
          )}
        </div>
      )}

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
