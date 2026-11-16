import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { tienePermiso } from '../../config/permisos.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarPacientePorId, completarProvisorio } from '../pacientes/repositorio.js';
import { aPacientePublico } from '../pacientes/servicio.js';
import { buscarEspeciePorId } from '../catalogos/repositorio.js';
import { buscarIngresoPorId, marcarEnConsulta, actualizarEstado } from '../cola/repositorio.js';
import { aIngresoPublico } from '../cola/servicio.js';
import { buscarCobroActivoPorVisita, sumarPagosActivos } from '../cobros/repositorio.js';
import * as repositorio from './repositorio.js';

function datosPaciente(fila) {
  return {
    id: fila.paciente_id,
    nombre: fila.paciente_nombre,
    codigoInterno: fila.codigo_interno,
    especieId: fila.especie_id,
    especieNombre: fila.especie_nombre,
    provisorio: fila.provisorio,
    fichaIncompleta: fila.paciente_ficha_incompleta,
  };
}

function datosCliente(fila) {
  return {
    id: fila.cliente_id,
    nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
    telefonoPrincipal: fila.telefono_principal,
    fichaIncompleta: fila.cliente_ficha_incompleta,
  };
}

function datosIngreso(fila) {
  if (!fila.ingreso_id) return null;

  return {
    id: fila.ingreso_id,
    numeroOrden: fila.ingreso_numero_orden,
    fechaDia: fila.ingreso_fecha_dia,
    servicio: fila.ingreso_servicio,
    estado: fila.ingreso_estado,
  };
}

export function aVisitaResumen(fila) {
  return {
    id: fila.id,
    pacienteId: fila.paciente_id,
    ingresoId: fila.ingreso_id,
    veterinarioId: fila.veterinario_id,
    veterinarioNombre: fila.veterinario_nombre,
    inicioEn: fila.inicio_en,
    cierreEn: fila.cierre_en,
    estado: fila.estado,
    motivoConsulta: fila.motivo_consulta,
    anulado: fila.anulado,
    paciente: datosPaciente(fila),
    cliente: datosCliente(fila),
    ingreso: datosIngreso(fila),
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export function aVisitaPublica(fila, { clinico = true } = {}) {
  const base = {
    ...aVisitaResumen(fila),
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
  };

  if (!clinico) {
    return { ...base, restringido: true };
  }

  return {
    ...base,
    anamnesis: fila.anamnesis,
    temperaturaC: fila.temperatura_c,
    pesoKg: fila.peso_kg,
    diagnostico: fila.diagnostico,
    observaciones: fila.observaciones,
  };
}

export function aMedicacionPublica(fila) {
  return {
    id: fila.id,
    visitaId: fila.visita_id,
    medicamento: fila.medicamento,
    dosis: fila.dosis,
    via: fila.via,
    frecuencia: fila.frecuencia,
    duracionDias: fila.duracion_dias,
    indicaciones: fila.indicaciones,
    pesoReferenciaKg: fila.peso_referencia_kg,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export function aNotaPublica(fila) {
  return {
    id: fila.id,
    visitaId: fila.visita_id,
    texto: fila.texto,
    autorId: fila.autor_id,
    autorNombre: fila.autor_nombre,
    creadoEn: fila.creado_en,
  };
}

function aVersionPublica(fila) {
  return {
    id: fila.id,
    visitaId: fila.visita_id,
    numero: fila.numero,
    contenido: fila.contenido,
    motivoCambio: fila.motivo_cambio,
    modificadoPor: fila.modificado_por,
    modificadoPorNombre: fila.modificado_por_nombre,
    modificadoEn: fila.modificado_en,
  };
}

async function cargarVisita(id, cliente) {
  const fila = await repositorio.buscarVisitaPorId(id, cliente);

  if (!fila) {
    throw errorNoEncontrado('No existe la visita solicitada');
  }

  return fila;
}

function validarVisitaActiva(fila) {
  if (fila.anulado) {
    throw errorConflicto('La visita está anulada y no admite cambios');
  }
}

// Guarda una foto del estado anterior antes de corregir una visita cerrada.
// La numeración se serializa por visita para que dos correcciones simultáneas
// no generen el mismo número.
async function registrarVersion(visita, motivoCambio, ejecutor, cliente) {
  if (!motivoCambio) {
    throw errorDatosInvalidos([
      {
        campo: 'motivoCambio',
        mensaje: 'Tenés que indicar el motivo del cambio en una visita cerrada',
      },
    ]);
  }

  await repositorio.bloquearVisita(visita.id, cliente);

  const numero = await repositorio.siguienteNumeroVersion(visita.id, cliente);
  const medicacion = await repositorio.listarMedicacion(visita.id, cliente);

  await repositorio.crearVersion(
    {
      visitaId: visita.id,
      numero,
      contenido: {
        visita: aVisitaPublica(visita),
        medicacion: medicacion.map(aMedicacionPublica),
      },
      motivoCambio,
      modificadoPor: ejecutor.id,
    },
    cliente,
  );
}

async function corregirVisitaCerrada(visita, motivoCambio, ejecutor, cliente) {
  await registrarVersion(visita, motivoCambio, ejecutor, cliente);

  if (visita.estado === 'cerrada') {
    await repositorio.marcarVisitaCorregida(visita.id, ejecutor.id, cliente);
    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'visita',
        entidadId: visita.id,
        accion: 'editar',
        antes: { estado: visita.estado },
        despues: { estado: 'corregida' },
      },
      cliente,
    );
  }
}

async function auditarVisita(visita, accion, antes, ejecutor, cliente) {
  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'visita',
      entidadId: visita.id,
      accion,
      antes,
      despues: aVisitaPublica(visita),
    },
    cliente,
  );
}

