import path from 'node:path';
import { access, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const DIRECTORIO_PREDETERMINADO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads/adjuntos',
);

// La extensión sale siempre del MIME validado, nunca del nombre que envía el
// cliente. También sirve como lista blanca de tipos permitidos.
export const TIPOS_PERMITIDOS = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

export function directorioAdjuntos() {
  return env.ADJUNTOS_DIR ? path.resolve(env.ADJUNTOS_DIR) : DIRECTORIO_PREDETERMINADO;
}

export async function asegurarDirectorio() {
  await mkdir(directorioAdjuntos(), { recursive: true });
}

export function rutaAbsoluta(rutaRelativa) {
  return path.join(directorioAdjuntos(), path.basename(rutaRelativa));
}

export async function existeArchivo(rutaRelativa) {
  try {
    await access(rutaAbsoluta(rutaRelativa));
    return true;
  } catch {
    return false;
  }
}

export async function eliminarArchivo(rutaRelativa) {
  try {
    await unlink(rutaAbsoluta(rutaRelativa));
  } catch {
    // Si el archivo ya no existe, no hay nada que limpiar.
  }
}

// El nombre de descarga se limpia de separadores y caracteres de control para
// que el navegador no lo interprete como una ruta.
export function nombreDescargaSeguro(nombre) {
  return (
    String(nombre)
      .split('')
      .filter((caracter) => caracter.charCodeAt(0) >= 32)
      .join('')
      .replace(/[\\/"]/g, '_')
      .slice(0, 200) || 'archivo'
  );
}
