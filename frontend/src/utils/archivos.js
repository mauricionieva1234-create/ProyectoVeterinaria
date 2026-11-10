export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Devuelve el primer problema del archivo o null si se puede subir.
export function validarArchivo(archivo) {
  if (!archivo) return 'Elegí un archivo';

  if (archivo.size > TAMANO_MAXIMO) {
    return 'El archivo supera el límite de 10 MB';
  }

  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return 'Solo se permiten PDF, JPG, PNG o WebP';
  }

  return null;
}
