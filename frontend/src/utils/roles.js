export const ETIQUETAS_ROL = {
  admin: 'Administrador',
  veterinario: 'Veterinario',
  recepcion: 'Recepción',
};

export const ETIQUETAS_ACCION = {
  crear: 'Crear',
  editar: 'Editar',
  anular: 'Anular',
  unir: 'Unir',
  ver_sensible: 'Ver dato sensible',
};

export function etiquetaRol(rol) {
  return ETIQUETAS_ROL[rol] ?? rol;
}

export function etiquetaAccion(accion) {
  return ETIQUETAS_ACCION[accion] ?? accion;
}
