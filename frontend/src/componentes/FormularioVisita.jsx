import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { listarEspecies } from '../api/catalogos.js';
import { actualizarVisita, cerrarVisita, crearVisita } from '../api/visitas.js';
import { numeroONulo, textoONulo } from '../utils/formularios.js';

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

const numeroOpcional = (min, max, mensaje) =>
  z
    .string()
    .trim()
    .optional()
    .refine((valor) => {
      if (!valor) return true;
      const numero = Number(valor);
      return Number.isFinite(numero) && numero >= min && numero <= max;
    }, mensaje);

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).optional();

function esquemaDe({ esEdicion, esBorrador, esProvisorio }) {
  return z
    .object({
      motivoConsulta: textoOpcional(5000, 'El motivo es demasiado largo'),
      anamnesis: textoOpcional(10000, 'La anamnesis es demasiado larga'),
      temperaturaC: numeroOpcional(20, 50, 'La temperatura debe estar entre 20 y 50 °C'),
      pesoKg: numeroOpcional(0.01, 9999.99, 'El peso debe ser mayor que cero'),
      diagnostico: textoOpcional(10000, 'El diagnóstico es demasiado largo'),
      observaciones: textoOpcional(10000, 'Las observaciones son demasiado largas'),
      motivoCambio: textoOpcional(2000, 'El motivo del cambio es demasiado largo'),
      especieId: z.string().optional(),
      nombre: z.string().trim().max(120, 'El nombre es demasiado largo').optional(),
    })
    .superRefine((datos, contexto) => {
      if (esEdicion && !esBorrador && (datos.motivoCambio ?? '').trim().length < 3) {
        contexto.addIssue({
          code: 'custom',
          path: ['motivoCambio'],
          message: 'Indicá el motivo del cambio (mínimo 3 caracteres)',
        });
      }

      if (!esEdicion && esProvisorio && !datos.especieId) {
        contexto.addIssue({
          code: 'custom',
          path: ['especieId'],
          message: 'Elegí la especie real del paciente provisorio',
        });
      }
    });
}

