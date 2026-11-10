import { z } from 'zod';

const servicio = z.enum(['atencion_clinica', 'vacunacion', 'control', 'cirugia', 'otro'], {
  message: 'El servicio no es válido',
});

const comentario = z
  .string()
  .trim()
  .max(2000, 'El comentario es demasiado largo')
  .optional()
  .nullable()
  .transform((valor) => (valor ? valor : null));

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

const nroDocumento = z
  .string()
  .trim()
  .min(3, 'El documento debe tener al menos 3 caracteres')
  .max(30, 'El documento es demasiado largo');

export const esquemaCrearIngreso = z.object({
  pacienteId: z.coerce.number().int().positive(),
  servicio,
  marcarPosibleUrgencia: z.boolean().default(false),
  comentario,
});

export const esquemaDecisionUrgencia = z.object({
  decision: z.enum(['confirmada', 'descartada'], {
    message: 'La decisión de urgencia no es válida',
  }),
});

export const esquemaEstadoIngreso = z.object({
  estado: z.enum(['atendido', 'se_retiro', 'cancelado'], {
    message: 'El estado final no es válido',
  }),
});

export const esquemaListadoSinCerrar = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaAltaRapida = z.object({
  nombre,
  apellido,
  tipoDocumento: z
    .enum(['DNI', 'pasaporte', 'otro'], {
      message: 'El tipo de documento no es válido',
    })
    .default('DNI'),
  nroDocumento,
  servicio: servicio.default('atencion_clinica'),
  urgencia: z.enum(['posible', 'confirmada']).default('posible'),
  comentario,
  confirmarDuplicado: z.boolean().default(false),
});
