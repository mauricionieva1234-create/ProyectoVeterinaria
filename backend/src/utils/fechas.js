import { env } from '../config/env.js';

// Devuelve la fecha de hoy en la zona de la veterinaria como aaaa-mm-dd.
// No se usa current_date de PostgreSQL porque el servidor puede estar en UTC y,
// cerca de la medianoche, cambiaría de día antes que en Tucumán.
export function hoyEnTucuman(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);

  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
