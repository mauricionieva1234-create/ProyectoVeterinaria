import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import { hoyEnTucuman } from '../../utils/fechas.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarVisitaPorId } from '../visitas/repositorio.js';
import * as repositorio from './repositorio.js';

const ESTADOS_FINALES = ['realizado', 'cancelado', 'reprogramado'];

export function aControlPublico(fila) {
  return {
    id: fila.id,
    pacienteId: fila.paciente_id,
    visitaOrigenId: fila.visita_origen_id,
    fechaControl: fila.fecha_control,
    franja: fila.franja,
    motivo: fila.motivo,
    estado: fila.estado,
    controlNuevoId: fila.control_nuevo_id,
    visitaRealizadaId: fila.visita_realizada_id,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    paciente: {
      id: fila.paciente_id,
      nombre: fila.paciente_nombre,
      codigoInterno: fila.codigo_interno,
      especieId: fila.especie_id,
      especieNombre: fila.especie_nombre,
    },
    cliente: {
      id: fila.cliente_id,
      nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
      telefonoPrincipal: fila.telefono_principal,
      fichaIncompleta: fila.cliente_ficha_incompleta,
    },
    ultimoAviso: fila.ultimo_aviso_canal
      ? {
          canal: fila.ultimo_aviso_canal,
          resultado: fila.ultimo_aviso_resultado,
          nota: fila.ultimo_aviso_nota,
          realizadoEn: fila.ultimo_aviso_en,
          realizadoPor: fila.ultimo_aviso_por,
          realizadoPorNombre: fila.ultimo_aviso_por_nombre,
        }
      : null,
  };
}

export function aAvisoPublico(fila) {
  return {
    id: fila.id,
    controlId: fila.control_id,
    canal: fila.canal,
    resultado: fila.resultado,
    nota: fila.nota,
    realizadoPor: fila.realizado_por,
    realizadoPorNombre: fila.realizado_por_nombre,
    realizadoEn: fila.realizado_en,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
    creadoEn: fila.creado_en,
  };
}

function sumarUnDia(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));
  return siguiente.toISOString().slice(0, 10);
}

async function cargarControl(id, cliente) {
  const fila = await repositorio.buscarControlPorId(id, cliente);

  if (!fila) {
    throw errorNoEncontrado('No existe el control solicitado');
  }

  return fila;
}

// Los pendientes de días anteriores pasan a ausentes y se auditan con el
// usuario que consultó, igual que el cierre diferido de la cola.
async function cerrarVencidos(ejecutorId, cliente) {
  const hoy = hoyEnTucuman();
  const ids = await repositorio.listarVencidos(hoy, cliente);

  if (ids.length === 0) return;

  const antes = [];

  for (const id of ids) {
    antes.push(await repositorio.buscarControlPorId(id, cliente));
  }

  await repositorio.marcarAusentes(ids, ejecutorId, cliente);

  for (const control of antes) {
    const despues = await repositorio.buscarControlPorId(control.id, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutorId,
        entidad: 'control',
        entidadId: control.id,
        accion: 'editar',
        antes: aControlPublico(control),
        despues: aControlPublico(despues),
      },
      cliente,
    );
  }
}

function auditarControl(control, accion, antes, ejecutorId, cliente) {
  return registrarAuditoria(
    {
      usuarioId: ejecutorId,
      entidad: 'control',
      entidadId: control.id,
      accion,
      antes,
      despues: aControlPublico(control),
    },
    cliente,
  );
}

function validarFechaControl(fechaControl) {
  if (fechaControl < hoyEnTucuman()) {
    throw errorDatosInvalidos([
      { campo: 'fechaControl', mensaje: 'La fecha del control no puede ser anterior a hoy' },
    ]);
  }
}

export async function listarControles(filtros, ejecutor) {
  return conTransaccion(async (cliente) => {
    await cerrarVencidos(ejecutor.id, cliente);

    const { filas, total } = await repositorio.listarControles(filtros, cliente);

    return {
      datos: filas.map(aControlPublico),
      paginacion: armarPaginacion({
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
      }),
    };
  });
}

export async function obtenerRecordatorios(ejecutor) {
  return conTransaccion(async (cliente) => {
    await cerrarVencidos(ejecutor.id, cliente);

    const hoy = hoyEnTucuman();
    const manana = sumarUnDia(hoy);
    const filas = await repositorio.listarRecordatorios(hoy, manana, cliente);

    return {
      hoy: filas.filter((fila) => fila.fecha_control === hoy).map(aControlPublico),
      manana: filas.filter((fila) => fila.fecha_control === manana).map(aControlPublico),
    };
  });
}

