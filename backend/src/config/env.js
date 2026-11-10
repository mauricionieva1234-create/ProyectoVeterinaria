import 'dotenv/config';
import { z } from 'zod';

// Configuración central del backend. Si falta algo obligatorio, el proceso
// termina con un mensaje claro en vez de fallar más adelante de forma rara.
const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGEN: z.string().min(1).default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(32),
    ADMIN_NOMBRE: z.string().min(1).optional(),
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    SEED_DEMO_PASSWORD: z.string().min(8).optional(),
    ZONA_HORARIA: z.string().min(1).default('America/Argentina/Tucuman'),
    // Carpeta donde se guardan los adjuntos. Si no se indica, se usa
    // backend/uploads/adjuntos, fuera de la carpeta pública del frontend.
    ADJUNTOS_DIR: z.string().min(1).optional(),
  })
  .superRefine((valor, contexto) => {
    if (valor.NODE_ENV === 'test' && !valor.TEST_DATABASE_URL) {
      contexto.addIssue({
        code: 'custom',
        path: ['TEST_DATABASE_URL'],
        message: 'Es obligatoria cuando NODE_ENV=test',
      });
    }
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