async function auditarIngreso(antes, despues, ejecutor, cliente) {
  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'ingreso',
      entidadId: despues.id,
      accion: 'editar',
      antes,
      despues,
    },
    cliente,
  );
}

async function validarIngreso(datos, paciente, ejecutor, cliente) {
  if (!datos.ingresoId) return null;

  const ingreso = await buscarIngresoPorId(datos.ingresoId, cliente);

  if (!ingreso) {
    throw errorNoEncontrado('No existe el ingreso indicado');
  }

  if (String(ingreso.paciente_id) !== String(paciente.id)) {
    throw errorConflicto('El ingreso pertenece a otro paciente');
  }

  const existente = await repositorio.buscarVisitaActivaPorIngreso(ingreso.id, cliente);

  if (existente) {
    throw errorConflicto('Ese ingreso ya tiene una visita activa');
  }

  if (ingreso.estado === 'esperando') {
    const antes = aIngresoPublico(ingreso);
    const actualizado = await marcarEnConsulta(ingreso.id, ejecutor.id, cliente);
    await auditarIngreso(antes, aIngresoPublico(actualizado), ejecutor, cliente);
    return actualizado;
  }

  if (ingreso.estado !== 'en_consulta') {
    throw errorConflicto('El ingreso ya está cerrado y no puede generar una visita');
  }

  return ingreso;
}

async function completarDatosProvisorio(datos, paciente, ejecutor, cliente) {
  if (!paciente.provisorio) return paciente;

  if (!datos.especieId) {
    throw errorDatosInvalidos([
      {
        campo: 'especieId',
        mensaje: 'Indicá la especie real antes de iniciar la visita de un paciente provisorio',
      },
    ]);
  }

  const especie = await buscarEspeciePorId(datos.especieId, cliente);

  if (!especie) {
    throw errorDatosInvalidos([{ campo: 'especieId', mensaje: 'La especie no existe' }]);
  }

  const actualizado = await completarProvisorio(
    paciente.id,
    { nombre: datos.nombre ?? paciente.nombre, especieId: especie.id },
    ejecutor.id,
    cliente,
  );

  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'paciente',
      entidadId: paciente.id,
      accion: 'editar',
      antes: aPacientePublico(paciente),
      despues: aPacientePublico(actualizado),
    },
    cliente,
  );

  return actualizado;
}

