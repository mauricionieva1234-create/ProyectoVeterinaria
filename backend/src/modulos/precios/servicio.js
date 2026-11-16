import { conTransaccion } from '../../utils/transaccion.js';
import { errorConflicto, errorNoEncontrado } from '../../utils/errores.js';
import { registrarAuditoria } from '../auditoria/repositorio.js';
import * as repositorio from './repositorio.js';

// Los importes se guardan con dos decimales. Redondear antes de comparar evita
// diferencias de un centavo entre JavaScript y numeric de PostgreSQL.
function redondear(valor) {
  return Math.round(Number(valor ?? 0) * 100) / 100;
}

function aPrecioPublico(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    importe: Number(fila.importe),
    activo: fila.activo,
    observaciones: fila.observaciones,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

function aHistorialPublico(fila) {
  return {
    id: fila.id,
    precioId: fila.precio_id,
    nombreAnterior: fila.nombre_anterior,
    nombreNuevo: fila.nombre_nuevo,
    importeAnterior: fila.importe_anterior === null ? null : Number(fila.importe_anterior),
    importeNuevo: Number(fila.importe_nuevo),
    motivo: fila.motivo,
    cambiadoPorNombre: fila.cambiado_por_nombre,
    cambiadoEn: fila.cambiado_en,
  };
}

// Dos pedidos simultáneos pueden pasar la verificación previa. El índice único
// parcial de la base es la última defensa y se traduce a un error de negocio.
function esNombreDuplicado(error) {
  return error?.code === '23505';
}

function errorNombreDuplicado() {
  return errorConflicto('Ya existe un precio activo con ese nombre', [
    { campo: 'nombre', mensaje: 'Elegí otro nombre o desactivá el precio existente' },
  ]);
}

export async function listarPrecios(filtros) {
  const filas = await repositorio.listarPrecios(filtros);
  return { datos: filas.map(aPrecioPublico) };
}

export async function obtenerPrecio(id) {
  const fila = await repositorio.buscarPrecioPorId(id);

  if (!fila) {
    throw errorNoEncontrado('No existe el precio solicitado');
  }

  const historial = await repositorio.listarHistorial(id);

  return {
    ...aPrecioPublico(fila),
    historial: historial.map(aHistorialPublico),
  };
}

export async function crearPrecio(datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    if (await repositorio.existePrecioActivoConNombre(datos.nombre, null, cliente)) {
      throw errorNombreDuplicado();
    }

    const importe = redondear(datos.importe);
    const observaciones = datos.observaciones?.trim() || null;

    let id;

    try {
      id = await repositorio.crearPrecio(
        { nombre: datos.nombre, importe, observaciones },
        ejecutor.id,
        cliente,
      );
    } catch (error) {
      if (esNombreDuplicado(error)) throw errorNombreDuplicado();
      throw error;
    }

    // El alta también abre el historial para que el precio tenga una primera
    // versión visible desde el primer día.
    await repositorio.registrarHistorial(
      {
        precioId: id,
        nombreAnterior: null,
        nombreNuevo: datos.nombre,
        importeAnterior: null,
        importeNuevo: importe,
        motivo: 'Precio inicial',
        cambiadoPor: ejecutor.id,
      },
      cliente,
    );

    const fila = await repositorio.buscarPrecioPorId(id, cliente);
    const publico = aPrecioPublico(fila);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'precio',
        entidadId: id,
        accion: 'crear',
        antes: null,
        despues: publico,
      },
      cliente,
    );

    return publico;
  });
}

export async function actualizarPrecio(id, datos, ejecutor) {
  return conTransaccion(async (cliente) => {
    const fila = await repositorio.buscarPrecioPorId(id, cliente, { bloquear: true });

    if (!fila) {
      throw errorNoEncontrado('No existe el precio solicitado');
    }

    const nombre = datos.nombre ?? fila.nombre;
    const importe = datos.importe !== undefined ? redondear(datos.importe) : Number(fila.importe);
    const activo = datos.activo ?? fila.activo;
    const observaciones =
      datos.observaciones !== undefined ? datos.observaciones?.trim() || null : fila.observaciones;

    if (activo && (await repositorio.existePrecioActivoConNombre(nombre, id, cliente))) {
      throw errorNombreDuplicado();
    }

    const cambioNombre = nombre !== fila.nombre;
    const cambioImporte = importe !== Number(fila.importe);

    try {
      await repositorio.actualizarPrecio(
        id,
        { nombre, importe, activo, observaciones },
        ejecutor.id,
        cliente,
      );
    } catch (error) {
      if (esNombreDuplicado(error)) throw errorNombreDuplicado();
      throw error;
    }

    if (cambioNombre || cambioImporte) {
      await repositorio.registrarHistorial(
        {
          precioId: id,
          nombreAnterior: fila.nombre,
          nombreNuevo: nombre,
          importeAnterior: Number(fila.importe),
          importeNuevo: importe,
          motivo: datos.motivo,
          cambiadoPor: ejecutor.id,
        },
        cliente,
      );
    }

    const actualizado = await repositorio.buscarPrecioPorId(id, cliente);

    await registrarAuditoria(
      {
        usuarioId: ejecutor.id,
        entidad: 'precio',
        entidadId: id,
        accion: 'editar',
        antes: aPrecioPublico(fila),
        despues: aPrecioPublico(actualizado),
      },
      cliente,
    );

    return aPrecioPublico(actualizado);
  });
}
