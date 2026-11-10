import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useLogin, useSesion } from '../hooks/useSesion.js';

const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Ingresá tu email')
    .email('Ingresá un email válido')
    .max(255, 'El email es demasiado largo'),
  password: z.string().min(1, 'Ingresá tu contraseña').max(200, 'La contraseña es demasiado larga'),
});

export function Login() {
  const { data: sesion, isPending: cargandoSesion } = useSesion();
  const iniciarSesion = useLogin();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const destino = ubicacion.state?.desde ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: '', password: '' },
  });

  // Si ya hay una sesión activa, no tiene sentido mostrar el formulario.
  if (!cargandoSesion && sesion?.usuario) {
    return <Navigate to={destino} replace />;
  }

  async function alEnviar(datos) {
    try {
      await iniciarSesion.mutateAsync(datos);
      navegar(destino, { replace: true });
    } catch {
      // El mensaje se muestra abajo a partir del error de la mutación.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-teal-100 via-sky-50 to-violet-100 px-4 py-10 text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src="/logo-veterinaria.svg"
            alt=""
            className="mx-auto mb-3 size-16 drop-shadow-lg"
            width="64"
            height="64"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-teal-800">Veterinaria</h1>
          <p className="mt-1 text-sm text-slate-500">Sistema de gestión · Etapa 1</p>
        </div>

        <form
          className="space-y-4 rounded-2xl border border-teal-100 bg-white p-6 shadow-xl"
          onSubmit={handleSubmit(alEnviar)}
          noValidate
        >
          <h2 className="text-lg font-semibold">Iniciar sesión</h2>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-700" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              aria-invalid={errors.password ? 'true' : 'false'}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-700" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {iniciarSesion.isError && (
            <p
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {iniciarSesion.error.message}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={iniciarSesion.isPending}
          >
            {iniciarSesion.isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Los usuarios de demostración se crean con <code>npm run seed:demo</code>.
        </p>

        <p className="mt-2 text-center text-xs text-slate-500">
          <Link className="underline underline-offset-4 hover:text-slate-700" to="/">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
