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

// Edad legible a partir de una fecha aaaa-mm-dd. Se calcula en UTC para que el
// cambio de zona horaria no corra un día.
export function calcularEdad(fecha) {
  if (!fecha) return '';

  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  if (!anio || !mes || !dia) return '';

  const hoy = new Date();
  let meses = (hoy.getUTCFullYear() - anio) * 12 + (hoy.getUTCMonth() + 1 - mes);

  if (hoy.getUTCDate() < dia) {
    meses -= 1;
  }

  if (meses < 0) return '';

  const anios = Math.floor(meses / 12);

  if (anios >= 1) {
    return `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }

  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}
