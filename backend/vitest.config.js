import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Los archivos de prueba no se mezclan con los adjuntos reales.
      ADJUNTOS_DIR: path.resolve('tests/tmp-adjuntos'),
    },
    globalSetup: ['./tests/config/globalSetup.js'],
    // Los tests comparten la base de test y la truncan entre archivos, así que
    // no pueden correr en paralelo.
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
