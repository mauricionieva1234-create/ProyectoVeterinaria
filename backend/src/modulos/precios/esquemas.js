import { z } from 'zod';

const textoOpcional = (max, mensaje) => z.string().trim().max(max, mensaje).nullable().optional();

const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(120, 'El nombre es demasiado largo');

const importe = z.coerce
  .number()
  .finite('El importe no es válido')
  .min(0, 'El importe no puede ser negativo')
  .max(999999999.99, 'El importe es demasiado grande');

const motivo = z
  .string()
  .trim()
  .min(3, 'El motivo debe tener al menos 3 caracteres')
  .max(2000, 'El motivo es demasiado largo');

export const esquemaListadoPrecios = z.object({
  buscar: z.string().trim().max(120, 'La búsqueda es demasiado larga').optional(),
  incluirInactivos: z
    .enum(['true', 'false'], { message: 'El filtro de inactivos no es válido' })
    .optional()
    .transform((valor) => valor === 'true'),
});

export const esquemaCrearPrecio = z.object({
  nombre,
  importe,
  observaciones: textoOpcional(1000, 'Las observaciones son demasiado largas'),
});

// Toda edición exige motivo. Si cambia el nombre o el importe, además deja una
// fila en el historial.
export const esquemaActualizarPrecio = z
  .object({
    nombre: nombre.optional(),
    importe: importe.optional(),
    activo: z.boolean().optional(),
    observaciones: textoOpcional(1000, 'Las observaciones son demasiado largas'),
    motivo,
  })
  .refine(
    (datos) =>
      datos.nombre !== undefined ||
      datos.importe !== undefined ||
      datos.activo !== undefined ||
      datos.observaciones !== undefined,
    { message: 'No hay cambios para guardar' },
  );
