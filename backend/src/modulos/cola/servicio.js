import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import {
  errorClienteDuplicado,
  errorConflicto,
  errorNoEncontrado,
  errorSinPermiso,
} from '../../utils/errores.js';
import { enmascararDocumento, normalizarDocumento } from '../../utils/texto.js';
import { hoyEnTucuman } from '../../utils/fechas.js';
import { tienePermiso } from '../../config/permisos.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarClientesPrevios, crearCliente, existeDocumento } from '../clientes/repositorio.js';
import { aClientePublico } from '../clientes/servicio.js';
import { abrirHistorial, buscarPacientePorId, crearPaciente } from '../pacientes/repositorio.js';
import { aPacientePublico } from '../pacientes/servicio.js';
import * as repositorio from './repositorio.js';

const ESTADOS_ABIERTOS = ['esperando', 'en_consulta'];

export function aIngresoPublico(fila) {
  return {
    id: fila.id,
    pacienteId: fila.paciente_id,
    fechaDia: fila.fecha_dia,
    numeroOrden: fila.numero_orden,
    horaLlegada: fila.hora_llegada,
    servicio: fila.servicio,
    prioridad: fila.prioridad,
    urgenciaEstado: fila.urgencia_estado,
    urgenciaConfirmadaPor: fila.urgencia_confirmada_por,
    urgenciaConfirmadaPorNombre: fila.urgencia_confirmada_por_nombre,
    urgenciaConfirmadaEn: fila.urgencia_confirmada_en,
    horaIngresoConsultorio: fila.hora_ingreso_consultorio,
    estado: fila.estado,
    comentario: fila.comentario,
    paciente: {
      id: fila.paciente_id,
      nombre: fila.paciente_nombre,
      codigoInterno: fila.codigo_interno,
      provisorio: fila.provisorio,
      especieId: fila.especie_id,
      especieNombre: fila.especie_nombre,
      razaId: fila.raza_id,
      razaNombre: fila.raza_nombre,
    },
    cliente: {
      id: fila.cliente_id,
      nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
      telefonoPrincipal: fila.telefono_principal,
      telefonoEsWhatsapp: fila.telefono_es_whatsapp,
    },
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function aCandidatoDuplicado(fila) {
  return {
    id: fila.id,
    nombreCompleto: `${fila.nombre} ${fila.apellido}`.trim(),
    nroDocumento: enmascararDocumento(fila.nro_documento),
    telefonoPrincipal: fila.telefono_principal,
    pacientes: fila.pacientes,
    creadoEn: fila.creado_en,
  };
}

// Al consultar la cola se cierran los días anteriores. Es un cierre diferido
// para no depender de un proceso programado: el primer usuario que abre la
// cola del día deja en sin_cerrar lo que quedó abierto.
async function cerrarDiasAnteriores(ejecutor, cliente) {
  const hoy = hoyEnTucuman();
  const abiertos = await repositorio.listarAbiertosAnteriores(hoy, cliente);

  if (abiertos.length === 0) return;

  await repositorio.marcarSinCerrar(
    abiertos.map((fila) => fila.id),
    ejecutor.id,
    cliente,
  );

  for (const fila of abiertos) {
    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'ingreso',
        entidadId: fila.id,
        accion: 'editar',
        antes: { estado: fila.estado },
        despues: { estado: 'sin_cerrar' },
      },
      cliente,
    );
  }
}

async function buscarIngresoParaCambio(id, cliente) {
  const actual = await repositorio.buscarIngresoPorId(id, cliente);

  if (!actual) {
    throw errorNoEncontrado('No existe el ingreso solicitado');
  }

  return actual;
}

function validarIngresoAbierto(actual) {
  if (!ESTADOS_ABIERTOS.includes(actual.estado)) {
    throw errorConflicto('El ingreso ya está cerrado y no admite cambios de urgencia');
  }
}

async function auditarCambio(actual, despues, ejecutor, cliente) {
  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'ingreso',
      entidadId: actual.id,
      accion: 'editar',
      antes: aIngresoPublico(actual),
      despues,
    },
    cliente,
  );
}

