import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { crearIngreso } from '../api/cola.js';
import { SelectorPaciente } from './SelectorPaciente.jsx';

const esquema = z.object({
  servicio: z.enum(['atencion_clinica', 'vacunacion', 'control', 'cirugia', 'otro'], {
    message: 'Elegí un servicio',
  }),
  marcarPosibleUrgencia: z.boolean(),
  comentario: z.string().trim().max(2000, 'El comentario es demasiado largo').optional(),
});

const claseControl =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

export function FormularioIngreso({ pacienteInicial = null, onCreado, onCancelar }) {
  const queryClient = useQueryClient();
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [errorPaciente, setErrorPaciente] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      servicio: 'atencion_clinica',
      marcarPosibleUrgencia: false,
      comentario: '',
    },
  });

  const guardar = useMutation({
    mutationFn: crearIngreso,
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['cola'] });
      onCreado(datos.ingreso);
    },
  });

  function alEnviar(datos) {
    if (!paciente) {
      setErrorPaciente(new Error('Elegí un paciente para agregar a la cola'));
      return;
    }

    setErrorPaciente(null);

    guardar.mutate({
      pacienteId: paciente.id,
      servicio: datos.servicio,
      marcarPosibleUrgencia: datos.marcarPosibleUrgencia,
      comentario: datos.comentario?.trim() ? datos.comentario.trim() : null,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      <SelectorPaciente
        paciente={paciente}
        onSeleccionar={(elegido) => {
          setPaciente(elegido);
          setErrorPaciente(null);
        }}
        error={errorPaciente}
      />

      <div>
        <label htmlFor="servicio" className="block text-sm font-medium text-slate-700">
          Servicio
        </label>
        <select id="servicio" className={claseControl} {...register('servicio')}>
          <option value="atencion_clinica">Atención clínica</option>
          <option value="vacunacion">Vacunación</option>
          <option value="control">Control</option>
          <option value="cirugia">Cirugía</option>
          <option value="otro">Otro</option>
        </select>
        {errors.servicio && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {errors.servicio.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="comentario" className="block text-sm font-medium text-slate-700">
          Comentario
        </label>
        <textarea
          id="comentario"
          rows={2}
          className={claseControl}
          placeholder="Opcional: motivo de la consulta o aclaración para el veterinario"
          {...register('comentario')}
        />
        {errors.comentario && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {errors.comentario.message}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="size-4" {...register('marcarPosibleUrgencia')} />
        Marcar como posible urgencia
      </label>

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
          {guardar.isPending ? 'Agregando...' : 'Agregar a la cola'}
        </button>
      </div>
    </form>
  );
}
