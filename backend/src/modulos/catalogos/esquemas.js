import { z } from 'zod';

const nombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(80, 'El nombre es demasiado largo');

const buscar = z.string().trim().max(80).optional();

export const esquemaListadoEspecies = z.object({ buscar });

export const esquemaListadoRazas = z.object({
  especieId: z.coerce.number().int().positive().optional(),
  buscar,
});

export const esquemaCrearEspecie = z.object({ nombre });

export const esquemaCrearRaza = z.object({
  especieId: z.coerce.number().int().positive(),
  nombre,
});
