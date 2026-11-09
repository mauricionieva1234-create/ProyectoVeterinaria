import { z } from 'zod';

const nombre = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'El nombre es demasiado largo');

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato aaaa-mm-dd')
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((valor) => (valor ? valor : null));

const texto = (max, mensaje) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .nullable()
    .transform((valor) => (valor ? valor : null));

const base = {
  clienteId: z.coerce.number().int().positive(),
  nombre,
  especieId: z.coerce.number().int().positive(),
  razaId: z.coerce.number().int().positive().optional().nullable(),
  sexo: z.enum(['macho', 'hembra', 'desconocido'], { message: 'El sexo no es válido' }),
  castrado: z.boolean().default(false),
  fechaCastracion: fecha,
  esReproductor: z.boolean().default(false),
  fechaNacimiento: fecha,
  nacimientoAproximado: z.boolean().default(false),
  fechaDeceso: fecha,
  origen: z
    .enum(['criado', 'adoptado', 'rescatado', 'otro'], { message: 'El origen no es válido' })
    .optional()
    .nullable(),
  chipCodigo: texto(50, 'El código de chip es demasiado largo'),
  color: texto(60, 'El color es demasiado largo'),
  comentario: texto(2000, 'El comentario es demasiado largo'),
  provisorio: z.boolean().default(false),
};

function validarFechas(datos, contexto) {
  if (datos.fechaDeceso && datos.fechaNacimiento && datos.fechaDeceso < datos.fechaNacimiento) {
    contexto.addIssue({
      code: 'custom',
      path: ['fechaDeceso'],
      message: 'La fecha de deceso no puede ser anterior al nacimiento',
    });
  }

  if (
    datos.fechaCastracion &&
    datos.fechaNacimiento &&
    datos.fechaCastracion < datos.fechaNacimiento
  ) {
    contexto.addIssue({
      code: 'custom',
      path: ['fechaCastracion'],
      message: 'La fecha de castración no puede ser anterior al nacimiento',
    });
  }
}

export const esquemaCrearPaciente = z.object(base).superRefine(validarFechas);

export const esquemaEditarPaciente = z.object(base).superRefine(validarFechas);

export const esquemaListadoPacientes = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  clienteId: z.coerce.number().int().positive().optional(),
  buscar: z.string().trim().max(120).optional(),
});
