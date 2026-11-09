// Helpers de texto compartidos por clientes, pacientes y catálogos.

// El documento se guarda sin puntos, espacios ni guiones, en mayúsculas.
// Así "90.000.001" y "90000001" se consideran el mismo documento.
export function normalizarDocumento(valor) {
  return String(valor ?? '')
    .trim()
    .replace(/[.\s-]/g, '')
    .toUpperCase();
}

// El teléfono se guarda con dígitos y, si empieza con +, conserva el signo.
export function normalizarTelefono(valor) {
  const limpio = String(valor ?? '').trim();
  if (!limpio) return null;

  const tieneMas = limpio.startsWith('+');
  const digitos = limpio.replace(/\D/g, '');

  if (!digitos) return null;

  return tieneMas ? `+${digitos}` : digitos;
}

// En los listados el documento nunca se muestra completo.
export function enmascararDocumento(valor) {
  const limpio = String(valor ?? '').trim();
  if (!limpio) return '';

  return `***.***.${limpio.slice(-3)}`;
}

// Texto opcional: recorta y convierte vacío en null.
export function textoOpcional(valor) {
  if (valor === undefined || valor === null) return null;

  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio;
}
