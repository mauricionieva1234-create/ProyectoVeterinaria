// Etiquetas en español para los valores que devuelve el backend.
export const ETIQUETAS_SERVICIO = {
  atencion_clinica: 'Atención clínica',
  vacunacion: 'Vacunación',
  control: 'Control',
  cirugia: 'Cirugía',
  otro: 'Otro',
};

export const ETIQUETAS_URGENCIA = {
  sin_marca: 'Sin marca',
  posible: 'Posible',
  confirmada: 'Confirmada',
  descartada: 'Descartada',
};

export const ETIQUETAS_ESTADO = {
  esperando: 'Esperando',
  en_consulta: 'En consulta',
  esperando_cobro: 'Esperando cobro',
  atendido: 'Atendido',
  se_retiro: 'Se retiró',
  cancelado: 'Cancelado',
  sin_cerrar: 'Sin cerrar',
};

export const ETIQUETAS_PRIORIDAD = {
  normal: 'Normal',
  urgente: 'Urgente',
};

export function etiqueta(mapa, valor) {
  return mapa[valor] ?? valor ?? '—';
}
