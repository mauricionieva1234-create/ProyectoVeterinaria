import { conTransaccion } from '../../utils/transaccion.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarPacientePorId } from '../pacientes/repositorio.js';
import { buscarVisitaPorId } from '../visitas/repositorio.js';
import { buscarUsuarioPorId } from '../usuarios/repositorio.js';
import * as repositorio from './repositorio.js';

const ENTIDADES = {
  vacuna: 'registro_vacuna',
  antiparasitario: 'registro_antiparasitario',
  estudio: 'registro_estudio',
  cirugia: 'registro_cirugia',
};

const ESTADOS_ESTUDIO = ['pedido', 'realizado', 'resultado_cargado'];
const ESTADOS_CIRUGIA = ['programada', 'realizada', 'suspendida', 'cancelada'];

function base(fila) {
  return {
    id: fila.id,
    pacienteId: fila.paciente_id,
    visitaId: fila.visita_id,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoPor: fila.anulado_por,
    anuladoEn: fila.anulado_en,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export function aRegistroPublico(tipo, fila) {
  const comun = base(fila);

  if (tipo === 'vacuna') {
    return {
      ...comun,
      tipo,
      vacuna: fila.vacuna,
      lote: fila.lote,
      fechaAplicacion: fila.fecha_aplicacion,
      fechaProximaDosis: fila.fecha_proxima_dosis,
      aplicadaPor: fila.aplicada_por,
      aplicadaPorNombre: fila.aplicada_por_nombre,
    };
  }

  if (tipo === 'antiparasitario') {
    return {
      ...comun,
      tipo,
      producto: fila.producto,
      tipoProducto: fila.tipo,
      dosis: fila.dosis,
      fechaAplicacion: fila.fecha_aplicacion,
      fechaProxima: fila.fecha_proxima,
      aplicadoPor: fila.aplicado_por,
      aplicadoPorNombre: fila.aplicado_por_nombre,
    };
  }

  if (tipo === 'estudio') {
    return {
      ...comun,
      tipo,
      tipoEstudio: fila.tipo_estudio,
      fechaPedido: fila.fecha_pedido,
      estado: fila.estado,
      fechaResultado: fila.fecha_resultado,
      resultadoResumen: fila.resultado_resumen,
    };
  }

  return {
    ...comun,
    tipo,
    tipoCirugia: fila.tipo_cirugia,
    fechaProgramada: fila.fecha_programada,
    estado: fila.estado,
    indicacionesPrevias: fila.indicaciones_previas,
    notasPostoperatorio: fila.notas_postoperatorio,
    cirujanoId: fila.cirujano_id,
    cirujanoNombre: fila.cirujano_nombre,
    visitaOrigenId: fila.visita_origen_id,
  };
}

async function buscarPaciente(pacienteId, cliente) {
  const paciente = await buscarPacientePorId(pacienteId, cliente);

  if (!paciente) {
    throw errorNoEncontrado('No existe el paciente indicado');
  }

  return paciente;
}

async function validarPacienteVivo(pacienteId, cliente) {
  const paciente = await buscarPaciente(pacienteId, cliente);

  if (paciente.fecha_deceso) {
    throw errorConflicto('El paciente figura como fallecido');
  }

  return paciente;
}

async function validarVisita(visitaId, pacienteId, cliente) {
  if (!visitaId) return;

  const visita = await buscarVisitaPorId(visitaId, cliente);

  if (!visita) {
    throw errorNoEncontrado('No existe la visita indicada');
  }

  if (visita.anulado) {
    throw errorConflicto('La visita está anulada');
  }

  if (String(visita.paciente_id) !== String(pacienteId)) {
    throw errorConflicto('La visita pertenece a otro paciente');
  }
}

async function validarUsuario(id, campo, cliente) {
  if (!id) return null;

  const usuario = await buscarUsuarioPorId(id, cliente);

  if (!usuario || !usuario.activo) {
    throw errorDatosInvalidos([
      { campo, mensaje: 'El usuario indicado no existe o está inactivo' },
    ]);
  }

  return usuario;
}

function auditar(tipo, registro, accion, antes, ejecutor, cliente) {
  return registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: ENTIDADES[tipo],
      entidadId: registro.id,
      accion,
      antes,
      despues: aRegistroPublico(tipo, registro),
    },
    cliente,
  );
}

