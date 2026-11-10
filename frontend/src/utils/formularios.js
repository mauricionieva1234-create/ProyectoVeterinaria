const ZONA_HORARIA = 'America/Argentina/Tucuman';

// Fecha de negocio en formato aaaa-mm-dd, igual que la usa el backend.
export function hoyEnTucuman() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(new Date());
}

export function textoONulo(valor) {
  const limpio = String(valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

export function numeroONulo(valor) {
  const limpio = String(valor ?? '').trim();
  return limpio === '' ? null : Number(limpio);
}

export function enteroONulo(valor) {
  const limpio = String(valor ?? '').trim();
  return limpio === '' ? null : Number.parseInt(limpio, 10);
}
