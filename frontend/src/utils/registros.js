import { textoONulo } from './formularios.js';

// Traduce los valores del formulario al cuerpo que espera cada endpoint.
// Es una función pura para poder probarla sin montar la interfaz.
export function armarCuerpoRegistro(tipo, datos, { pacienteId, visitaId } = {}) {
  const comunes = {
    pacienteId: Number(pacienteId),
    visitaId: visitaId ? Number(visitaId) : null,
  };

  if (tipo === 'vacuna') {
    return {
      ...comunes,
      vacuna: datos.vacuna.trim(),
      lote: textoONulo(datos.lote),
      fechaAplicacion: datos.fechaAplicacion,
      fechaProximaDosis: textoONulo(datos.fechaProximaDosis),
    };
  }

  if (tipo === 'antiparasitario') {
    return {
      ...comunes,
      producto: datos.producto.trim(),
      tipo: datos.tipoAntiparasitario,
      dosis: textoONulo(datos.dosis),
      fechaAplicacion: datos.fechaAplicacion,
      fechaProxima: textoONulo(datos.fechaProxima),
    };
  }

  if (tipo === 'estudio') {
    return {
      ...comunes,
      tipoEstudio: datos.tipoEstudio.trim(),
      fechaPedido: datos.fechaPedido,
      estado: datos.estado,
      fechaResultado: textoONulo(datos.fechaResultado),
      resultadoResumen: textoONulo(datos.resultadoResumen),
    };
  }

  return {
    ...comunes,
    tipoCirugia: datos.tipoCirugia.trim(),
    fechaProgramada: textoONulo(datos.fechaProgramada),
    estado: datos.estado,
    indicacionesPrevias: textoONulo(datos.indicacionesPrevias),
    notasPostoperatorio: textoONulo(datos.notasPostoperatorio),
  };
}
