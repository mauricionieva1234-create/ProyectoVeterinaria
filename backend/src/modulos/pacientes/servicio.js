import { conTransaccion } from '../../utils/transaccion.js';
import { armarPaginacion } from '../../utils/paginacion.js';
import { errorConflicto, errorDatosInvalidos, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import { buscarClientePorId } from '../clientes/repositorio.js';
import * as repositorio from './repositorio.js';

export function aPacientePublico(fila) {
  const publico = {
    id: fila.id,
    clienteId: fila.cliente_id,
    codigoInterno: fila.codigo_interno,
    nombre: fila.nombre,
    especieId: fila.especie_id,
    especieNombre: fila.especie_nombre,
    razaId: fila.raza_id,
    razaNombre: fila.raza_nombre,
    sexo: fila.sexo,
    castrado: fila.castrado,
    fechaCastracion: fila.fecha_castracion,
    esReproductor: fila.es_reproductor,
    fechaNacimiento: fila.fecha_nacimiento,
    nacimientoAproximado: fila.nacimiento_aproximado,
    fechaDeceso: fila.fecha_deceso,
    origen: fila.origen,
    chipCodigo: fila.chip_codigo,
    color: fila.color,
    comentario: fila.comentario,
    provisorio: fila.provisorio,
    fichaIncompleta: fila.ficha_incompleta,
    fotoAdjuntoId: fila.foto_adjunto_id,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };

  // Las filas que vienen de la base traen el dueño resuelto por el repositorio.
  // Los objetos que ya son públicos (por ejemplo, los que devuelve una alta)
  // no tienen estas columnas, así que se omiten.
  if (fila.cliente_nombre !== undefined) {
    publico.cliente = {
      id: fila.cliente_id,
      nombreCompleto: `${fila.cliente_nombre} ${fila.cliente_apellido}`.trim(),
      telefonoPrincipal: fila.cliente_telefono ?? null,
    };
  }

  return publico;
}

// La ficha del paciente queda incompleta si es provisorio o si faltan datos
// básicos para identificarlo y calcular la edad.
export function calcularFichaIncompleta({ provisorio, fechaNacimiento, razaId }) {
  return Boolean(provisorio || !fechaNacimiento || !razaId);
}

function aHistorialPublico(fila) {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    nombreCompleto: `${fila.nombre} ${fila.apellido}`.trim(),
    desde: fila.desde,
    hasta: fila.hasta,
  };
}

export async function listarPacientes(filtros) {
  const { filas, total } = await repositorio.listarPacientes(filtros);

  return {
    datos: filas.map(aPacientePublico),
    paginacion: armarPaginacion({ pagina: filtros.pagina, limite: filtros.limite, total }),
  };
}

export async function obtenerPaciente(id) {
  const fila = await repositorio.buscarPacientePorId(id);

  if (!fila) {
    throw errorNoEncontrado('No existe el paciente solicitado');
  }

  const [historial, dueno] = await Promise.all([
    repositorio.listarHistorial(id),
    buscarClientePorId(fila.cliente_id),
  ]);

  return {
    ...aPacientePublico(fila),
    cliente: dueno
      ? {
          id: dueno.id,
          nombreCompleto: `${dueno.nombre} ${dueno.apellido}`.trim(),
          telefonoPrincipal: dueno.telefono_principal,
        }
      : null,
    historial: historial.map(aHistorialPublico),
  };
}

async function validarDueno(clienteId, cliente) {
  const dueno = await buscarClientePorId(clienteId, cliente);

  if (!dueno) {
    throw errorNoEncontrado('No existe el cliente indicado');
  }

  if (dueno.fusionado_en_cliente_id) {
    throw errorConflicto('Ese cliente está fusionado con otro; usá el cliente que se conservó');
  }

  return dueno;
}

async function validarRaza(especieId, razaId, cliente) {
  if (!razaId) return;

  if (!(await repositorio.existeRazaDeEspecie(razaId, especieId, cliente))) {
    throw errorDatosInvalidos([
      { campo: 'razaId', mensaje: 'La raza no pertenece a la especie elegida' },
    ]);
  }
}

export async function crearPaciente(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    await validarDueno(datos.clienteId, cliente);
    await validarRaza(datos.especieId, datos.razaId, cliente);

    const fichaIncompleta = calcularFichaIncompleta(datos);

    const fila = await repositorio.crearPaciente(
      { ...datos, fichaIncompleta },
      ejecutor.id,
      cliente,
    );

    await repositorio.abrirHistorial(fila.id, datos.clienteId, ejecutor.id, cliente);

    const publico = aPacientePublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'paciente',
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

export async function actualizarPaciente(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.buscarPacientePorId(id, cliente);

    if (!actual) {
      throw errorNoEncontrado('No existe el paciente solicitado');
    }

    await validarDueno(datos.clienteId, cliente);
    await validarRaza(datos.especieId, datos.razaId, cliente);

    // Si cambia el dueño, se cierra el tramo actual del historial y se abre
    // uno nuevo para conservar quién era el titular antes.
    const cambioDeDueno = String(actual.cliente_id) !== String(datos.clienteId);

    if (cambioDeDueno) {
      await repositorio.cerrarHistorialActual(id, ejecutor.id, cliente);
    }

    const fichaIncompleta = calcularFichaIncompleta(datos);

    const fila = await repositorio.actualizarPaciente(
      id,
      { ...datos, fichaIncompleta },
      ejecutor.id,
      cliente,
    );

    if (cambioDeDueno) {
      await repositorio.abrirHistorial(id, datos.clienteId, ejecutor.id, cliente);
    }

    const despues = aPacientePublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'paciente',
        entidadId: fila.id,
        accion: 'editar',
        antes: aPacientePublico(actual),
        despues,
      },
      cliente,
    );

    return despues;
  });
}
