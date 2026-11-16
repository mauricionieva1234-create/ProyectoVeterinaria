import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import { env } from '../../config/env.js';
import { hoyEnTucuman } from '../../utils/fechas.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { aIngresoPublico } from '../cola/servicio.js';
import { actualizarEstado, buscarIngresoPorId } from '../cola/repositorio.js';
import * as repositorio from './repositorio.js';

const MEDIOS = ['efectivo', 'debito', 'credito', 'transferencia'];

// Los importes se guardan con dos decimales. Redondear antes de comparar evita
// diferencias de un centavo entre JavaScript y numeric de PostgreSQL.
function redondear(valor) {
  return Math.round(Number(valor ?? 0) * 100) / 100;
}

function aNumero(valor) {
  return Number(valor ?? 0);
}

export function aPagoPublico(fila) {
  return {
    id: fila.id,
    cobroId: fila.cobro_id,
    medio: fila.medio,
    monto: aNumero(fila.monto),
    fecha: fila.fecha,
    registradoPor: fila.registrado_por,
    registradoPorNombre: fila.registrado_por_nombre,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoEn: fila.anulado_en,
    anuladoPorNombre: fila.anulado_por_nombre ?? null,
    paciente: fila.paciente_id
      ? {
          id: fila.paciente_id,
          nombre: fila.paciente_nombre,
          codigoInterno: fila.codigo_interno,
        }
      : null,
    cliente: fila.paciente_id
      ? {
          nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
        }
      : null,
  };
}

export function aCobroPublico(fila) {
  return {
    id: fila.id,
    visitaId: fila.visita_id,
    total: aNumero(fila.total),
    estado: fila.estado,
    observaciones: fila.observaciones,
    anulado: fila.anulado,
    motivoAnulacion: fila.motivo_anulacion,
    anuladoEn: fila.anulado_en,
    pagado: aNumero(fila.pagado),
    saldo: aNumero(fila.saldo),
    cantidadPagos: fila.cantidad_pagos,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    visita: {
      id: fila.visita_id,
      estado: fila.visita_estado,
      inicioEn: fila.visita_inicio_en,
      cierreEn: fila.visita_cierre_en,
      ingresoId: fila.visita_ingreso_id,
      ingresoEstado: fila.ingreso_estado,
      ingresoFecha: fila.ingreso_fecha,
      ingresoNumeroOrden: fila.ingreso_numero_orden,
      servicio: fila.ingreso_servicio,
    },
    paciente: {
      id: fila.paciente_id,
      nombre: fila.paciente_nombre,
      codigoInterno: fila.codigo_interno,
      especieNombre: fila.especie_nombre,
    },
    cliente: {
      id: fila.cliente_id,
      nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
      telefonoPrincipal: fila.telefono_principal,
    },
  };
}

function aPendientePublico(fila) {
  return {
    origen: fila.origen,
    ingresoId: fila.ingreso_id,
    ingresoFecha: fila.ingreso_fecha,
    numeroOrden: fila.numero_orden,
    servicio: fila.servicio,
    ingresoEstado: fila.ingreso_estado,
    horaLlegada: fila.hora_llegada,
    visitaId: fila.visita_id,
    visitaEstado: fila.visita_estado,
    cierreEn: fila.cierre_en,
    paciente: {
      id: fila.paciente_id,
      nombre: fila.paciente_nombre,
      codigoInterno: fila.codigo_interno,
      especieNombre: fila.especie_nombre,
    },
    cliente: {
      id: fila.cliente_id,
      nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
      telefonoPrincipal: fila.telefono_principal,
    },
  };
}

function estadoSegun(total, pagado) {
  const totalCentavos = Math.round(redondear(total) * 100);
  const pagadoCentavos = Math.round(redondear(pagado) * 100);

  if (pagadoCentavos <= 0) {
    return totalCentavos <= 0 ? 'pagado' : 'pendiente';
  }

  return pagadoCentavos >= totalCentavos ? 'pagado' : 'parcial';
}

// El ingreso recién pasa a atendido cuando el cobro queda saldado. Si la visita
// no tiene ingreso, no hay nada que actualizar en la cola.
async function marcarIngresoAtendido(ingresoId, ejecutor, cliente) {
  if (!ingresoId) return;

  const antes = await buscarIngresoPorId(ingresoId, cliente);

  if (!antes || antes.estado !== 'esperando_cobro') return;

  const despues = await actualizarEstado(ingresoId, 'atendido', ejecutor.id, cliente);

  if (!despues) return;

  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'ingreso',
      entidadId: ingresoId,
      accion: 'editar',
      antes: aIngresoPublico(antes),
      despues: aIngresoPublico(despues),
    },
    cliente,
  );
}

