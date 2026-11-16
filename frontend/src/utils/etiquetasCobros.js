// Etiquetas y formato de importes para cobros y caja.

export const ETIQUETAS_MEDIO = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
};

export const ETIQUETAS_ESTADO_COBRO = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
};

export const MEDIOS_PAGO = Object.keys(ETIQUETAS_MEDIO);

export function etiqueta(mapa, valor) {
  return mapa[valor] ?? valor ?? '—';
}

export function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

// Clases estáticas para que Tailwind las compile.
export function claseEstadoCobro(estado) {
  if (estado === 'pagado') return 'bg-emerald-50 text-emerald-700';
  if (estado === 'parcial') return 'bg-amber-50 text-amber-800';
  return 'bg-rose-50 text-rose-700';
}
