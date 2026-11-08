import { z } from 'zod';

export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Ingresá un email válido')
    .max(255, 'El email es demasiado largo'),
  password: z.string().min(1, 'Ingresá tu contraseña').max(200, 'La contraseña es demasiado larga'),
});