export async function obtenerControl(id) {
  const fila = await cargarControl(id);
  const avisos = await repositorio.listarAvisos(id);

  return {
    ...aControlPublico(fila),
    avisos: avisos.map(aAvisoPublico),
  };
}

export async function crearControl(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const visita = await buscarVisitaPorId(datos.visitaOrigenId, cliente);

    if (!visita) {
      throw errorNoEncontrado('No existe la visita indicada');
    }

    if (visita.anulado) {
      throw errorConflicto('La visita está anulada y no puede generar controles');
    }

    validarFechaControl(datos.fechaControl);

    const fila = await repositorio.crearControl(
      {
        pacienteId: visita.paciente_id,
        visitaOrigenId: visita.id,
        fechaControl: datos.fechaControl,
        franja: datos.franja,
        motivo: datos.motivo ?? null,
      },
      ejecutor.id,
      cliente,
    );

    await auditarControl(fila, 'crear', null, ejecutor.id, cliente);

    return aControlPublico(fila);
  });
}

export async function reprogramarControl(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarControl(id, cliente);

    if (actual.anulado) {
      throw errorConflicto('El control está anulado y no se puede reprogramar');
    }

    if (!['pendiente', 'ausente'].includes(actual.estado)) {
      throw errorConflicto('Solo se puede reprogramar un control pendiente o ausente');
    }

    validarFechaControl(datos.fechaControl);

    const nuevo = await repositorio.crearControl(
      {
        pacienteId: actual.paciente_id,
        visitaOrigenId: actual.visita_origen_id,
        fechaControl: datos.fechaControl,
        franja: datos.franja,
        motivo: datos.motivo !== undefined ? datos.motivo : actual.motivo,
      },
      ejecutor.id,
      cliente,
    );

    const original = await repositorio.marcarReprogramado(id, nuevo.id, ejecutor.id, cliente);

    await auditarControl(original, 'editar', aControlPublico(actual), ejecutor.id, cliente);
    await auditarControl(nuevo, 'crear', null, ejecutor.id, cliente);

    return {
      control: aControlPublico(original),
      nuevo: aControlPublico(nuevo),
    };
  });
}

export async function cambiarEstado(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarControl(id, cliente);

    if (actual.anulado) {
      throw errorConflicto('El control está anulado y no admite cambios');
    }

    if (ESTADOS_FINALES.includes(actual.estado)) {
      throw errorConflicto('El control ya está cerrado y no admite cambios');
    }

    const visitaRealizadaId =
      datos.estado === 'realizado' ? (datos.visitaRealizadaId ?? null) : null;

    if (visitaRealizadaId) {
      const visita = await buscarVisitaPorId(visitaRealizadaId, cliente);

      if (!visita) {
        throw errorNoEncontrado('No existe la visita indicada');
      }

      if (visita.anulado) {
        throw errorConflicto('La visita está anulada');
      }

      if (String(visita.paciente_id) !== String(actual.paciente_id)) {
        throw errorConflicto('La visita pertenece a otro paciente');
      }
    }

    const fila = await repositorio.actualizarEstado(
      id,
      datos.estado,
      visitaRealizadaId,
      ejecutor.id,
      cliente,
    );

    await auditarControl(fila, 'editar', aControlPublico(actual), ejecutor.id, cliente);

    return aControlPublico(fila);
  });
}

export async function anularControl(id, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarControl(id, cliente);

    if (actual.anulado) {
      throw errorConflicto('El control ya está anulado');
    }

    const fila = await repositorio.anularControl(id, motivo, ejecutor.id, cliente);

    await auditarControl(fila, 'anular', aControlPublico(actual), ejecutor.id, cliente);

    return aControlPublico(fila);
  });
}

export async function listarAvisos(controlId) {
  await cargarControl(controlId);
  const filas = await repositorio.listarAvisos(controlId);
  return filas.map(aAvisoPublico);
}

export async function crearAviso(controlId, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const control = await cargarControl(controlId, cliente);

    if (control.anulado) {
      throw errorConflicto('El control está anulado y no admite avisos');
    }

    const fila = await repositorio.crearAviso(
      {
        controlId,
        canal: datos.canal,
        resultado: datos.resultado,
        nota: datos.nota ?? null,
      },
      ejecutor.id,
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'aviso_control',
        entidadId: fila.id,
        accion: 'crear',
        antes: null,
        despues: aAvisoPublico(fila),
      },
      cliente,
    );

    return aAvisoPublico(fila);
  });
}
