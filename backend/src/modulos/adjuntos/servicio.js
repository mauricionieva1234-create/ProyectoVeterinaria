import { conTransaccion } from '../../utils/transaccion.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { existeArchivo, nombreDescargaSeguro, rutaAbsoluta } from '../../utils/archivos.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarPacientePorId } from '../pacientes/repositorio.js';
import { aPacientePublico } from '../pacientes/servicio.js';
import { buscarVisitaPorId } from '../visitas/repositorio.js';
import { buscarRegistro } from '../registros/repositorio.js';
import * as repositorio from './repositorio.js';

function aAdjuntoPublico(fila) {
  return {
    id: fila.id,
    pacienteId: fila.paciente_id,
    visitaId: fila.visita_id,
    estudioId: fila.estudio_id,
    nombreOriginal: fila.nombre_original,
    tipoMime: fila.tipo_mime,
    tamanoBytes: Number(fila.tamano_bytes),
    subidoPor: fila.subido_por,
    subidoPorNombre: fila.subido_por_nombre,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    urlDescarga: `/api/adjuntos/${fila.id}/descargar`,
  };
}

function auditarAdjunto(fila, accion, antes, ejecutorId, cliente) {
  return registrarAuditoria(
    {
      usuarioId: ejecutorId,
      entidad: 'archivo_adjunto',
      entidadId: fila.id,
      accion,
      antes,
      despues: aAdjuntoPublico(fila),
    },
    cliente,
  );
}

// Un adjunto puede venir atado a una visita o a un estudio; en ese caso el
// paciente se deduce. Si además se indica paciente, todo tiene que coincidir.
async function resolverPaciente({ pacienteId, visitaId, estudioId }, cliente) {
  let pacienteResuelto = pacienteId ?? null;
  let visita = null;

  if (visitaId) {
    visita = await buscarVisitaPorId(visitaId, cliente);

    if (!visita) {
      throw errorNoEncontrado('No existe la visita indicada');
    }

    if (visita.anulado) {
      throw errorConflicto('La visita está anulada');
    }

    if (pacienteId && String(pacienteId) !== String(visita.paciente_id)) {
      throw errorConflicto('La visita pertenece a otro paciente');
    }

    pacienteResuelto = visita.paciente_id;
  }

  if (estudioId) {
    const estudio = await buscarRegistro('estudio', estudioId, cliente);

    if (!estudio) {
      throw errorNoEncontrado('No existe el estudio indicado');
    }

    if (estudio.anulado) {
      throw errorConflicto('El estudio está anulado');
    }

    if (pacienteResuelto && String(pacienteResuelto) !== String(estudio.paciente_id)) {
      throw errorConflicto('El estudio pertenece a otro paciente');
    }

    pacienteResuelto = estudio.paciente_id;
  }

  if (!pacienteResuelto) {
    throw errorDatosInvalidos([
      { campo: 'pacienteId', mensaje: 'Indicá el paciente, la visita o el estudio' },
    ]);
  }

  const paciente = await buscarPacientePorId(pacienteResuelto, cliente);

  if (!paciente) {
    throw errorNoEncontrado('No existe el paciente indicado');
  }

  if (visita && String(visita.paciente_id) !== String(paciente.id)) {
    throw errorConflicto('La visita pertenece a otro paciente');
  }

  return { paciente, pacienteId: paciente.id };
}

export async function listarAdjuntos(filtros) {
  const filas = await repositorio.listarAdjuntos(filtros);
  return filas.map(aAdjuntoPublico);
}

export async function subirAdjunto(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const { pacienteId } = await resolverPaciente(datos, cliente);

    const fila = await repositorio.crearAdjunto(
      {
        pacienteId,
        visitaId: datos.visitaId ?? null,
        estudioId: datos.estudioId ?? null,
        nombreOriginal: datos.archivo.originalname,
        tipoMime: datos.archivo.mimetype,
        tamanoBytes: datos.archivo.size,
        rutaAlmacenamiento: datos.archivo.filename,
        subidoPor: ejecutor.id,
      },
      cliente,
    );

    await auditarAdjunto(fila, 'crear', null, ejecutor.id, cliente);

    return aAdjuntoPublico(fila);
  });
}

export async function obtenerParaDescarga(id) {
  const fila = await repositorio.buscarAdjuntoPorId(id);

  if (!fila || fila.anulado) {
    throw errorNoEncontrado('No existe el adjunto solicitado');
  }

  if (!(await existeArchivo(fila.ruta_almacenamiento))) {
    throw errorNoEncontrado('El archivo no está disponible en el servidor');
  }

  return {
    ruta: rutaAbsoluta(fila.ruta_almacenamiento),
    nombreOriginal: nombreDescargaSeguro(fila.nombre_original),
    tipoMime: fila.tipo_mime,
  };
}

export async function anularAdjunto(id, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarAdjuntoPorId(id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el adjunto solicitado');
    }

    if (actual.anulado) {
      throw errorConflicto('El adjunto ya está anulado');
    }

    const fila = await repositorio.anularAdjunto(id, motivo, ejecutor.id, cliente);
    await repositorio.limpiarFotoSiCorresponde(id, ejecutor.id, cliente);

    await auditarAdjunto(fila, 'anular', aAdjuntoPublico(actual), ejecutor.id, cliente);

    return aAdjuntoPublico(fila);
  });
}

export async function asignarFoto(pacienteId, archivo, ejecutor) {
  return conTransaccion(async (cliente) => {
    const paciente = await buscarPacientePorId(pacienteId, cliente);

    if (!paciente) {
      throw errorNoEncontrado('No existe el paciente indicado');
    }

    const adjunto = await repositorio.crearAdjunto(
      {
        pacienteId,
        visitaId: null,
        estudioId: null,
        nombreOriginal: archivo.originalname,
        tipoMime: archivo.mimetype,
        tamanoBytes: archivo.size,
        rutaAlmacenamiento: archivo.filename,
        subidoPor: ejecutor.id,
      },
      cliente,
    );

    await repositorio.asignarFotoPaciente(pacienteId, adjunto.id, ejecutor.id, cliente);
    const actualizado = await buscarPacientePorId(pacienteId, cliente);

    await auditarAdjunto(adjunto, 'crear', null, ejecutor.id, cliente);
    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'paciente',
        entidadId: pacienteId,
        accion: 'editar',
        antes: aPacientePublico(paciente),
        despues: aPacientePublico(actualizado),
      },
      cliente,
    );

    return {
      adjunto: aAdjuntoPublico(adjunto),
      paciente: aPacientePublico(actualizado),
    };
  });
}

export async function quitarFoto(pacienteId, ejecutor) {
  return conTransaccion(async (cliente) => {
    const paciente = await buscarPacientePorId(pacienteId, cliente);

    if (!paciente) {
      throw errorNoEncontrado('No existe el paciente indicado');
    }

    if (!paciente.foto_adjunto_id) {
      throw errorConflicto('El paciente no tiene una foto cargada');
    }

    await repositorio.quitarFotoPaciente(pacienteId, ejecutor.id, cliente);
    const actualizado = await buscarPacientePorId(pacienteId, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'paciente',
        entidadId: pacienteId,
        accion: 'editar',
        antes: aPacientePublico(paciente),
        despues: aPacientePublico(actualizado),
      },
      cliente,
    );

    return aPacientePublico(actualizado);
  });
}
