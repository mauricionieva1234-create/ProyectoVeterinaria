const ZONA_HORARIA = 'America/Argentina/Tucuman';

function aFecha(valor) {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(valor) {
  // Las fechas sin hora (aaaa-mm-dd) se muestran tal cual. Convertirlas a Date
  // las interpreta como UTC y en Tucumán retroceden un día.
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    const [anio, mes, dia] = valor.trim().split('-');
    return `${dia}/${mes}/${anio}`;
  }

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

// Edad legible a partir de una fecha aaaa-mm-dd. La fecha de hoy se toma en la
// zona de Tucumán para que el cambio de zona horaria no corra un día.
export function calcularEdad(fecha) {
  if (!fecha) return '';

  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  if (!anio || !mes || !dia) return '';

  // La fecha de hoy se toma en la zona de Tucumán, igual que el resto de la
  // interfaz, para no adelantar un día cerca de la medianoche.
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const parte = (tipo) => Number(partes.find((valor) => valor.type === tipo)?.value);
  const anioHoy = parte('year');
  const mesHoy = parte('month');
  const diaHoy = parte('day');

  let meses = (anioHoy - anio) * 12 + (mesHoy - mes);

  if (diaHoy < dia) {
    meses -= 1;
  }

  if (meses < 0) return '';

  const anios = Math.floor(meses / 12);

  if (anios >= 1) {
    return `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }

  return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}