export async function listarVisitas(filtros) {
  const { filas, total } = await repositorio.listarVisitas(filtros);

  return {
    datos: filas.map(aVisitaResumen),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function obtenerVisita(id, ejecutor) {
  const fila = await repositorio.buscarVisitaPorId(id);

  if (!fila) {
    throw errorNoEncontrado('No existe la visita solicitada');
  }

  const clinico = tienePermiso(ejecutor.rol, 'visitas.ver_clinico');

  if (!clinico) {
    return aVisitaPublica(fila, { clinico: false });
  }

  const [medicacion, notas, versiones] = await Promise.all([
    repositorio.listarMedicacion(id),
    repositorio.listarNotas(id),
    repositorio.listarVersiones(id),
  ]);

  return {
    ...aVisitaPublica(fila),
    medicacion: medicacion.map(aMedicacionPublica),
    notas: notas.map(aNotaPublica),
    versiones: versiones.map(aVersionPublica),
  };
}

export async function crearVisita(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const paciente = await buscarPacientePorId(datos.pacienteId, cliente);

    if (!paciente) {
      throw errorNoEncontrado('No existe el paciente indicado');
    }

    if (paciente.fecha_deceso) {
      throw errorConflicto('El paciente figura como fallecido');
    }

    await validarIngreso(datos, paciente, ejecutor, cliente);
    await completarDatosProvisorio(datos, paciente, ejecutor, cliente);

    const fila = await repositorio.crearVisita(
      {
        pacienteId: datos.pacienteId,
        ingresoId: datos.ingresoId ?? null,
        motivoConsulta: datos.motivoConsulta ?? null,
        anamnesis: datos.anamnesis ?? null,
        temperaturaC: datos.temperaturaC ?? null,
        pesoKg: datos.pesoKg ?? null,
        diagnostico: datos.diagnostico ?? null,
        observaciones: datos.observaciones ?? null,
      },
      ejecutor.id,
      cliente,
    );

    await auditarVisita(fila, 'crear', null, ejecutor, cliente);

    return aVisitaPublica(fila);
  });
}

export async function actualizarVisita(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarVisita(id, cliente);
    validarVisitaActiva(actual);

    const cerrada = actual.estado !== 'borrador';

    if (cerrada) {
      await registrarVersion(actual, datos.motivoCambio, ejecutor, cliente);
    }

    const fila = await repositorio.actualizarVisita(
      id,
      {
        motivoConsulta:
          datos.motivoConsulta !== undefined ? datos.motivoConsulta : actual.motivo_consulta,
        anamnesis: datos.anamnesis !== undefined ? datos.anamnesis : actual.anamnesis,
        temperaturaC: datos.temperaturaC !== undefined ? datos.temperaturaC : actual.temperatura_c,
        pesoKg: datos.pesoKg !== undefined ? datos.pesoKg : actual.peso_kg,
        diagnostico: datos.diagnostico !== undefined ? datos.diagnostico : actual.diagnostico,
        observaciones:
          datos.observaciones !== undefined ? datos.observaciones : actual.observaciones,
      },
      cerrada ? 'corregida' : 'borrador',
      ejecutor.id,
      cliente,
    );

    const antes = aVisitaPublica(actual);
    await auditarVisita(fila, 'editar', antes, ejecutor, cliente);

    return aVisitaPublica(fila);
  });
}

export async function cerrarVisita(id, { motivoConsulta }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarVisita(id, cliente);
    validarVisitaActiva(actual);

    if (actual.estado !== 'borrador') {
      throw errorConflicto('La visita ya está cerrada');
    }

    const motivo = motivoConsulta || actual.motivo_consulta;

    if (!motivo) {
      throw errorDatosInvalidos([
        { campo: 'motivoConsulta', mensaje: 'El motivo de consulta es obligatorio' },
      ]);
    }

    const fila = await repositorio.cerrarVisita(id, motivo, ejecutor.id, cliente);
    await auditarVisita(fila, 'editar', aVisitaPublica(actual), ejecutor, cliente);

    // Cerrar la visita también cierra el ingreso asociado, si sigue abierto.
    if (actual.ingreso_id && ['esperando', 'en_consulta'].includes(actual.ingreso_estado)) {
      const ingresoAntes = await buscarIngresoPorId(actual.ingreso_id, cliente);

      if (ingresoAntes) {
        const ingresoDespues = await actualizarEstado(
          actual.ingreso_id,
          'esperando_cobro',
          ejecutor.id,
          cliente,
        );

        if (ingresoDespues) {
          await auditarIngreso(
            aIngresoPublico(ingresoAntes),
            aIngresoPublico(ingresoDespues),
            ejecutor,
            cliente,
          );
        }
      }
    }

    // Se relee la visita para devolver el estado actualizado del ingreso.
    return aVisitaPublica(await repositorio.buscarVisitaPorId(id, cliente));
  });
}

export async function agregarNota(id, { texto }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarVisita(id, cliente);
    validarVisitaActiva(actual);

    if (actual.estado === 'borrador') {
      throw errorConflicto('Las notas se agregan recién después de cerrar la visita');
    }

    const nota = await repositorio.crearNota(
      { visitaId: id, texto, autorId: ejecutor.id },
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'visita_nota',
        entidadId: nota.id,
        accion: 'crear',
        antes: null,
        despues: aNotaPublica(nota),
      },
      cliente,
    );

    return aNotaPublica(nota);
  });
}

