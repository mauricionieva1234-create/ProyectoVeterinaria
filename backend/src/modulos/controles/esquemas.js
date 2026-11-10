import { z } from 'zod';

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).nullable().optional();

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd');

const idOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined) return undefined;
  if (valor === null) return null;
  return Number(valor);
}, z.number().int().positive().nullable().optional());

export const FRANJAS = ['manana', 'tarde', 'cualquiera'];

export const ESTADOS_CONTROL = ['pendiente', 'realizado', 'ausente', 'cancelado', 'reprogramado'];

export const esquemaListadoControles = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(ESTADOS_CONTROL).optional(),
  pacienteId: z.coerce.number().int().positive().optional(),
  franja: z.enum(FRANJAS).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const esquemaCrearControl = z.object({
  visitaOrigenId: z.coerce.number().int().positive(),
  fechaControl: fecha,
  franja: z.enum(FRANJAS, { message: 'La franja no es válida' }).default('cualquiera'),
  motivo: textoOpcional(2000, 'El motivo es demasiado largo'),
});

export const esquemaReprogramarControl = z.object({
  fechaControl: fecha,
  franja: z.enum(FRANJAS, { message: 'La franja no es válida' }).default('cualquiera'),
  motivo: textoOpcional(2000, 'El motivo es demasiado largo'),
});

export const esquemaEstadoControl = z.object({
  estado: z.enum(['realizado', 'ausente', 'cancelado'], {
    message: 'El estado no es válido',
  }),
  visitaRealizadaId: idOpcional,
});

export const esquemaAnular = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres')
    .max(2000, 'El motivo es demasiado largo'),
});

export const esquemaCrearAviso = z.object({
  canal: z.enum(['llamada', 'whatsapp_manual'], { message: 'El canal no es válido' }),
  resultado: z.enum(['avisado', 'no_contesta', 'sin_telefono', 'pidio_reprogramar'], {
    message: 'El resultado no es válido',
  }),
  nota: textoOpcional(2000, 'La nota es demasiado larga'),
});