export async function listarPorPaciente(pacienteId, tipo) {
  await buscarPaciente(pacienteId, undefined);

  if (tipo) {
    const filas = await repositorio.listarRegistros(tipo, pacienteId);
    return { tipo, datos: filas.map((fila) => aRegistroPublico(tipo, fila)) };
  }

  const [vacunas, antiparasitarios, estudios, cirugias] = await Promise.all([
    repositorio.listarRegistros('vacuna', pacienteId),
    repositorio.listarRegistros('antiparasitario', pacienteId),
    repositorio.listarRegistros('estudio', pacienteId),
    repositorio.listarRegistros('cirugia', pacienteId),
  ]);

  return {
    vacunas: vacunas.map((fila) => aRegistroPublico('vacuna', fila)),
    antiparasitarios: antiparasitarios.map((fila) => aRegistroPublico('antiparasitario', fila)),
    estudios: estudios.map((fila) => aRegistroPublico('estudio', fila)),
    cirugias: cirugias.map((fila) => aRegistroPublico('cirugia', fila)),
  };
}

export async function obtenerRegistro(tipo, id) {
  const fila = await repositorio.buscarRegistro(tipo, id);

  if (!fila) {
    throw errorNoEncontrado('No existe el registro solicitado');
  }

  return aRegistroPublico(tipo, fila);
}

function datosVacuna(datos, ejecutor) {
  return {
    paciente_id: datos.pacienteId,
    visita_id: datos.visitaId ?? null,
    vacuna: datos.vacuna,
    lote: datos.lote ?? null,
    fecha_aplicacion: datos.fechaAplicacion,
    fecha_proxima_dosis: datos.fechaProximaDosis ?? null,
    aplicada_por: datos.aplicadaPor ?? ejecutor.id,
  };
}

function datosAntiparasitario(datos, ejecutor) {
  return {
    paciente_id: datos.pacienteId,
    visita_id: datos.visitaId ?? null,
    producto: datos.producto,
    tipo: datos.tipo,
    dosis: datos.dosis ?? null,
    fecha_aplicacion: datos.fechaAplicacion,
    fecha_proxima: datos.fechaProxima ?? null,
    aplicado_por: datos.aplicadoPor ?? ejecutor.id,
  };
}

function datosEstudio(datos) {
  return {
    paciente_id: datos.pacienteId,
    visita_id: datos.visitaId ?? null,
    tipo_estudio: datos.tipoEstudio,
    fecha_pedido: datos.fechaPedido,
    estado: datos.estado ?? 'pedido',
    fecha_resultado: datos.fechaResultado ?? null,
    resultado_resumen: datos.resultadoResumen ?? null,
  };
}

function datosCirugia(datos, ejecutor) {
  return {
    paciente_id: datos.pacienteId,
    visita_id: datos.visitaId ?? null,
    tipo_cirugia: datos.tipoCirugia,
    fecha_programada: datos.fechaProgramada ?? null,
    estado: datos.estado ?? 'programada',
    indicaciones_previas: datos.indicacionesPrevias ?? null,
    notas_postoperatorio: datos.notasPostoperatorio ?? null,
    cirujano_id: datos.cirujanoId ?? ejecutor.id,
    visita_origen_id: datos.visitaId ?? null,
  };
}