export async function anularVisita(id, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await cargarVisita(id, cliente);
    validarVisitaActiva(actual);

    const cobro = await buscarCobroActivoPorVisita(id, cliente);

    if (cobro) {
      const pagos = await sumarPagosActivos(cobro.id, cliente);

      if (pagos.cantidad > 0) {
        throw errorConflicto(
          'La visita tiene pagos registrados. Anulá primero los pagos y después el cobro',
        );
      }

      throw errorConflicto('La visita tiene un cobro activo. Anulá el cobro antes de anularla');
    }

    const fila = await repositorio.anularVisita(id, motivo, ejecutor.id, cliente);
    const antes = aVisitaPublica(actual);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'visita',
        entidadId: id,
        accion: 'anular',
        antes,
        despues: aVisitaPublica(fila),
      },
      cliente,
    );

    return aVisitaPublica(fila);
  });
}

export async function crearMedicacion(visitaId, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const visita = await cargarVisita(visitaId, cliente);
    validarVisitaActiva(visita);

    if (visita.estado !== 'borrador') {
      await corregirVisitaCerrada(visita, datos.motivoCambio, ejecutor, cliente);
    }

    const fila = await repositorio.crearMedicacion(
      {
        visitaId,
        medicamento: datos.medicamento,
        dosis: datos.dosis ?? null,
        via: datos.via ?? null,
        frecuencia: datos.frecuencia ?? null,
        duracionDias: datos.duracionDias ?? null,
        indicaciones: datos.indicaciones ?? null,
        pesoReferenciaKg: datos.pesoReferenciaKg ?? null,
      },
      ejecutor.id,
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'medicacion',
        entidadId: fila.id,
        accion: 'crear',
        antes: null,
        despues: aMedicacionPublica(fila),
      },
      cliente,
    );

    return aMedicacionPublica(fila);
  });
}

export async function actualizarMedicacion(visitaId, medicacionId, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const visita = await cargarVisita(visitaId, cliente);
    validarVisitaActiva(visita);

    const actual = await repositorio.buscarMedicacionPorId(medicacionId, visitaId, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe la medicación indicada');
    }

    if (actual.anulado) {
      throw errorConflicto('La medicación está anulada y no admite cambios');
    }

    if (visita.estado !== 'borrador') {
      await corregirVisitaCerrada(visita, datos.motivoCambio, ejecutor, cliente);
    }

    const fila = await repositorio.actualizarMedicacion(
      medicacionId,
      {
        medicamento: datos.medicamento !== undefined ? datos.medicamento : actual.medicamento,
        dosis: datos.dosis !== undefined ? datos.dosis : actual.dosis,
        via: datos.via !== undefined ? datos.via : actual.via,
        frecuencia: datos.frecuencia !== undefined ? datos.frecuencia : actual.frecuencia,
        duracionDias: datos.duracionDias !== undefined ? datos.duracionDias : actual.duracion_dias,
        indicaciones: datos.indicaciones !== undefined ? datos.indicaciones : actual.indicaciones,
        pesoReferenciaKg:
          datos.pesoReferenciaKg !== undefined ? datos.pesoReferenciaKg : actual.peso_referencia_kg,
      },
      ejecutor.id,
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'medicacion',
        entidadId: medicacionId,
        accion: 'editar',
        antes: aMedicacionPublica(actual),
        despues: aMedicacionPublica(fila),
      },
      cliente,
    );

    return aMedicacionPublica(fila);
  });
}

export async function anularMedicacion(visitaId, medicacionId, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const visita = await cargarVisita(visitaId, cliente);
    validarVisitaActiva(visita);

    const actual = await repositorio.buscarMedicacionPorId(medicacionId, visitaId, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe la medicación indicada');
    }

    if (actual.anulado) {
      throw errorConflicto('La medicación ya está anulada');
    }

    if (visita.estado !== 'borrador') {
      await corregirVisitaCerrada(visita, motivo, ejecutor, cliente);
    }

    const fila = await repositorio.anularMedicacion(medicacionId, motivo, ejecutor.id, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'medicacion',
        entidadId: medicacionId,
        accion: 'anular',
        antes: aMedicacionPublica(actual),
        despues: aMedicacionPublica(fila),
      },
      cliente,
    );

    return aMedicacionPublica(fila);
  });
}