async function auditarCobro(cobro, accion, antes, ejecutor, cliente) {
  await registrarAuditoria(
    {
      usuarioId: ejecutor.id,
      entidad: 'cobro',
      entidadId: cobro.id,
      accion,
      antes,
      despues: aCobroPublico(cobro),
    },
    cliente,
  );
}

async function cargarCobro(id, cliente, { bloquear = false } = {}) {
  const fila = await repositorio.buscarCobroPorId(id, cliente, { bloquear });

  if (!fila) {
    throw errorNoEncontrado('No existe el cobro solicitado');
  }

  return fila;
}

export async function listarCobros(filtros) {
  const { filas, total } = await repositorio.listarCobros(filtros, env.ZONA_HORARIA);

  return {
    datos: filas.map(aCobroPublico),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function listarDeudas(filtros) {
  const { filas, total } = await repositorio.listarDeudas(filtros);

  return {
    datos: filas.map(aCobroPublico),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function listarPendientes() {
  const filas = await repositorio.listarPendientes();
  return filas.map(aPendientePublico);
}

export async function obtenerCobro(id) {
  const fila = await cargarCobro(id);
  const pagos = await repositorio.listarPagosDeCobro(id);

  return {
    ...aCobroPublico(fila),
    pagos: pagos.map(aPagoPublico),
  };
}

export async function obtenerCaja(fecha = hoyEnTucuman()) {
  const [pagos, porMedio, cobros, deudas, pendientes] = await Promise.all([
    repositorio.pagosDelDia(fecha, env.ZONA_HORARIA),
    repositorio.resumenPagosPorMedio(fecha, env.ZONA_HORARIA),
    repositorio.resumenCobrosDelDia(fecha, env.ZONA_HORARIA),
    repositorio.resumenDeudas(),
    repositorio.listarPendientes(),
  ]);

  const totalesPorMedio = new Map(porMedio.map((fila) => [fila.medio, fila]));

  const detalleMedios = MEDIOS.map((medio) => {
    const fila = totalesPorMedio.get(medio);
    return {
      medio,
      cantidad: fila?.cantidad ?? 0,
      total: aNumero(fila?.total),
    };
  });

  return {
    fecha,
    porMedio: detalleMedios,
    totalCobrado: detalleMedios.reduce((suma, fila) => suma + fila.total, 0),
    cantidadPagos: pagos.length,
    pagos: pagos.map(aPagoPublico),
    cobrosCreados: cobros.cantidad,
    totalCreado: aNumero(cobros.total),
    deudaTotal: aNumero(deudas.total),
    cantidadDeudas: deudas.cantidad,
    pendientes: pendientes.length,
  };
}

export async function crearCobro(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const visita = await repositorio.buscarVisitaParaCobro(datos.visitaId, cliente);

    if (!visita) {
      throw errorNoEncontrado('No existe la visita indicada');
    }

    if (visita.anulado) {
      throw errorConflicto('La visita está anulada y no se puede cobrar');
    }

    if (!['cerrada', 'corregida'].includes(visita.estado)) {
      throw errorConflicto('La visita tiene que estar cerrada para generar un cobro');
    }

    const existente = await repositorio.buscarCobroActivoPorVisita(visita.id, cliente);

    if (existente) {
      throw errorConflicto('La visita ya tiene un cobro activo');
    }

    const total = redondear(datos.total);
    const observaciones = datos.observaciones?.trim() || null;

    if (total === 0 && !observaciones) {
      throw errorDatosInvalidos([
        {
          campo: 'observaciones',
          mensaje: 'Indicá una observación para un cobro sin cargo',
        },
      ]);
    }

    const estado = total === 0 ? 'pagado' : 'pendiente';
    const fila = await repositorio.crearCobro(
      {
        visitaId: visita.id,
        total,
        estado,
        observaciones,
      },
      ejecutor.id,
      cliente,
    );

    const cobro = await cargarCobro(fila, cliente);
    await auditarCobro(cobro, 'crear', null, ejecutor, cliente);

    if (estado === 'pagado') {
      await marcarIngresoAtendido(cobro.visita_ingreso_id, ejecutor, cliente);
    }

    return aCobroPublico(cobro);
  });
}

export async function actualizarCobro(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const cobro = await cargarCobro(id, cliente, { bloquear: true });

    if (cobro.anulado) {
      throw errorConflicto('El cobro está anulado y no admite cambios');
    }

    const pagado = redondear((await repositorio.sumarPagosActivos(id, cliente)).pagado);
    const total = redondear(datos.total);

    if (total < pagado) {
      throw errorConflicto('El total no puede quedar por debajo de lo ya pagado');
    }

    const observaciones =
      datos.observaciones !== undefined ? datos.observaciones?.trim() || null : cobro.observaciones;
    const estado = estadoSegun(total, pagado);

    await repositorio.actualizarCobro(id, { total, estado, observaciones }, ejecutor.id, cliente);

    const actualizado = await cargarCobro(id, cliente);
    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cobro',
        entidadId: id,
        accion: 'editar',
        antes: aCobroPublico(cobro),
        despues: { ...aCobroPublico(actualizado), motivoCambio: datos.motivoCambio },
      },
      cliente,
    );

    if (estado === 'pagado') {
      await marcarIngresoAtendido(actualizado.visita_ingreso_id, ejecutor, cliente);
    }

    return aCobroPublico(actualizado);
  });
}

