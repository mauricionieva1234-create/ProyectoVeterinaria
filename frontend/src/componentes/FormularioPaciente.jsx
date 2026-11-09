import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { listarEspecies, listarRazas } from '../api/catalogos.js';
import { actualizarPaciente, crearPaciente } from '../api/pacientes.js';
import { SelectorCliente } from './SelectorCliente.jsx';

const fecha = z
  .string()
  .optional()
  .refine((valor) => !valor || /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Usá el formato aaaa-mm-dd');

const esquema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'El nombre es obligatorio')
      .max(120, 'El nombre es demasiado largo'),
    especieId: z.string().min(1, 'Elegí una especie'),
    razaId: z.string().optional(),
    sexo: z.enum(['macho', 'hembra', 'desconocido'], { message: 'Elegí el sexo' }),
    castrado: z.boolean(),
    fechaCastracion: fecha,
    esReproductor: z.boolean(),
    fechaNacimiento: fecha,
    nacimientoAproximado: z.boolean(),
    fechaDeceso: fecha,
    origen: z.string().optional(),
    chipCodigo: z.string().trim().max(50, 'El código de chip es demasiado largo').optional(),
    color: z.string().trim().max(60, 'El color es demasiado largo').optional(),
    comentario: z.string().trim().max(2000, 'El comentario es demasiado largo').optional(),
    provisorio: z.boolean(),
  })
  .superRefine((datos, contexto) => {
    if (datos.fechaDeceso && datos.fechaNacimiento && datos.fechaDeceso < datos.fechaNacimiento) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaDeceso'],
        message: 'La fecha de deceso no puede ser anterior al nacimiento',
      });
    }

    if (
      datos.fechaCastracion &&
      datos.fechaNacimiento &&
      datos.fechaCastracion < datos.fechaNacimiento
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaCastracion'],
        message: 'La fecha de castración no puede ser anterior al nacimiento',
      });
    }
  });

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

