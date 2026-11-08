import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarUsuario, crearUsuario } from '../api/usuarios.js';
import { ETIQUETAS_ROL } from '../utils/roles.js';

// El esquema cambia entre alta y edición: en el alta la contraseña es
// obligatoria; en la edición, dejarla vacía significa "no cambiarla".
function crearEsquema(esEdicion) {
  return z
    .object({
      nombreCompleto: z
        .string()
        .trim()
        .min(2, 'El nombre completo debe tener al menos 2 caracteres')
        .max(120, 'El nombre completo es demasiado largo'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, 'Ingresá un email')
        .email('Ingresá un email válido')
        .max(255, 'El email es demasiado largo'),
      rol: z.enum(['admin', 'veterinario', 'recepcion'], { message: 'Elegí un rol' }),
      matricula: z.string().trim().max(50, 'La matrícula es demasiado larga').optional(),
      password: z.string().max(72, 'La contraseña no puede superar los 72 caracteres').optional(),
      activo: z.boolean(),
    })
    .superRefine((datos, contexto) => {
      if (!esEdicion && !datos.password) {
        contexto.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'La contraseña es obligatoria',
        });
      }

      if (datos.password && datos.password.length < 8) {
        contexto.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'La contraseña debe tener al menos 8 caracteres',
        });
      }

      if (datos.rol !== 'veterinario' && datos.matricula) {
        contexto.addIssue({
          code: 'custom',
          path: ['matricula'],
          message: 'La matrícula solo corresponde a veterinarios',
        });
      }
    });
}

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

export function FormularioUsuario({ usuario, onGuardado, onCancelar }) {
  const esEdicion = Boolean(usuario);
  const queryClient = useQueryClient();

  const esquema = useMemo(() => crearEsquema(esEdicion), [esEdicion]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreCompleto: usuario?.nombreCompleto ?? '',
      email: usuario?.email ?? '',
      rol: usuario?.rol ?? 'veterinario',
      matricula: usuario?.matricula ?? '',
      password: '',
      activo: usuario?.activo ?? true,
    },
  });

  const rol = watch('rol');

  const guardar = useMutation({
    mutationFn: (datos) => (esEdicion ? actualizarUsuario(usuario.id, datos) : crearUsuario(datos)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onGuardado();
    },
  });

  function alEnviar(datos) {
    const payload = {
      nombreCompleto: datos.nombreCompleto,
      email: datos.email,
      rol: datos.rol,
      // La matrícula solo se manda para veterinarios; en el resto va vacía.
      matricula: datos.rol === 'veterinario' && datos.matricula ? datos.matricula : null,
      activo: datos.activo,
    };

    if (datos.password) {
      payload.password = datos.password;
    }

    guardar.mutate(payload);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(alEnviar)} noValidate>
      <Campo etiqueta="Nombre completo" htmlFor="nombreCompleto" error={errors.nombreCompleto}>
        <input
          id="nombreCompleto"
          className={claseControl}
          aria-invalid={errors.nombreCompleto ? 'true' : 'false'}
          {...register('nombreCompleto')}
        />
      </Campo>

      <Campo etiqueta="Email" htmlFor="email" error={errors.email}>
        <input
          id="email"
          type="email"
          autoComplete="off"
          className={claseControl}
          aria-invalid={errors.email ? 'true' : 'false'}
          {...register('email')}
        />
      </Campo>

      <Campo etiqueta="Rol" htmlFor="rol" error={errors.rol}>
        <select id="rol" className={claseControl} {...register('rol')}>
          {Object.entries(ETIQUETAS_ROL).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      {rol === 'veterinario' && (
        <Campo etiqueta="Matrícula" htmlFor="matricula" error={errors.matricula}>
          <input
            id="matricula"
            className={claseControl}
            aria-invalid={errors.matricula ? 'true' : 'false'}
            {...register('matricula')}
          />
        </Campo>
      )}

      <Campo
        etiqueta="Contraseña"
        htmlFor="password"
        error={errors.password}
        ayuda={esEdicion ? 'Dejala vacía para conservar la contraseña actual.' : undefined}
      >
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={claseControl}
          aria-invalid={errors.password ? 'true' : 'false'}
          {...register('password')}
        />
      </Campo>

      <div className="flex items-center gap-2">
        <input id="activo" type="checkbox" className="size-4" {...register('activo')} />
        <label htmlFor="activo" className="text-sm text-slate-700">
          Usuario activo
        </label>
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
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={guardar.isPending}
        >
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
