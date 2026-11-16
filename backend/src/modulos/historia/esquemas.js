import { z } from 'zod';

// La entrega de la historia clínica al titular exige confirmar que se verificó
// su documento. La acción queda auditada como exportar.
export const esquemaExportarHistoria = z.object({
  entregadoA: z
    .string()
    .trim()
    .min(3, 'Indicá a quién se entrega la historia clínica')
    .max(160, 'El destinatario es demasiado largo'),
  documentoVerificado: z.literal(true, {
    message: 'Tenés que confirmar que verificaste el documento del titular',
  }),
});