export async function listarCola(ejecutor) {
  return conTransaccion(async (cliente) => {
    const hoy = hoyEnTucuman();
    await cerrarDiasAnteriores(ejecutor, cliente);

    const filas = await repositorio.listarColaDelDia(hoy, cliente);

    return {
      fecha: hoy,
      ingresos: filas.map(aIngresoPublico),
    };
  });
}

export async function crearIngreso(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    await cerrarDiasAnteriores(ejecutor, cliente);

    const paciente = await buscarPacientePorId(datos.pacienteId, cliente);

    if (!paciente) {
      throw errorNoEncontrado('No existe el paciente indicado');
    }

    const hoy = hoyEnTucuman();
    const abierto = await repositorio.buscarIngresoAbiertoDePaciente(
      datos.pacienteId,
      hoy,
      cliente,
    );

    if (abierto) {
      throw errorConflicto('El paciente ya tiene un ingreso abierto en la cola de hoy');
    }

    await repositorio.bloquearDia(hoy, cliente);
    const numeroOrden = await repositorio.siguienteNumeroOrden(hoy, cliente);
    const urgenciaEstado = datos.marcarPosibleUrgencia ? 'posible' : 'sin_marca';

    const fila = await repositorio.crearIngreso(
      {
        pacienteId: datos.pacienteId,
        fechaDia: hoy,
        numeroOrden,
        servicio: datos.servicio,
        prioridad: urgenciaEstado === 'sin_marca' ? 'normal' : 'urgente',
        urgenciaEstado,
        urgenciaConfirmadaPor: null,
        comentario: datos.comentario,
      },
      ejecutor.id,
      cliente,
    );

    const publico = aIngresoPublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'ingreso',
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

export async function marcarUrgenciaPosible(id, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await buscarIngresoParaCambio(id, cliente);
    validarIngresoAbierto(actual);

    if (actual.urgencia_estado === 'confirmada') {
      throw errorConflicto('La urgencia ya fue confirmada por un veterinario');
    }

    const fila = await repositorio.marcarUrgenciaPosible(id, ejecutor.id, cliente);
    const publico = aIngresoPublico(fila);

    await auditarCambio(actual, publico, ejecutor, cliente);

    return publico;
  });
}

export async function decidirUrgencia(id, { decision }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await buscarIngresoParaCambio(id, cliente);
    validarIngresoAbierto(actual);

    let fila;

    if (decision === 'confirmada') {
      if (!['posible', 'sin_marca'].includes(actual.urgencia_estado)) {
        throw errorConflicto('Solo se puede confirmar una urgencia posible o sin marcar');
      }

      fila = await repositorio.confirmarUrgencia(id, ejecutor.id, cliente);
    } else {
      if (actual.urgencia_estado !== 'posible') {
        throw errorConflicto('Solo se puede descartar una urgencia marcada como posible');
      }

      fila = await repositorio.descartarUrgencia(id, ejecutor.id, cliente);
    }

    const publico = aIngresoPublico(fila);

    await auditarCambio(actual, publico, ejecutor, cliente);

    return publico;
  });
}

export async function marcarEnConsulta(id, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await buscarIngresoParaCambio(id, cliente);

    if (actual.estado !== 'esperando') {
      throw errorConflicto('Solo se puede pasar al consultorio un ingreso en espera');
    }

    const fila = await repositorio.marcarEnConsulta(id, ejecutor.id, cliente);
    const publico = aIngresoPublico(fila);

    await auditarCambio(actual, publico, ejecutor, cliente);

    return publico;
  });
}

export async function cambiarEstado(id, { estado }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await buscarIngresoParaCambio(id, cliente);

    if (![...ESTADOS_ABIERTOS, 'sin_cerrar'].includes(actual.estado)) {
      throw errorConflicto('El ingreso ya está cerrado');
    }

    const fila = await repositorio.actualizarEstado(id, estado, ejecutor.id, cliente);
    const publico = aIngresoPublico(fila);

    await auditarCambio(actual, publico, ejecutor, cliente);

    return publico;
  });
}

export async function listarSinCerrar(filtros, ejecutor) {
  return conTransaccion(async (cliente) => {
    await cerrarDiasAnteriores(ejecutor, cliente);

    const { filas, total } = await repositorio.listarSinCerrar(filtros, cliente);

    return {
      datos: filas.map(aIngresoPublico),
      paginacion: armarPaginacion({
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
      }),
    };
  });
}

