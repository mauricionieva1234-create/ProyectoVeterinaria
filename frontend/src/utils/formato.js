const ZONA_HORARIA = 'America/Argentina/Tucuman';

function aFecha(valor) {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return '';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

export function formatearHora(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return '';

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

// En los listados nunca se muestra el documento completo.
export function enmascararDocumento(documento) {
  const limpio = String(documento ?? '').replace(/\s/g, '');
  if (!limpio) return '';

  return `***.***.${limpio.slice(-3)}`;
}
