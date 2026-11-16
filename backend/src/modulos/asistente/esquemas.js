import { z } from 'zod';

// El asistente solo recibe una pregunta en texto. El parser local decide qué
// buscar y el backend responde con datos exactos de la base.
export const esquemaConsultaAsistente = z.object({
  mensaje: z
    .string()
    .trim()
    .min(2, 'Escribí una consulta')
    .max(300, 'La consulta es demasiado larga'),
});
