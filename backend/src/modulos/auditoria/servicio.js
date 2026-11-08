import { armarPaginacion } from '../../utils/paginacion.js';
import * as repositorio from './repositorio.js';

function aRegistroPublico(fila) {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    usuarioNombre: fila.usuario_nombre,
    entidad: fila.entidad,
    entidadId: fila.entidad_id,
    accion: fila.accion,
    antes: fila.antes,
    despues: fila.despues,
    fecha: fila.fecha,
  };
}

export async function listarAuditoria(filtros) {
  const { filas, total } = await repositorio.listarAuditoria(filtros);

  return {
    datos: filas.map(aRegistroPublico),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}
