import { hashearPassword } from '../../utils/password.js';
import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import { errorConflicto, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import * as repositorio from './repositorio.js';

export function aUsuarioPublico(fila) {
  return {
    id: fila.id,
    nombreCompleto: fila.nombre_completo,
    email: fila.email,
    rol: fila.rol,
    matricula: fila.matricula,
    activo: fila.activo,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function mismosIds(a, b) {
  return String(a) === String(b);
}

export async function listarUsuarios(filtros) {
  const { filas, total } = await repositorio.listarUsuarios(filtros);

  return {
    datos: filas.map(aUsuarioPublico),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function obtenerUsuario(id) {
  const fila = await repositorio.buscarUsuarioPorId(id);

  if (!fila) {
    throw errorNoEncontrado('No existe el usuario solicitado');
  }

  return aUsuarioPublico(fila);
}

export async function crearUsuario(datos, ejecutor) {
  // El hash es lento a propósito; se calcula fuera de la transacción para no
  // retener una conexión de la base mientras bcrypt trabaja.
  const passwordHash = await hashearPassword(datos.password);

  return conTransaccion(async (cliente) => {
    if (await repositorio.existeEmail(datos.email, null, cliente)) {
      throw errorConflicto('Ya existe un usuario con ese email');
    }

    const fila = await repositorio.crearUsuario(
      { ...datos, passwordHash, matricula: datos.rol === 'veterinario' ? datos.matricula : null },
      ejecutor.id,
      cliente,
    );

    const publico = aUsuarioPublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'usuario',
        entidadId: fila.id,
        accion: 'crear',
        antes: null,
        despues: publico,
      },
      cliente,
    );

    return publico;
  });
}

export async function actualizarUsuario(id, datos, ejecutor) {
  const passwordHash = datos.password ? await hashearPassword(datos.password) : null;

  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarUsuarioPorId(id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el usuario solicitado');
    }

    if (await repositorio.existeEmail(datos.email, id, cliente)) {
      throw errorConflicto('Ya existe un usuario con ese email');
    }

    if (mismosIds(actual.id, ejecutor.id) && datos.activo === false) {
      throw errorConflicto('No podés desactivar tu propio usuario');
    }

    // Si se desactiva al último admin, o se le cambia el rol, el sistema
    // quedaría sin administración.
    const dejaDeSerAdminActivo =
      actual.rol === 'admin' && actual.activo && (datos.activo === false || datos.rol !== 'admin');

    if (dejaDeSerAdminActivo) {
      const otrosAdmins = await repositorio.contarAdminsActivos(id, cliente);

      if (otrosAdmins === 0) {
        throw errorConflicto('Tiene que quedar al menos un administrador activo');
      }
    }

    const fila = await repositorio.actualizarUsuario(
      id,
      {
        ...datos,
        passwordHash,
        matricula: datos.rol === 'veterinario' ? datos.matricula : null,
      },
      ejecutor.id,
      cliente,
    );

    const despues = aUsuarioPublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'usuario',
        entidadId: fila.id,
        accion: 'editar',
        antes: aUsuarioPublico(actual),
        despues,
      },
      cliente,
    );

    return despues;
  });
}

export async function cambiarEstadoUsuario(id, activo, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarUsuarioPorId(id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el usuario solicitado');
    }

    if (mismosIds(actual.id, ejecutor.id) && activo === false) {
      throw errorConflicto('No podés desactivar tu propio usuario');
    }

    if (actual.rol === 'admin' && actual.activo && activo === false) {
      const otrosAdmins = await repositorio.contarAdminsActivos(id, cliente);

      if (otrosAdmins === 0) {
        throw errorConflicto('Tiene que quedar al menos un administrador activo');
      }
    }

    if (actual.activo === activo) {
      return aUsuarioPublico(actual);
    }

    const fila = await repositorio.cambiarEstadoUsuario(id, activo, ejecutor.id, cliente);
    const despues = aUsuarioPublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'usuario',
        entidadId: fila.id,
        accion: 'editar',
        antes: aUsuarioPublico(actual),
        despues,
      },
      cliente,
    );

    return despues;
  });
}
