// Mapa estático de permisos por rol. El backend es la única autoridad:
// el frontend usa esta misma información solo para mostrar u ocultar opciones.
//
// Los permisos incluyen acciones de las fases siguientes para no rehacer el
// mapa cuando lleguen clientes, pacientes, cola, visitas, etc.

export const TODAS_LAS_ACCIONES = Object.freeze([
  'usuarios.ver',
  'usuarios.crear',
  'usuarios.editar',
  'usuarios.desactivar',
  'auditoria.ver',
  'catalogos.ver',
  'catalogos.crear',
  'configuracion.ver',
  'configuracion.editar',
  'clientes.ver',
  'clientes.crear',
  'clientes.editar',
  'clientes.unir',
  'pacientes.ver',
  'pacientes.crear',
  'pacientes.editar',
  'pacientes.alta_rapida',
  'cola.ver',
  'cola.crear',
  'cola.editar',
  'cola.marcar_urgencia',
  'cola.confirmar_urgencia',
  'visitas.ver',
  'visitas.ver_clinico',
  'visitas.crear',
  'visitas.editar',
  'visitas.anular',
  'registros.ver',
  'registros.crear',
  'registros.editar',
  'registros.anular',
  'controles.ver',
  'controles.crear',
  'controles.editar',
  'avisos.ver',
  'avisos.crear',
  'adjuntos.ver',
  'adjuntos.crear',
  'adjuntos.anular',
]);

const PERMISOS_POR_ROL = {
  // El admin puede todo, incluida la administración del sistema.
  admin: TODAS_LAS_ACCIONES,
  veterinario: [
    'catalogos.ver',
    'configuracion.ver',
    'clientes.ver',
    'clientes.crear',
    'clientes.editar',
    'pacientes.ver',
    'pacientes.crear',
    'pacientes.editar',
    'pacientes.alta_rapida',
    'cola.ver',
    'cola.crear',
    'cola.editar',
    'cola.marcar_urgencia',
    'cola.confirmar_urgencia',
    'visitas.ver',
    'visitas.ver_clinico',
    'visitas.crear',
    'visitas.editar',
    'visitas.anular',
    'registros.ver',
    'registros.crear',
    'registros.editar',
    'registros.anular',
    'controles.ver',
    'controles.crear',
    'controles.editar',
    'avisos.ver',
    'avisos.crear',
    'adjuntos.ver',
    'adjuntos.crear',
    'adjuntos.anular',
  ],
  // Recepción trabaja con datos administrativos y la cola. No accede a lo
  // clínico: nada de anamnesis, medicación, diagnósticos ni edición de visitas.
  recepcion: [
    'catalogos.ver',
    'clientes.ver',
    'clientes.crear',
    'clientes.editar',
    'pacientes.ver',
    'pacientes.crear',
    'pacientes.editar',
    'pacientes.alta_rapida',
    'cola.ver',
    'cola.crear',
    'cola.editar',
    'cola.marcar_urgencia',
    'controles.ver',
    'avisos.ver',
    'avisos.crear',
    'adjuntos.ver',
    'adjuntos.crear',
  ],
};

export function permisosDeRol(rol) {
  return [...(PERMISOS_POR_ROL[rol] ?? [])];
}

export function tienePermiso(rol, accion) {
  return permisosDeRol(rol).includes(accion);
}
