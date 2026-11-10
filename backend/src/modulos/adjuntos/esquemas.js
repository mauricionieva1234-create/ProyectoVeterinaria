import { z } from 'zod';

const idOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === undefined || valor === null) return undefined;
  return Number(valor);
}, z.number().int().positive().optional());

export const esquemaListadoAdjuntos = z
  .object({
    pacienteId: idOpcional,
    visitaId: idOpcional,
    estudioId: idOpcional,
  })
  .refine((datos) => Boolean(datos.pacienteId || datos.visitaId || datos.estudioId), {
    message: 'Indicá un paciente, una visita o un estudio',
  });

export const esquemaSubirAdjunto = z
  .object({
    pacienteId: idOpcional,
    visitaId: idOpcional,
    estudioId: idOpcional,
  })
  .refine((datos) => Boolean(datos.pacienteId || datos.visitaId || datos.estudioId), {
    message: 'Indicá un paciente, una visita o un estudio',
  });

export const esquemaAnular = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres')
    .max(2000, 'El motivo es demasiado largo'),
});
