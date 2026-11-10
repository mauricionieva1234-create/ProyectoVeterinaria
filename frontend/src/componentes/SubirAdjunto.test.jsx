import { describe, expect, it } from 'vitest';
import { TAMANO_MAXIMO, validarArchivo } from '../utils/archivos.js';

describe('validarArchivo', () => {
  it('acepta un PDF dentro del límite', () => {
    expect(validarArchivo({ size: 1024, type: 'application/pdf' })).toBeNull();
  });

  it('acepta las imágenes permitidas', () => {
    expect(validarArchivo({ size: 2048, type: 'image/jpeg' })).toBeNull();
    expect(validarArchivo({ size: 2048, type: 'image/png' })).toBeNull();
    expect(validarArchivo({ size: 2048, type: 'image/webp' })).toBeNull();
  });

  it('rechaza un tipo no permitido', () => {
    expect(validarArchivo({ size: 1024, type: 'image/svg+xml' })).toBe(
      'Solo se permiten PDF, JPG, PNG o WebP',
    );
  });

  it('rechaza archivos de más de 10 MB', () => {
    expect(validarArchivo({ size: TAMANO_MAXIMO + 1, type: 'application/pdf' })).toBe(
      'El archivo supera el límite de 10 MB',
    );
  });

  it('pide un archivo cuando no se eligió ninguno', () => {
    expect(validarArchivo(null)).toBe('Elegí un archivo');
  });
});
