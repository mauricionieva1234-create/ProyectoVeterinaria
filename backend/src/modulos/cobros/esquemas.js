import { z } from 'zod';

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).nullable().optional();

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd');

const motivo = z
  .string()
  .trim()
  .min(3, 'El motivo debe tener al menos 3 caracteres')
  .max(2000, 'El motivo es demasiado largo');

const total = z.coerce
  .number()
  .finite('El total no es válido')
  .min(0, 'El total no puede ser negativo')
  .max(999999999.99, 'El total es demasiado grande');

const monto = z.coerce
  .number()
  .finite('El monto no es válido')
  .positive('El monto tiene que ser mayor que cero')
  .max(999999999.99, 'El monto es demasiado grande');

export const MEDIOS_PAGO = ['efectivo', 'debito', 'credito', 'transferencia'];

export const ESTADOS_COBRO = ['pendiente', 'parcial', 'pagado'];

export const esquemaListadoCobros = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(ESTADOS_COBRO, { message: 'El estado no es válido' }).optional(),
  pacienteId: z.coerce.number().int().positive().optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export const esquemaListadoDeudas = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaResumenCaja = z.object({
  fecha: fecha.optional(),
});

export const esquemaCrearCobro = z
  .object({
    visitaId: z.coerce.number().int().positive(),
    total,
    observaciones: textoOpcional(2000, 'Las observaciones son demasiado largas'),
  })
  .refine(
    (datos) =>
      datos.total > 0 ||
      (typeof datos.observaciones === 'string' && datos.observaciones.trim().length >= 3),
    {
      path: ['observaciones'],
      message: 'Indicá una observación para un cobro sin cargo',
    },
  );

export const esquemaActualizarCobro = z.object({
  total,
  observaciones: textoOpcional(2000, 'Las observaciones son demasiado largas'),
  motivoCambio: motivo,
});

export const esquemaCrearPago = z.object({
  medio: z.enum(MEDIOS_PAGO, { message: 'El medio de pago no es válido' }),
  monto,
});

export const esquemaAnular = z.object({
  motivo,
});
