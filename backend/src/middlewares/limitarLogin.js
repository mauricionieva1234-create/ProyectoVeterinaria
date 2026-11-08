import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// 5 intentos fallidos por cada combinación IP + email en 15 minutos.
// skipSuccessfulRequests hace que un login correcto no consuma intentos.
export const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '')
      .trim()
      .toLowerCase()}`,
  message: {
    error: {
      codigo: 'DEMASIADOS_INTENTOS',
      mensaje: 'Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos.',
      detalles: [],
    },
  },
});
