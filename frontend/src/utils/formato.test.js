import { describe, expect, it } from 'vitest';
import { enmascararDocumento, formatearFecha, formatearHora } from './formato.js';

describe('helpers de formato', () => {
  it('formatea una fecha en es-AR y hora de Tucumán', () => {
    expect(formatearFecha('2026-11-08T15:30:00.000Z')).toBe('08/11/2026');
  });

  it('formatea la hora en formato de 24 horas', () => {
    expect(formatearHora('2026-11-08T15:30:00.000Z')).toBe('12:30');
  });

  it('devuelve una cadena vacía si la fecha no es válida', () => {
    expect(formatearFecha('no-es-una-fecha')).toBe('');
    expect(formatearHora(null)).toBe('');
  });

  it('enmascara el documento dejando solo los últimos tres dígitos', () => {
    expect(enmascararDocumento('30123456')).toBe('***.***.456');
    expect(enmascararDocumento('')).toBe('');
    expect(enmascararDocumento(undefined)).toBe('');
  });
});