// Alta rápida de una urgencia. El ingreso exige un paciente, así que las tres
// entidades se crean juntas: cliente mínimo, paciente provisorio e ingreso con
// la urgencia ya marcada.
export async function altaRapida(datos, ejecutor) {
  if (datos.urgencia === 'confirmada' && !tienePermiso(ejecutor.rol, 'cola.confirmar_urgencia')) {
    throw errorSinPermiso();
  }

  const documento = normalizarDocumento(datos.nroDocumento);

  return conTransaccion(async (cliente) => {
    await cerrarDiasAnteriores(ejecutor, cliente);

    if (await existeDocumento(documento, cliente)) {
      if (!datos.confirmarDuplicado) {
        const candidatos = await buscarClientesPrevios({ documento }, cliente);

        throw errorClienteDuplicado('Ya existe un cliente con ese documento', [
          {
            campo: 'nroDocumento',
            mensaje: 'Revisá los clientes encontrados o confirmá el alta igual',
            candidatos: candidatos.map(aCandidatoDuplicado),
          },
        ]);
      }
    }

    const especie = await repositorio.buscarEspecieProvisoria(cliente);

    if (!especie) {
      throw errorConflicto('Falta la especie «otro» en el catálogo; ejecutá npm run seed');
    }

    const clienteCreado = await crearCliente(
      {
        nombre: datos.nombre,
        apellido: datos.apellido,
        tipoDocumento: datos.tipoDocumento,
        nroDocumento: documento,
        telefonoPrincipal: null,
        telefonoEsWhatsapp: false,
        telefonoAlternativo: null,
        email: null,
        calleNumero: null,
        localidadBarrio: null,
        provincia: null,
        pais: 'Argentina',
        aceptaCorreo: false,
        aceptaWhatsapp: false,
        fechaConsentimiento: null,
        observaciones: null,
        altaRapida: true,
        fichaIncompleta: true,
      },
      ejecutor.id,
      cliente,
    );

    const pacienteCreado = await crearPaciente(
      {
        clienteId: clienteCreado.id,
        nombre: 'Sin nombre',
        especieId: especie.id,
        razaId: null,
        sexo: 'desconocido',
        castrado: false,
        fechaCastracion: null,
        esReproductor: false,
        fechaNacimiento: null,
        nacimientoAproximado: false,
        fechaDeceso: null,
        origen: null,
        chipCodigo: null,
        color: null,
        comentario:
          'Paciente provisorio creado por alta rápida. La especie se confirma al iniciar la visita.',
        provisorio: true,
        fichaIncompleta: true,
      },
      ejecutor.id,
      cliente,
    );

    await abrirHistorial(pacienteCreado.id, clienteCreado.id, ejecutor.id, cliente);

    const hoy = hoyEnTucuman();
    await repositorio.bloquearDia(hoy, cliente);
    const numeroOrden = await repositorio.siguienteNumeroOrden(hoy, cliente);

    const ingreso = await repositorio.crearIngreso(
      {
        pacienteId: pacienteCreado.id,
        fechaDia: hoy,
        numeroOrden,
        servicio: datos.servicio,
        prioridad: 'urgente',
        urgenciaEstado: datos.urgencia,
        urgenciaConfirmadaPor: datos.urgencia === 'confirmada' ? ejecutor.id : null,
        comentario: datos.comentario,
      },
      ejecutor.id,
      cliente,
    );

    const clientePublico = aClientePublico(clienteCreado, { documentoCompleto: true });
    const pacientePublico = aPacientePublico(pacienteCreado);
    const ingresoPublico = aIngresoPublico(ingreso);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cliente',
        entidadId: clienteCreado.id,
        accion: 'crear',
        antes: null,
        despues: clientePublico,
      },
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'paciente',
        entidadId: pacienteCreado.id,
        accion: 'crear',
        antes: null,
        despues: pacientePublico,
      },
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'ingreso',
        entidadId: ingreso.id,
        accion: 'crear',
        antes: null,
        despues: ingresoPublico,
      },
      cliente,
    );

    return {
      cliente: clientePublico,
      paciente: pacientePublico,
      ingreso: ingresoPublico,
    };
  });
}
