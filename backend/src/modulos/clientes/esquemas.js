import { z } from 'zod';

const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(120, 'El nombre es demasiado largo');

const apellido = z
  .string()
  .trim()
  .min(2, 'El apellido debe tener al menos 2 caracteres')
  .max(120, 'El apellido es demasiado largo');

const tipoDocumento = z.enum(['DNI', 'pasaporte', 'otro'], {
  message: 'El tipo de documento no es válido',
});

const nroDocumento = z
  .string()
  .trim()
  .min(3, 'El documento debe tener al menos 3 caracteres')
  .max(30, 'El documento es demasiado largo');

const telefono = z
  .string()
  .trim()
  .max(30, 'El teléfono es demasiado largo')
  .optional()
  .nullable()
  .transform((valor) => (valor ? valor : null));

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresá un email válido')
  .max(255, 'El email es demasiado largo')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((valor) => (valor ? valor : null));

const texto = (max, mensaje) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .nullable()
    .transform((valor) => (valor ? valor : null));

// Fecha ISO sin hora. El string vacío del formulario se convierte en null.
const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato aaaa-mm-dd')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((valor) => (valor ? valor : null));

const base = {
  nombre,
  apellido,
  tipoDocumento,
  nroDocumento,
  telefonoPrincipal: telefono,
  telefonoEsWhatsapp: z.boolean().default(false),
  telefonoAlternativo: telefono,
  email,
  calleNumero: texto(150, 'La dirección es demasiado larga'),
  localidadBarrio: texto(120, 'La localidad es demasiado larga'),
  provincia: texto(120, 'La provincia es demasiado larga'),
  pais: z.string().trim().max(80).default('Argentina'),
  aceptaCorreo: z.boolean().default(false),
  aceptaWhatsapp: z.boolean().default(false),
  fechaConsentimiento: fecha,
  observaciones: texto(2000, 'Las observaciones son demasiado largas'),
};

export const esquemaCrearCliente = z.object({
  ...base,
  // El alta se repite con este flag cuando el usuario ya vio el aviso de
  // documento duplicado y decidió continuar.
  confirmarDuplicado: z.boolean().default(false),
});

export const esquemaEditarCliente = z.object(base);

export const esquemaListadoClientes = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  buscar: z.string().trim().max(120).optional(),
  soloIncompletas: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

export const esquemaBusquedaPrevia = z.object({
  documento: z.string().trim().max(30).optional(),
  telefono: z.string().trim().max(30).optional(),
});

export const esquemaUnirClientes = z.object({
  clienteConservadoId: z.coerce.number().int().positive(),
});
