import { z } from 'zod';

export const esquemaListadoAuditoria = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  entidad: z.string().trim().max(60).optional(),
  accion: z.enum(['crear', 'editar', 'anular', 'unir', 'ver_sensible']).optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd')
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato aaaa-mm-dd')
    .optional(),
});
