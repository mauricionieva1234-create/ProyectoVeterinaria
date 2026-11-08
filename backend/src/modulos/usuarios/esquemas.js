import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresá un email válido')
  .max(255, 'El email es demasiado largo');

const nombreCompleto = z
  .string()
  .trim()
  .min(2, 'El nombre completo debe tener al menos 2 caracteres')
  .max(120, 'El nombre completo es demasiado largo');

const rol = z.enum(['admin', 'veterinario', 'recepcion'], {
  message: 'El rol no es válido',
});

const matricula = z
  .string()
  .trim()
  .max(50, 'La matrícula es demasiado larga')
  .optional()
  .nullable()
  .transform((valor) => (valor ? valor : null));

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres');

const base = {
  nombreCompleto,
  email,
  rol,
  matricula,
  activo: z.boolean().default(true),
};

export const esquemaCrearUsuario = z
  .object({ ...base, password })
  .refine((datos) => datos.rol === 'veterinario' || !datos.matricula, {
    path: ['matricula'],
    message: 'La matrícula solo corresponde a veterinarios',
  });

export const esquemaEditarUsuario = z
  .object({ ...base, password: password.optional() })
  .refine((datos) => datos.rol === 'veterinario' || !datos.matricula, {
    path: ['matricula'],
    message: 'La matrícula solo corresponde a veterinarios',
  });

export const esquemaCambiarEstado = z.object({
  activo: z.boolean(),
});

export const esquemaListadoUsuarios = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  buscar: z.string().trim().max(120).optional(),
  rol: rol.optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === 'true')),
});