export async function crearRegistro(tipo, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    await validarPacienteVivo(datos.pacienteId, cliente);
    await validarVisita(datos.visitaId, datos.pacienteId, cliente);

    if (tipo === 'vacuna' || tipo === 'antiparasitario') {
      const campo = tipo === 'vacuna' ? 'aplicadaPor' : 'aplicadoPor';
      const usuarioId = tipo === 'vacuna' ? datos.aplicadaPor : datos.aplicadoPor;
      await validarUsuario(usuarioId, campo, cliente);
    }

    if (tipo === 'cirugia') {
      await validarUsuario(datos.cirujanoId, 'cirujanoId', cliente);
    }

    let datosDb;

    if (tipo === 'vacuna') datosDb = datosVacuna(datos, ejecutor);
    if (tipo === 'antiparasitario') datosDb = datosAntiparasitario(datos, ejecutor);
    if (tipo === 'estudio') datosDb = datosEstudio(datos);
    if (tipo === 'cirugia') datosDb = datosCirugia(datos, ejecutor);

    if (tipo === 'estudio') {
      validarEstadoEstudio(datosDb.estado, null, datosDb.fecha_resultado);
    }

    if (tipo === 'cirugia') {
      validarEstadoCirugia(datosDb.estado, null, datosDb.fecha_programada);
    }

    const fila = await repositorio.crearRegistro(tipo, datosDb, ejecutor.id, cliente);

    await auditar(tipo, fila, 'crear', null, ejecutor, cliente);

    return aRegistroPublico(tipo, fila);
  });
}

function validarEstadoEstudio(estado, anterior, fechaResultado) {
  if (!ESTADOS_ESTUDIO.includes(estado)) {
    throw errorDatosInvalidos([{ campo: 'estado', mensaje: 'El estado del estudio no es válido' }]);
  }

  if (anterior && ESTADOS_ESTUDIO.indexOf(estado) < ESTADOS_ESTUDIO.indexOf(anterior)) {
    throw errorConflicto('El estudio no puede volver a un estado anterior');
  }

  if (estado === 'resultado_cargado' && !fechaResultado) {
    throw errorDatosInvalidos([
      { campo: 'fechaResultado', mensaje: 'Indicá la fecha del resultado' },
    ]);
  }
}

function validarEstadoCirugia(estado, anterior, fechaProgramada) {
  if (!ESTADOS_CIRUGIA.includes(estado)) {
    throw errorDatosInvalidos([
      { campo: 'estado', mensaje: 'El estado de la cirugía no es válido' },
    ]);
  }

  if (anterior && anterior !== estado) {
    if (anterior !== 'programada') {
      throw errorConflicto('La cirugía ya está cerrada y no puede cambiar de estado');
    }

    if (!['realizada', 'suspendida', 'cancelada'].includes(estado)) {
      throw errorConflicto('La cirugía solo puede pasar a realizada, suspendida o cancelada');
    }
  }

  if (estado === 'programada' && !fechaProgramada) {
    throw errorDatosInvalidos([
      { campo: 'fechaProgramada', mensaje: 'Indicá la fecha programada de la cirugía' },
    ]);
  }
}

function fusionar(actual, datos, campos) {
  const resultado = {};

  for (const [camel, columna] of Object.entries(campos)) {
    resultado[camel] = datos[camel] !== undefined ? datos[camel] : actual[columna];
  }

  return resultado;
}