function textoONulo(valor) {
  const limpio = String(valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

function nombreDeCliente(cliente) {
  if (!cliente) return '';
  if (cliente.nombreCompleto) return cliente.nombreCompleto;
  return `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim();
}

export function FormularioPaciente({
  paciente,
  cliente,
  permitirCambioDueno = false,
  onGuardado,
  onCancelar,
}) {
  const esEdicion = Boolean(paciente);
  const queryClient = useQueryClient();
  const [dueno, setDueno] = useState(cliente);
  const [errorDueno, setErrorDueno] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: paciente?.nombre ?? '',
      especieId: paciente?.especieId ? String(paciente.especieId) : '',
      razaId: paciente?.razaId ? String(paciente.razaId) : '',
      sexo: paciente?.sexo ?? 'desconocido',
      castrado: paciente?.castrado ?? false,
      fechaCastracion: paciente?.fechaCastracion ?? '',
      esReproductor: paciente?.esReproductor ?? false,
      fechaNacimiento: paciente?.fechaNacimiento ?? '',
      nacimientoAproximado: paciente?.nacimientoAproximado ?? false,
      fechaDeceso: paciente?.fechaDeceso ?? '',
      origen: paciente?.origen ?? '',
      chipCodigo: paciente?.chipCodigo ?? '',
      color: paciente?.color ?? '',
      comentario: paciente?.comentario ?? '',
      provisorio: paciente?.provisorio ?? false,
    },
  });

  const especieId = watch('especieId');

  const especies = useQuery({
    queryKey: ['especies'],
    queryFn: () => listarEspecies(),
    staleTime: 5 * 60 * 1000,
  });

  const razas = useQuery({
    queryKey: ['razas', especieId],
    queryFn: () => listarRazas({ especieId }),
    enabled: Boolean(especieId),
    staleTime: 5 * 60 * 1000,
  });

  // Al cambiar de especie, la raza elegida deja de ser válida.
  const especieAnterior = useRef(especieId);

  useEffect(() => {
    if (especieAnterior.current !== especieId) {
      setValue('razaId', '');
      especieAnterior.current = especieId;
    }
  }, [especieId, setValue]);

  const guardar = useMutation({
    mutationFn: (datos) =>
      esEdicion ? actualizarPaciente(paciente.id, datos) : crearPaciente(datos),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', datos.paciente.clienteId] });

      if (paciente?.clienteId) {
        queryClient.invalidateQueries({ queryKey: ['cliente', paciente.clienteId] });
      }

      onGuardado(datos.paciente);
    },
  });

  function alEnviar(datos) {
    if (!dueno?.id) {
      setErrorDueno({ message: 'Elegí el dueño del paciente' });
      return;
    }

    setErrorDueno(null);

    guardar.mutate({
      clienteId: dueno.id,
      nombre: datos.nombre.trim(),
      especieId: Number(datos.especieId),
      razaId: datos.razaId ? Number(datos.razaId) : null,
      sexo: datos.sexo,
      castrado: datos.castrado,
      fechaCastracion: textoONulo(datos.fechaCastracion),
      esReproductor: datos.esReproductor,
      fechaNacimiento: textoONulo(datos.fechaNacimiento),
      nacimientoAproximado: datos.nacimientoAproximado,
      fechaDeceso: textoONulo(datos.fechaDeceso),
      origen: textoONulo(datos.origen),
      chipCodigo: textoONulo(datos.chipCodigo),
      color: textoONulo(datos.color),
      comentario: textoONulo(datos.comentario),
      // El alta rápida se maneja en la fase 3; acá solo se conserva o se quita
      // la marca de un paciente provisorio existente.
      provisorio: paciente?.provisorio ? datos.provisorio : false,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      <div>
        {permitirCambioDueno ? (
          <SelectorCliente
            cliente={dueno}
            onSeleccionar={setDueno}
            excluirId={null}
            error={errorDueno}
          />
        ) : (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">Dueño: </span>
            <span className="font-medium text-slate-800">{nombreDeCliente(dueno)}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor="nombre-paciente" error={errors.nombre}>
          <input
            id="nombre-paciente"
            className={claseControl}
            aria-invalid={errors.nombre ? 'true' : 'false'}
            {...register('nombre')}
          />
        </Campo>

        <Campo etiqueta="Especie" htmlFor="especieId" error={errors.especieId}>
          <select
            id="especieId"
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

        <Campo
          etiqueta="Raza"
          htmlFor="razaId"
          error={errors.razaId}
          ayuda="Si no figura en la lista, dejá «Sin raza»."
        >
          <select
            id="razaId"
            className={claseControl}
            disabled={!especieId}
            {...register('razaId')}
          >
            <option value="">Sin raza</option>
            {(razas.data?.datos ?? []).map((raza) => (
              <option key={raza.id} value={raza.id}>
                {raza.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Sexo" htmlFor="sexo" error={errors.sexo}>
          <select id="sexo" className={claseControl} {...register('sexo')}>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
            <option value="desconocido">Desconocido</option>
          </select>
        </Campo>

        <Campo
          etiqueta="Fecha de nacimiento"
          htmlFor="fechaNacimiento"
          error={errors.fechaNacimiento}
        >
          <input
            id="fechaNacimiento"
            type="date"
            className={claseControl}
            aria-invalid={errors.fechaNacimiento ? 'true' : 'false'}
            {...register('fechaNacimiento')}
          />
        </Campo>

        <Campo etiqueta="Fecha de deceso" htmlFor="fechaDeceso" error={errors.fechaDeceso}>
          <input
            id="fechaDeceso"
            type="date"
            className={claseControl}
            aria-invalid={errors.fechaDeceso ? 'true' : 'false'}
            {...register('fechaDeceso')}
          />
        </Campo>

        <Campo
          etiqueta="Fecha de castración"
          htmlFor="fechaCastracion"
          error={errors.fechaCastracion}
        >
          <input
            id="fechaCastracion"
            type="date"
            className={claseControl}
            aria-invalid={errors.fechaCastracion ? 'true' : 'false'}
            {...register('fechaCastracion')}
          />
        </Campo>

        <Campo etiqueta="Origen" htmlFor="origen" error={errors.origen}>
          <select id="origen" className={claseControl} {...register('origen')}>
            <option value="">Sin datos</option>
            <option value="criado">Criado en casa</option>
            <option value="adoptado">Adoptado</option>
            <option value="rescatado">Rescatado</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>

        <Campo etiqueta="Color" htmlFor="color" error={errors.color}>
          <input id="color" className={claseControl} {...register('color')} />
        </Campo>

        <Campo etiqueta="Código de chip" htmlFor="chipCodigo" error={errors.chipCodigo}>
          <input id="chipCodigo" className={claseControl} {...register('chipCodigo')} />
        </Campo>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('castrado')} />
          Está castrado
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('esReproductor')} />
          Se usa como reproductor
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('nacimientoAproximado')} />
          La fecha de nacimiento es aproximada
        </label>
        {paciente?.provisorio && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="size-4" {...register('provisorio')} />
            Sigue siendo provisorio
          </label>
        )}
      </div>

      <Campo etiqueta="Comentario" htmlFor="comentario" error={errors.comentario}>
        <textarea id="comentario" rows={3} className={claseControl} {...register('comentario')} />
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
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
