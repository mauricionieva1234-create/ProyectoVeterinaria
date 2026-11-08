import bcrypt from 'bcryptjs';

// Costo 12: lento a propósito para dificultar ataques de fuerza bruta.
const COSTO = 12;

export function hashearPassword(password) {
  return bcrypt.hash(password, COSTO);
}

export function verificarPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
