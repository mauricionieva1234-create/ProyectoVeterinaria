import { conTransaccion } from '../../utils/transaccion.js';
import { errorConflicto, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import * as repositorio from './repositorio.js';

function aEspeciePublica(fila) {
  return { id: fila.id, nombre: fila.nombre };
}

function aRazaPublica(fila) {
  return { id: fila.id, especieId: fila.especie_id, nombre: fila.nombre };
}

export async function listarEspecies(filtros) {
  const filas = await repositorio.listarEspecies(filtros);
  return { datos: filas.map(aEspeciePublica) };
}

export async function listarRazas(filtros) {
  if (filtros.especieId) {
    const especie = await repositorio.buscarEspeciePorId(filtros.especieId);

    if (!especie) {
      throw errorNoEncontrado('No existe la especie solicitada');
    }
  }

  const filas = await repositorio.listarRazas(filtros);
  return { datos: filas.map(aRazaPublica) };
}

export async function crearEspecie(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    if (await repositorio.existeEspecieConNombre(datos.nombre, null, cliente)) {
      const sugerencias = await repositorio.especiesSimilares(datos.nombre, cliente);
      throw errorConflicto('Ya existe una especie con ese nombre', [
        {
          campo: 'nombre',
          mensaje: 'Elegí otro nombre o usá la especie existente',
          sugerencias,
        },
      ]);
    }

    const fila = await repositorio.crearEspecie(datos.nombre, ejecutor.id, cliente);
    const publica = aEspeciePublica(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'especie',
        entidadId: fila.id,
        accion: 'crear',
        antes: null,
        despues: publica,
      },
      cliente,
    );

    return publica;
  });
}

export async function crearRaza(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const especie = await repositorio.buscarEspeciePorId(datos.especieId, cliente);

    if (!especie) {
      throw errorNoEncontrado('No existe la especie solicitada');
    }

    if (await repositorio.existeRazaConNombre(datos.especieId, datos.nombre, null, cliente)) {
      const sugerencias = await repositorio.razasSimilares(datos.especieId, datos.nombre, cliente);
      throw errorConflicto('Ya existe una raza con ese nombre para la especie', [
        {
          campo: 'nombre',
          mensaje: 'Elegí otro nombre o usá la raza existente',
          sugerencias,
        },
      ]);
    }

    const fila = await repositorio.crearRaza(datos.especieId, datos.nombre, ejecutor.id, cliente);
    const publica = aRazaPublica(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'raza',
        entidadId: fila.id,
        accion: 'crear',
        antes: null,
        despues: publica,
      },
      cliente,
    );

    return publica;
  });
}
