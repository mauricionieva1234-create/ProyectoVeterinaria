import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearAltaRapida } from '../api/cola.js';

const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre es demasiado largo'),
  apellido: z
    .string()
    .trim()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(120, 'El apellido es demasiado largo'),
  tipoDocumento: z.enum(['DNI', 'pasaporte', 'otro'], { message: 'Elegí un tipo de documento' }),
  nroDocumento: z
    .string()
    .trim()
    .min(3, 'El documento debe tener al menos 3 caracteres')
    .max(30, 'El documento es demasiado largo'),
  servicio: z.enum(['atencion_clinica', 'vacunacion', 'control', 'cirugia', 'otro'], {
    message: 'Elegí un servicio',
  }),
  urgencia: z.enum(['posible', 'confirmada'], { message: 'Elegí el estado de la urgencia' }),
  comentario: z.string().trim().max(2000, 'El comentario es demasiado largo').optional(),
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

function textoONulo(valor) {
  const limpio = String(valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

export function FormularioAltaRapida({ puedeConfirmar, onCreado, onCancelar }) {
  const queryClient = useQueryClient();
  const [candidatos, setCandidatos] = useState([]);
  const [ultimoEnvio, setUltimoEnvio] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: '',
      apellido: '',
      tipoDocumento: 'DNI',
      nroDocumento: '',
      servicio: 'atencion_clinica',
      urgencia: 'posible',
      comentario: '',
    },
  });

  const guardar = useMutation({
    mutationFn: crearAltaRapida,
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['cola'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['fichas-incompletas'] });
      setCandidatos([]);
      onCreado(datos.ingreso);
    },
    onError: (error) => {
      if (error.codigo === 'CLIENTE_DUPLICADO') {
        setCandidatos(error.detalles?.[0]?.candidatos ?? []);
      }
    },
  });

  function armarPayload(datos, confirmarDuplicado = false) {
    const payload = {
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      tipoDocumento: datos.tipoDocumento,
      nroDocumento: datos.nroDocumento.trim(),
      servicio: datos.servicio,
      urgencia: datos.urgencia,
      comentario: textoONulo(datos.comentario),
    };

    if (confirmarDuplicado) {
      payload.confirmarDuplicado = true;
    }

    return payload;
  }

  function alEnviar(datos) {
    const payload = armarPayload(datos);
    setUltimoEnvio(payload);
    setCandidatos([]);
    guardar.mutate(payload);
  }

  function confirmarDuplicado() {
    if (!ultimoEnvio) return;
    guardar.mutate({ ...ultimoEnvio, confirmarDuplicado: true });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        El alta rápida crea un cliente mínimo y un paciente provisorio. Completá la ficha después.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor="alta-nombre" error={errors.nombre}>
          <input
            id="alta-nombre"
            className={claseControl}
            aria-invalid={errors.nombre ? 'true' : 'false'}
            {...register('nombre')}
          />
        </Campo>

        <Campo etiqueta="Apellido" htmlFor="alta-apellido" error={errors.apellido}>
          <input
            id="alta-apellido"
            className={claseControl}
            aria-invalid={errors.apellido ? 'true' : 'false'}
            {...register('apellido')}
          />
        </Campo>

        <Campo
          etiqueta="Tipo de documento"
          htmlFor="alta-tipo-documento"
          error={errors.tipoDocumento}
        >
          <select id="alta-tipo-documento" className={claseControl} {...register('tipoDocumento')}>
            <option value="DNI">DNI</option>
            <option value="pasaporte">Pasaporte</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>

        <Campo
          etiqueta="Número de documento"
          htmlFor="alta-nro-documento"
          error={errors.nroDocumento}
        >
          <input
            id="alta-nro-documento"
            className={claseControl}
            aria-invalid={errors.nroDocumento ? 'true' : 'false'}
            {...register('nroDocumento')}
          />
        </Campo>

        <Campo etiqueta="Servicio" htmlFor="alta-servicio" error={errors.servicio}>
          <select id="alta-servicio" className={claseControl} {...register('servicio')}>
            <option value="atencion_clinica">Atención clínica</option>
            <option value="vacunacion">Vacunación</option>
            <option value="control">Control</option>
            <option value="cirugia">Cirugía</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>

        <Campo etiqueta="Urgencia" htmlFor="alta-urgencia" error={errors.urgencia}>
          {puedeConfirmar ? (
            <select id="alta-urgencia" className={claseControl} {...register('urgencia')}>
              <option value="posible">Posible</option>
              <option value="confirmada">Confirmada</option>
            </select>
          ) : (
            <>
              <input type="hidden" {...register('urgencia')} />
              <p className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Posible. El veterinario confirma o descarta la urgencia.
              </p>
            </>
          )}
        </Campo>
      </div>

      <Campo etiqueta="Comentario" htmlFor="alta-comentario" error={errors.comentario}>
        <textarea
          id="alta-comentario"
          rows={2}
          className={claseControl}
          placeholder="Opcional: qué pasó o qué necesita el paciente"
          {...register('comentario')}
        />
      </Campo>

      {candidatos.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Ya existe un cliente con ese documento:</p>
          <ul className="mt-2 space-y-1">
            {candidatos.map((candidato) => (
              <li key={candidato.id}>
                {candidato.nombreCompleto} — {candidato.nroDocumento}
                {candidato.telefonoPrincipal ? ` — ${candidato.telefonoPrincipal}` : ''} —{' '}
                {candidato.pacientes} mascota{candidato.pacientes === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 rounded border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            onClick={confirmarDuplicado}
            disabled={guardar.isPending}
          >
            Crear igual
          </button>
        </div>
      )}

      {guardar.isError && guardar.error.codigo !== 'CLIENTE_DUPLICADO' && (
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
          {guardar.isPending ? 'Creando...' : 'Crear alta rápida'}
        </button>
      </div>
    </form>
  );
}
