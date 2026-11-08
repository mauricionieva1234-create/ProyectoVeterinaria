import 'dotenv/config';
import { z } from 'zod';

// En la fase 0 la base de datos y el secreto JWT todavía no son obligatorios.
// En la fase 1 se vuelven requeridos, cuando existan las migraciones y el login.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGEN: z.string().min(1).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  ADMIN_NOMBRE: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  SEED_DEMO_PASSWORD: z.string().min(1).optional(),
  ZONA_HORARIA: z.string().min(1).default('America/Argentina/Tucuman'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  const detalles = resultado.error.issues
    .map((problema) => `${problema.path.join('.') || 'entorno'}: ${problema.message}`)
    .join('\n');
  console.error(`Configuración inválida:\n${detalles}`);
  process.exit(1);
}

export const env = resultado.data;
