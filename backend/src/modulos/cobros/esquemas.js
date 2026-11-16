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

const itemCobro = z.object({
  precioId: z
    .preprocess(
      (valor) => (valor === '' || valor == null ? null : Number(valor)),
      z.number().int().positive().nullable(),
    )
    .optional(),
  nombre: z
    .string()
    .trim()
    .min(2, 'El concepto debe tener al menos 2 caracteres')
    .max(200, 'El concepto es demasiado largo'),
  cantidad: z.coerce
    .number()
    .int('La cantidad tiene que ser un número entero')
    .min(1, 'La cantidad tiene que ser mayor que cero')
    .max(9999, 'La cantidad es demasiado grande'),
  importeUnitario: z.coerce
    .number()
    .finite('El importe no es válido')
    .min(0, 'El importe no puede ser negativo')
    .max(999999999.99, 'El importe es demasiado grande'),
});

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
    total: total.optional(),
    items: z
      .array(itemCobro)
      .min(1, 'Agregá al menos un ítem o usá el total manual')
      .max(50, 'El cobro tiene demasiados ítems')
      .optional(),
    observaciones: textoOpcional(2000, 'Las observaciones son demasiado largas'),
  })
  .refine((datos) => datos.total !== undefined || datos.items !== undefined, {
    path: ['total'],
    message: 'Indicá el total o los ítems del cobro',
  });

export const esquemaActualizarCobro = z
  .object({
    total: total.optional(),
    items: z
      .array(itemCobro)
      .min(1, 'Agregá al menos un ítem o usá el total manual')
      .max(50, 'El cobro tiene demasiados ítems')
      .optional(),
    observaciones: textoOpcional(2000, 'Las observaciones son demasiado largas'),
    motivoCambio: motivo,
  })
  .refine((datos) => datos.total !== undefined || datos.items !== undefined, {
    path: ['total'],
    message: 'Indicá el total o los ítems del cobro',
  });

export const esquemaCrearPago = z.object({
  medio: z.enum(MEDIOS_PAGO, { message: 'El medio de pago no es válido' }),
  monto,
});

export const esquemaAnular = z.object({
  motivo,
});