export async function actualizarRegistro(tipo, id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarRegistro(tipo, id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el registro solicitado');
    }

    if (actual.anulado) {
      throw errorConflicto('El registro está anulado y no admite cambios');
    }

    await validarVisita(actual.visita_id, actual.paciente_id, cliente);

    if (tipo === 'vacuna') {
      const fusionado = fusionar(actual, datos, {
        vacuna: 'vacuna',
        lote: 'lote',
        fechaAplicacion: 'fecha_aplicacion',
        fechaProximaDosis: 'fecha_proxima_dosis',
        aplicadaPor: 'aplicada_por',
      });
      await validarUsuario(fusionado.aplicadaPor, 'aplicadaPor', cliente);

      const fila = await repositorio.actualizarRegistro(
        tipo,
        id,
        {
          vacuna: fusionado.vacuna,
          lote: fusionado.lote,
          fecha_aplicacion: fusionado.fechaAplicacion,
          fecha_proxima_dosis: fusionado.fechaProximaDosis,
          aplicada_por: fusionado.aplicadaPor,
        },
        ejecutor.id,
        cliente,
      );

      await auditar(tipo, fila, 'editar', aRegistroPublico(tipo, actual), ejecutor, cliente);
      return aRegistroPublico(tipo, fila);
    }

    if (tipo === 'antiparasitario') {
      const fusionado = fusionar(actual, datos, {
        producto: 'producto',
        tipo: 'tipo',
        dosis: 'dosis',
        fechaAplicacion: 'fecha_aplicacion',
        fechaProxima: 'fecha_proxima',
        aplicadoPor: 'aplicado_por',
      });
      await validarUsuario(fusionado.aplicadoPor, 'aplicadoPor', cliente);

      const fila = await repositorio.actualizarRegistro(
        tipo,
        id,
        {
          producto: fusionado.producto,
          tipo: fusionado.tipo,
          dosis: fusionado.dosis,
          fecha_aplicacion: fusionado.fechaAplicacion,
          fecha_proxima: fusionado.fechaProxima,
          aplicado_por: fusionado.aplicadoPor,
        },
        ejecutor.id,
        cliente,
      );

      await auditar(tipo, fila, 'editar', aRegistroPublico(tipo, actual), ejecutor, cliente);
      return aRegistroPublico(tipo, fila);
    }

    if (tipo === 'estudio') {
      const fusionado = fusionar(actual, datos, {
        tipoEstudio: 'tipo_estudio',
        fechaPedido: 'fecha_pedido',
        estado: 'estado',
        fechaResultado: 'fecha_resultado',
        resultadoResumen: 'resultado_resumen',
      });

      validarEstadoEstudio(fusionado.estado, actual.estado, fusionado.fechaResultado);

      const fila = await repositorio.actualizarRegistro(
        tipo,
        id,
        {
          tipo_estudio: fusionado.tipoEstudio,
          fecha_pedido: fusionado.fechaPedido,
          estado: fusionado.estado,
          fecha_resultado: fusionado.fechaResultado,
          resultado_resumen: fusionado.resultadoResumen,
        },
        ejecutor.id,
        cliente,
      );

      await auditar(tipo, fila, 'editar', aRegistroPublico(tipo, actual), ejecutor, cliente);
      return aRegistroPublico(tipo, fila);
    }

    const fusionado = fusionar(actual, datos, {
      tipoCirugia: 'tipo_cirugia',
      fechaProgramada: 'fecha_programada',
      estado: 'estado',
      indicacionesPrevias: 'indicaciones_previas',
      notasPostoperatorio: 'notas_postoperatorio',
      cirujanoId: 'cirujano_id',
    });

    validarEstadoCirugia(fusionado.estado, actual.estado, fusionado.fechaProgramada);
    await validarUsuario(fusionado.cirujanoId, 'cirujanoId', cliente);

    const fila = await repositorio.actualizarRegistro(
      tipo,
      id,
      {
        tipo_cirugia: fusionado.tipoCirugia,
        fecha_programada: fusionado.fechaProgramada,
        estado: fusionado.estado,
        indicaciones_previas: fusionado.indicacionesPrevias,
        notas_postoperatorio: fusionado.notasPostoperatorio,
        cirujano_id: fusionado.cirujanoId,
      },
      ejecutor.id,
      cliente,
    );

    await auditar(tipo, fila, 'editar', aRegistroPublico(tipo, actual), ejecutor, cliente);
    return aRegistroPublico(tipo, fila);
  });
}

export async function anularRegistro(tipo, id, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarRegistro(tipo, id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el registro solicitado');
    }

    if (actual.anulado) {
      throw errorConflicto('El registro ya está anulado');
    }

    const fila = await repositorio.anularRegistro(tipo, id, motivo, ejecutor.id, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: ENTIDADES[tipo],
        entidadId: id,
        accion: 'anular',
        antes: aRegistroPublico(tipo, actual),
        despues: aRegistroPublico(tipo, fila),
      },
      cliente,
    );

    return aRegistroPublico(tipo, fila);
  });
}
