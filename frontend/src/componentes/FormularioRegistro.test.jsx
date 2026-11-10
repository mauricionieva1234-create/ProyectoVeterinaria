import { describe, expect, it } from 'vitest';
import { armarCuerpoRegistro } from '../utils/registros.js';

describe('armarCuerpoRegistro', () => {
  it('arma una vacuna con los campos comunes', () => {
    const cuerpo = armarCuerpoRegistro(
      'vacuna',
      {
        vacuna: ' Antirrábica ',
        lote: ' L-01 ',
        fechaAplicacion: '2026-11-10',
        fechaProximaDosis: '',
      },
      { pacienteId: '10', visitaId: '3' },
    );

    expect(cuerpo).toEqual({
      pacienteId: 10,
      visitaId: 3,
      vacuna: 'Antirrábica',
      lote: 'L-01',
      fechaAplicacion: '2026-11-10',
      fechaProximaDosis: null,
    });
  });

  it('arma un antiparasitario con el tipo correcto', () => {
    const cuerpo = armarCuerpoRegistro(
      'antiparasitario',
      {
        producto: 'Antipulgas Demo',
        tipoAntiparasitario: 'externo',
        dosis: '1 comprimido',
        fechaAplicacion: '2026-11-10',
        fechaProxima: '2026-12-10',
      },
      { pacienteId: 10 },
    );

    expect(cuerpo).toMatchObject({
      pacienteId: 10,
      visitaId: null,
      producto: 'Antipulgas Demo',
      tipo: 'externo',
      dosis: '1 comprimido',
      fechaProxima: '2026-12-10',
    });
  });

  it('arma un estudio con estado y resultado opcional', () => {
    const cuerpo = armarCuerpoRegistro(
      'estudio',
      {
        tipoEstudio: 'Radiografía',
        fechaPedido: '2026-11-10',
        estado: 'resultado_cargado',
        fechaResultado: '2026-11-12',
        resultadoResumen: 'Sin hallazgos',
      },
      { pacienteId: 10 },
    );

    expect(cuerpo).toMatchObject({
      tipoEstudio: 'Radiografía',
      estado: 'resultado_cargado',
      fechaResultado: '2026-11-12',
      resultadoResumen: 'Sin hallazgos',
    });
  });

  it('arma una cirugía con fecha programada y estado', () => {
    const cuerpo = armarCuerpoRegistro(
      'cirugia',
      {
        tipoCirugia: 'Castración',
        fechaProgramada: '2026-11-20',
        estado: 'programada',
        indicacionesPrevias: 'Ayuno de 12 horas',
        notasPostoperatorio: '',
      },
      { pacienteId: 10 },
    );

    expect(cuerpo).toMatchObject({
      tipoCirugia: 'Castración',
      fechaProgramada: '2026-11-20',
      estado: 'programada',
      indicacionesPrevias: 'Ayuno de 12 horas',
      notasPostoperatorio: null,
    });
  });
});