export async function anularCobro(id, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const cobro = await cargarCobro(id, cliente, { bloquear: true });

    if (cobro.anulado) {
      throw errorConflicto('El cobro ya está anulado');
    }

    const pagos = await repositorio.sumarPagosActivos(id, cliente);

    if (pagos.cantidad > 0) {
      throw errorConflicto('Anulá primero los pagos activos del cobro');
    }

    await repositorio.anularCobro(id, motivo, ejecutor.id, cliente);
    const anulado = await cargarCobro(id, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cobro',
        entidadId: id,
        accion: 'anular',
        antes: aCobroPublico(cobro),
        despues: aCobroPublico(anulado),
      },
      cliente,
    );

    return aCobroPublico(anulado);
  });
}

export async function registrarPago(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const cobro = await cargarCobro(id, cliente, { bloquear: true });

    if (cobro.anulado) {
      throw errorConflicto('El cobro está anulado y no acepta pagos');
    }

    const monto = redondear(datos.monto);
    const saldo = redondear(cobro.saldo);

    if (monto <= 0) {
      throw errorDatosInvalidos([
        { campo: 'monto', mensaje: 'El monto tiene que ser mayor que cero' },
      ]);
    }

    if (saldo <= 0) {
      throw errorConflicto('El cobro ya está pagado');
    }

    if (monto > saldo) {
      throw errorDatosInvalidos([
        {
          campo: 'monto',
          mensaje: `El pago supera el saldo pendiente de ${saldo.toFixed(2)}`,
        },
      ]);
    }

    const pagoId = await repositorio.crearPago(
      {
        cobroId: id,
        medio: datos.medio,
        monto,
        registradoPor: ejecutor.id,
      },
      cliente,
    );

    const pagos = await repositorio.sumarPagosActivos(id, cliente);
    const estado = estadoSegun(cobro.total, pagos.pagado);

    await repositorio.actualizarEstadoCobro(id, estado, ejecutor.id, cliente);

    const pago = await repositorio.buscarPagoPorId(pagoId, id, cliente);
    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'pago',
        entidadId: pagoId,
        accion: 'crear',
        antes: null,
        despues: aPagoPublico(pago),
      },
      cliente,
    );

    if (estado === 'pagado') {
      await marcarIngresoAtendido(cobro.visita_ingreso_id, ejecutor, cliente);
    }

    return {
      pago: aPagoPublico(pago),
      cobro: aCobroPublico(await cargarCobro(id, cliente)),
    };
  });
}

export async function anularPago(cobroId, pagoId, { motivo }, ejecutor) {
  return conTransaccion(async (cliente) => {
    const cobro = await cargarCobro(cobroId, cliente, { bloquear: true });

    if (cobro.anulado) {
      throw errorConflicto('El cobro está anulado');
    }

    const pago = await repositorio.buscarPagoPorId(pagoId, cobroId, cliente);

    if (!pago) {
      throw errorNoEncontrado('No existe el pago indicado');
    }

    if (pago.anulado) {
      throw errorConflicto('El pago ya está anulado');
    }

    await repositorio.anularPago(pagoId, cobroId, motivo, ejecutor.id, cliente);

    const pagos = await repositorio.sumarPagosActivos(cobroId, cliente);
    const estado = estadoSegun(cobro.total, pagos.pagado);
    await repositorio.actualizarEstadoCobro(cobroId, estado, ejecutor.id, cliente);

    const anulado = await repositorio.buscarPagoPorId(pagoId, cobroId, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'pago',
        entidadId: pagoId,
        accion: 'anular',
        antes: aPagoPublico(pago),
        despues: aPagoPublico(anulado),
      },
      cliente,
    );

    return {
      pago: aPagoPublico(anulado),
      cobro: aCobroPublico(await cargarCobro(cobroId, cliente)),
    };
  });
}
