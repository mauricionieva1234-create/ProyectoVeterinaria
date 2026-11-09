import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { actualizarCliente, crearCliente } from '../api/clientes.js';

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
  telefonoPrincipal: z.string().trim().max(30, 'El teléfono es demasiado largo').optional(),
  telefonoEsWhatsapp: z.boolean(),
  telefonoAlternativo: z.string().trim().max(30, 'El teléfono es demasiado largo').optional(),
  email: z
    .string()
    .trim()
    .max(255, 'El email es demasiado largo')
    .optional()
    .refine(
      (valor) => !valor || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
      'Ingresá un email válido',
    ),
  calleNumero: z.string().trim().max(150, 'La dirección es demasiado larga').optional(),
  localidadBarrio: z.string().trim().max(120, 'La localidad es demasiado larga').optional(),
  provincia: z.string().trim().max(120, 'La provincia es demasiado larga').optional(),
  pais: z.string().trim().max(80, 'El país es demasiado largo').optional(),
  aceptaCorreo: z.boolean(),
  aceptaWhatsapp: z.boolean(),
  fechaConsentimiento: z
    .string()
    .optional()
    .refine((valor) => !valor || /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Usá el formato aaaa-mm-dd'),
  observaciones: z.string().trim().max(2000, 'Las observaciones son demasiado largas').optional(),
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

export function FormularioCliente({ cliente, onGuardado, onCancelar }) {
  const esEdicion = Boolean(cliente);
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
      nombre: cliente?.nombre ?? '',
      apellido: cliente?.apellido ?? '',
      tipoDocumento: cliente?.tipoDocumento ?? 'DNI',
      nroDocumento: cliente?.nroDocumento ?? '',
      telefonoPrincipal: cliente?.telefonoPrincipal ?? '',
      telefonoEsWhatsapp: cliente?.telefonoEsWhatsapp ?? false,
      telefonoAlternativo: cliente?.telefonoAlternativo ?? '',
      email: cliente?.email ?? '',
      calleNumero: cliente?.calleNumero ?? '',
      localidadBarrio: cliente?.localidadBarrio ?? '',
      provincia: cliente?.provincia ?? '',
      pais: cliente?.pais ?? 'Argentina',
      aceptaCorreo: cliente?.aceptaCorreo ?? false,
      aceptaWhatsapp: cliente?.aceptaWhatsapp ?? false,
      fechaConsentimiento: cliente?.fechaConsentimiento ?? '',
      observaciones: cliente?.observaciones ?? '',
    },
  });

  const guardar = useMutation({
    mutationFn: (datos) => (esEdicion ? actualizarCliente(cliente.id, datos) : crearCliente(datos)),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['fichas-incompletas'] });
      if (esEdicion) {
        queryClient.invalidateQueries({ queryKey: ['cliente', cliente.id] });
      }
      setCandidatos([]);
      onGuardado(datos.cliente);
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
      telefonoPrincipal: textoONulo(datos.telefonoPrincipal),
      telefonoEsWhatsapp: datos.telefonoEsWhatsapp,
      telefonoAlternativo: textoONulo(datos.telefonoAlternativo),
      email: textoONulo(datos.email)?.toLowerCase() ?? null,
      calleNumero: textoONulo(datos.calleNumero),
      localidadBarrio: textoONulo(datos.localidadBarrio),
      provincia: textoONulo(datos.provincia),
      pais: textoONulo(datos.pais) ?? 'Argentina',
      aceptaCorreo: datos.aceptaCorreo,
      aceptaWhatsapp: datos.aceptaWhatsapp,
      fechaConsentimiento: textoONulo(datos.fechaConsentimiento),
      observaciones: textoONulo(datos.observaciones),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre}>
          <input
            id="nombre"
            className={claseControl}
            aria-invalid={errors.nombre ? 'true' : 'false'}
            {...register('nombre')}
          />
        </Campo>

        <Campo etiqueta="Apellido" htmlFor="apellido" error={errors.apellido}>
          <input
            id="apellido"
            className={claseControl}
            aria-invalid={errors.apellido ? 'true' : 'false'}
            {...register('apellido')}
          />
        </Campo>

        <Campo etiqueta="Tipo de documento" htmlFor="tipoDocumento" error={errors.tipoDocumento}>
          <select id="tipoDocumento" className={claseControl} {...register('tipoDocumento')}>
            <option value="DNI">DNI</option>
            <option value="pasaporte">Pasaporte</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>

        <Campo etiqueta="Número de documento" htmlFor="nroDocumento" error={errors.nroDocumento}>
          <input
            id="nroDocumento"
            className={claseControl}
            aria-invalid={errors.nroDocumento ? 'true' : 'false'}
            {...register('nroDocumento')}
          />
        </Campo>

        <Campo
          etiqueta="Teléfono principal"
          htmlFor="telefonoPrincipal"
          error={errors.telefonoPrincipal}
          ayuda="Sin teléfono principal la ficha queda incompleta."
        >
          <input
            id="telefonoPrincipal"
            className={claseControl}
            {...register('telefonoPrincipal')}
          />
        </Campo>

        <Campo
          etiqueta="Teléfono alternativo"
          htmlFor="telefonoAlternativo"
          error={errors.telefonoAlternativo}
        >
          <input
            id="telefonoAlternativo"
            className={claseControl}
            {...register('telefonoAlternativo')}
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

        <Campo etiqueta="Calle y número" htmlFor="calleNumero" error={errors.calleNumero}>
          <input id="calleNumero" className={claseControl} {...register('calleNumero')} />
        </Campo>

        <Campo
          etiqueta="Localidad o barrio"
          htmlFor="localidadBarrio"
          error={errors.localidadBarrio}
        >
          <input id="localidadBarrio" className={claseControl} {...register('localidadBarrio')} />
        </Campo>

        <Campo etiqueta="Provincia" htmlFor="provincia" error={errors.provincia}>
          <input id="provincia" className={claseControl} {...register('provincia')} />
        </Campo>

        <Campo etiqueta="País" htmlFor="pais" error={errors.pais}>
          <input id="pais" className={claseControl} {...register('pais')} />
        </Campo>

        <Campo
          etiqueta="Fecha de consentimiento"
          htmlFor="fechaConsentimiento"
          error={errors.fechaConsentimiento}
          ayuda="Se completa cuando el cliente acepta ser contactado."
        >
          <input
            id="fechaConsentimiento"
            type="date"
            className={claseControl}
            {...register('fechaConsentimiento')}
          />
        </Campo>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('telefonoEsWhatsapp')} />
          El teléfono principal tiene WhatsApp
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('aceptaCorreo')} />
          Acepta contacto por correo
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4" {...register('aceptaWhatsapp')} />
          Acepta contacto por WhatsApp
        </label>
      </div>

      <Campo etiqueta="Observaciones" htmlFor="observaciones" error={errors.observaciones}>
        <textarea
          id="observaciones"
          rows={3}
          className={claseControl}
          {...register('observaciones')}
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
          {guardar.isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