// Formulario clínico de una visita. En creación pide paciente e ingreso; en
// edición decide si guarda un borrador o una corrección con motivo.
export function FormularioVisita({ visita, paciente, ingresoId, onGuardada, onCancelar }) {
  const esEdicion = Boolean(visita);
  const esBorrador = !visita || visita.estado === 'borrador';
  const esProvisorio = Boolean(!visita && paciente?.provisorio);
  const queryClient = useQueryClient();

  const esquema = useMemo(
    () => esquemaDe({ esEdicion, esBorrador, esProvisorio }),
    [esEdicion, esBorrador, esProvisorio],
  );

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      motivoConsulta: visita?.motivoConsulta ?? '',
      anamnesis: visita?.anamnesis ?? '',
      temperaturaC: visita?.temperaturaC ?? '',
      pesoKg: visita?.pesoKg ?? '',
      diagnostico: visita?.diagnostico ?? '',
      observaciones: visita?.observaciones ?? '',
      motivoCambio: '',
      especieId: paciente?.provisorio ? '' : String(paciente?.especieId ?? ''),
      nombre: paciente?.nombre ?? '',
    },
  });

  const especies = useQuery({
    queryKey: ['especies'],
    queryFn: () => listarEspecies(),
    enabled: esProvisorio,
    staleTime: 5 * 60 * 1000,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['visita', visita?.id] });
    queryClient.invalidateQueries({ queryKey: ['visitas'] });
    queryClient.invalidateQueries({ queryKey: ['paciente', paciente?.id] });
    queryClient.invalidateQueries({ queryKey: ['cola'] });
  }

  const guardar = useMutation({
    mutationFn: (datos) => (esEdicion ? actualizarVisita(visita.id, datos) : crearVisita(datos)),
    onSuccess: (datos) => {
      invalidar();
      onGuardada(datos.visita);
    },
  });

  const cerrar = useMutation({
    mutationFn: (datos) => cerrarVisita(visita.id, datos),
    onSuccess: (datos) => {
      invalidar();
      onGuardada(datos.visita);
    },
  });

  function cuerpoClinico(datos) {
    return {
      motivoConsulta: textoONulo(datos.motivoConsulta),
      anamnesis: textoONulo(datos.anamnesis),
      temperaturaC: numeroONulo(datos.temperaturaC),
      pesoKg: numeroONulo(datos.pesoKg),
      diagnostico: textoONulo(datos.diagnostico),
      observaciones: textoONulo(datos.observaciones),
    };
  }

  function alEnviar(datos) {
    const cuerpo = cuerpoClinico(datos);

    if (esEdicion) {
      if (!esBorrador) cuerpo.motivoCambio = datos.motivoCambio.trim();
      guardar.mutate(cuerpo);
      return;
    }

    cuerpo.pacienteId = Number(paciente.id);
    if (ingresoId) cuerpo.ingresoId = Number(ingresoId);

    if (esProvisorio) {
      cuerpo.especieId = Number(datos.especieId);
      cuerpo.nombre = textoONulo(datos.nombre);
    }

    guardar.mutate(cuerpo);
  }

  function alCerrar() {
    const motivo = String(getValues('motivoConsulta') ?? '').trim();

    if (motivo.length < 3) {
      setError('motivoConsulta', {
        message: 'El motivo de consulta es obligatorio para cerrar la visita',
      });
      return;
    }

    cerrar.mutate({ motivoConsulta: motivo });
  }

  const errorAccion = guardar.error ?? cerrar.error;
  const pendiente = guardar.isPending || cerrar.isPending;

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      {!esEdicion && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            Paciente: <span className="font-medium">{paciente?.nombre}</span>{' '}
            <span className="font-mono text-xs text-slate-500">{paciente?.codigoInterno}</span>
          </p>
          {esProvisorio && (
            <p className="mt-1 text-xs text-amber-800">
              Es un paciente provisorio: completá la especie y, si querés, el nombre real.
            </p>
          )}
        </div>
      )}

      {esProvisorio && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Especie real" htmlFor="visita-especie" error={errors.especieId}>
            <select
              id="visita-especie"
              className={claseControl}
              aria-invalid={errors.especieId ? 'true' : 'false'}
              {...register('especieId')}
            >
              <option value="">Seleccioná una especie</option>
              {(especies.data?.datos ?? []).map((especie) => (
                <option key={especie.id} value={especie.id}>
                  {especie.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Nombre del paciente" htmlFor="visita-nombre" error={errors.nombre}>
            <input id="visita-nombre" className={claseControl} {...register('nombre')} />
          </Campo>
        </div>
      )}

      <Campo
        etiqueta="Motivo de consulta"
        htmlFor="visita-motivo"
        error={errors.motivoConsulta}
        ayuda="Obligatorio para cerrar la visita."
      >
        <textarea
          id="visita-motivo"
          rows={2}
          className={claseControl}
          aria-invalid={errors.motivoConsulta ? 'true' : 'false'}
          {...register('motivoConsulta')}
        />
      </Campo>

      <Campo etiqueta="Anamnesis" htmlFor="visita-anamnesis" error={errors.anamnesis}>
        <textarea
          id="visita-anamnesis"
          rows={3}
          className={claseControl}
          {...register('anamnesis')}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Temperatura (°C)" htmlFor="visita-temperatura" error={errors.temperaturaC}>
          <input
            id="visita-temperatura"
            type="number"
            step="0.1"
            className={claseControl}
            {...register('temperaturaC')}
          />
        </Campo>

        <Campo etiqueta="Peso (kg)" htmlFor="visita-peso" error={errors.pesoKg}>
          <input
            id="visita-peso"
            type="number"
            step="0.01"
            className={claseControl}
            {...register('pesoKg')}
          />
        </Campo>
      </div>

      <Campo etiqueta="Diagnóstico" htmlFor="visita-diagnostico" error={errors.diagnostico}>
        <textarea
          id="visita-diagnostico"
          rows={3}
          className={claseControl}
          {...register('diagnostico')}
        />
      </Campo>

      <Campo etiqueta="Observaciones" htmlFor="visita-observaciones" error={errors.observaciones}>
        <textarea
          id="visita-observaciones"
          rows={3}
          className={claseControl}
          {...register('observaciones')}
        />
      </Campo>

      {esEdicion && !esBorrador && (
        <Campo
          etiqueta="Motivo del cambio"
          htmlFor="visita-motivo-cambio"
          error={errors.motivoCambio}
          ayuda="La corrección guarda una versión con el estado anterior."
        >
          <textarea
            id="visita-motivo-cambio"
            rows={2}
            className={claseControl}
            aria-invalid={errors.motivoCambio ? 'true' : 'false'}
            {...register('motivoCambio')}
          />
        </Campo>
      )}

      {errorAccion && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorAccion.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        {onCancelar && (
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={onCancelar}
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={pendiente}
        >
          {guardar.isPending
            ? 'Guardando...'
            : esEdicion
              ? esBorrador
                ? 'Guardar borrador'
                : 'Guardar corrección'
              : 'Iniciar visita'}
        </button>

        {esEdicion && esBorrador && (
          <button
            type="button"
            className="rounded border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
            onClick={alCerrar}
            disabled={pendiente}
          >
            {cerrar.isPending ? 'Cerrando...' : 'Cerrar visita'}
          </button>
        )}
      </div>
    </form>
  );
}
