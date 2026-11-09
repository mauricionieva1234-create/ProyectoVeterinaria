import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import {
  errorClienteDuplicado,
  errorConflicto,
  errorDatosInvalidos,
  errorNoEncontrado,
} from '../../utils/errores.js';
import { enmascararDocumento, normalizarDocumento, normalizarTelefono } from '../../utils/texto.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { aPacientePublico } from '../pacientes/servicio.js';
import * as pacientesRepositorio from '../pacientes/repositorio.js';
import * as repositorio from './repositorio.js';

// En los listados el documento va enmascarado. La ficha lo muestra completo y
// eso queda registrado como "ver_sensible".
export function aClientePublico(fila, { documentoCompleto = false } = {}) {
  const publico = {
    id: fila.id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    tipoDocumento: fila.tipo_documento,
    nroDocumento: documentoCompleto ? fila.nro_documento : enmascararDocumento(fila.nro_documento),
    telefonoPrincipal: fila.telefono_principal,
    telefonoEsWhatsapp: fila.telefono_es_whatsapp,
    telefonoAlternativo: fila.telefono_alternativo,
    email: fila.email,
    calleNumero: fila.calle_numero,
    localidadBarrio: fila.localidad_barrio,
    provincia: fila.provincia,
    pais: fila.pais,
    aceptaCorreo: fila.acepta_correo,
    aceptaWhatsapp: fila.acepta_whatsapp,
    fechaConsentimiento: fila.fecha_consentimiento,
    observaciones: fila.observaciones,
    altaRapida: fila.alta_rapida,
    fichaIncompleta: fila.ficha_incompleta,
    fusionadoEnClienteId: fila.fusionado_en_cliente_id,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };

  if (fila.pacientes !== undefined) {
    publico.pacientes = fila.pacientes;
  }

  if (fila.creado_por_nombre !== undefined) {
    publico.creadoPorNombre = fila.creado_por_nombre;
  }

  return publico;
}

