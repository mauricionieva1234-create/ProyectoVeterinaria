// Etiquetas en español para los valores clínicos que devuelve el backend.
export const ETIQUETAS_ESTADO_VISITA = {
  borrador: 'Borrador',
  cerrada: 'Cerrada',
  corregida: 'Corregida',
};

export const ETIQUETAS_TIPO_REGISTRO = {
  vacuna: 'Vacuna',
  antiparasitario: 'Antiparasitario',
  estudio: 'Estudio',
  cirugia: 'Cirugía',
};

export const ETIQUETAS_ESTADO_REGISTRO = {
  pedido: 'Pedido',
  realizado: 'Realizado',
  resultado_cargado: 'Resultado cargado',
  programada: 'Programada',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

export const ETIQUETAS_ESTADO_CONTROL = {
  pendiente: 'Pendiente',
  realizado: 'Realizado',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
};

export const ETIQUETAS_FRANJA = {
  manana: 'Mañana',
  tarde: 'Tarde',
  cualquiera: 'Cualquier horario',
};

export const ETIQUETAS_CANAL_AVISO = {
  llamada: 'Llamada',
  whatsapp_manual: 'WhatsApp manual',
};

export const ETIQUETAS_RESULTADO_AVISO = {
  avisado: 'Avisado',
  no_contesta: 'No contesta',
  sin_telefono: 'Sin teléfono',
  pidio_reprogramar: 'Pidió reprogramar',
};

export const ETIQUETAS_TIPO_ANTIPARASITARIO = {
  interno: 'Interno',
  externo: 'Externo',
};

export function etiqueta(mapa, valor) {
  return mapa[valor] ?? valor ?? '—';
}