function normalizarDatosCliente(datos) {
  const telefonoPrincipal = normalizarTelefono(datos.telefonoPrincipal);

  return {
    ...datos,
    nroDocumento: normalizarDocumento(datos.nroDocumento),
    telefonoPrincipal,
    telefonoAlternativo: normalizarTelefono(datos.telefonoAlternativo),
    // La ficha se considera completa cuando tiene teléfono principal.
    fichaIncompleta: !telefonoPrincipal,
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

export async function listarClientes(filtros) {
  const { filas, total } = await repositorio.listarClientes(filtros);

  return {
    datos: filas.map((fila) => aClientePublico(fila)),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function buscarClientesPrevios(filtros) {
  const documento = normalizarDocumento(filtros.documento) || null;
  const telefono = normalizarTelefono(filtros.telefono);
  const telefonoDigitos = telefono ? telefono.replace(/\D/g, '') : null;

  if (!documento && !telefonoDigitos) {
    return { datos: [] };
  }

  const filas = await repositorio.buscarClientesPrevios({ documento, telefono: telefonoDigitos });

  return {
    datos: filas.map((fila) => {
      const coincidePor = [];

      if (documento && fila.nro_documento === documento) {
        coincidePor.push('documento');
      }

      const telefonos = [fila.telefono_principal, fila.telefono_alternativo]
        .filter(Boolean)
        .map((valor) => String(valor).replace(/\D/g, ''));

      if (telefonoDigitos && telefonos.includes(telefonoDigitos)) {
        coincidePor.push('telefono');
      }

      return { ...aClientePublico(fila), coincidePor };
    }),
  };
}

export async function obtenerCliente(id, ejecutor) {
  const fila = await repositorio.buscarClientePorId(id);

  if (!fila) {
    throw errorNoEncontrado('No existe el cliente solicitado');
  }

  const pacientes = await pacientesRepositorio.listarPorCliente(id);

  // Ver el documento completo es un dato sensible y se audita.
  await registrarAuditoria({
    usuarioId: ejecutor.id,
    entidad: 'cliente',
    entidadId: fila.id,
    accion: 'ver_sensible',
    antes: null,
    despues: { campo: 'nro_documento' },
  });

  return {
    ...aClientePublico(fila, { documentoCompleto: true }),
    pacientes: pacientes.map(aPacientePublico),
  };
}

export async function crearCliente(datos, ejecutor) {
  const normalizados = normalizarDatosCliente(datos);

  return conTransaccion(async (cliente) => {
    const hayDuplicado = await repositorio.existeDocumento(normalizados.nroDocumento, cliente);

    // El documento no es único: se avisa y el usuario decide si continúa.
    if (hayDuplicado && !datos.confirmarDuplicado) {
      const candidatos = await repositorio.buscarClientesPrevios(
        { documento: normalizados.nroDocumento },
        cliente,
      );

      throw errorClienteDuplicado('Ya existe un cliente con ese documento', [
        {
          campo: 'nroDocumento',
          mensaje: 'Revisá los clientes encontrados o confirmá el alta igual',
          candidatos: candidatos.map(aCandidatoDuplicado),
        },
      ]);
    }

    const fila = await repositorio.crearCliente(normalizados, ejecutor.id, cliente);
    const publico = aClientePublico(fila, { documentoCompleto: true });

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cliente',
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

export async function actualizarCliente(id, datos, ejecutor) {
  const normalizados = normalizarDatosCliente(datos);

  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarClientePorId(id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el cliente solicitado');
    }

    const fila = await repositorio.actualizarCliente(id, normalizados, ejecutor.id, cliente);
    const despues = aClientePublico(fila, { documentoCompleto: true });

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cliente',
        entidadId: fila.id,
        accion: 'editar',
        antes: aClientePublico(actual, { documentoCompleto: true }),
        despues,
      },
      cliente,
    );

    return despues;
  });
}

export async function listarFichasIncompletas(filtros) {
  const { filas, total } = await repositorio.listarFichasIncompletas(filtros);

  return {
    datos: filas.map((fila) => aClientePublico(fila)),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function unirClientes(idDuplicado, { clienteConservadoId }, ejecutor) {
  if (String(idDuplicado) === String(clienteConservadoId)) {
    throw errorDatosInvalidos([
      { campo: 'clienteConservadoId', mensaje: 'Elegí un cliente distinto para conservar' },
    ]);
  }

  return conTransaccion(async (cliente) => {
    const duplicado = await repositorio.buscarClientePorId(idDuplicado, cliente);
    const conservado = await repositorio.buscarClientePorId(clienteConservadoId, cliente);

    if (!duplicado || !conservado) {
      throw errorNoEncontrado('No existe alguno de los clientes indicados');
    }

    if (duplicado.fusionado_en_cliente_id || conservado.fusionado_en_cliente_id) {
      throw errorConflicto('Alguno de los clientes ya está fusionado con otro');
    }

    const reasignados = await repositorio.moverPacientes(
      idDuplicado,
      clienteConservadoId,
      ejecutor.id,
      cliente,
    );

    // El historial conserva el tramo anterior y abre uno nuevo con el titular
    // que se queda.
    await repositorio.cerrarHistorialDeCliente(idDuplicado, ejecutor.id, cliente);
    await repositorio.abrirHistorialDeCliente(clienteConservadoId, ejecutor.id, cliente);
    await repositorio.marcarFusionado(idDuplicado, clienteConservadoId, ejecutor.id, cliente);

    const conservadoActualizado = await repositorio.buscarClientePorId(
      clienteConservadoId,
      cliente,
    );

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'cliente',
        entidadId: idDuplicado,
        accion: 'unir',
        antes: {
          duplicado: aClientePublico(duplicado, { documentoCompleto: true }),
          conservado: aClientePublico(conservado, { documentoCompleto: true }),
        },
        despues: {
          fusionadoEnClienteId: clienteConservadoId,
          pacientesReasignados: reasignados,
        },
      },
      cliente,
    );

    return {
      clienteConservado: aClientePublico(conservadoActualizado, { documentoCompleto: true }),
      pacientesReasignados: reasignados,
    };
  });
}
