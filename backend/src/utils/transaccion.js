import { obtenerPool } from '../config/db.js';

// Ejecuta una función dentro de una transacción. Si algo falla, revierte todo:
// por ejemplo, un alta de usuario y su fila de auditoría se guardan juntas o
// no se guarda ninguna.
export async function conTransaccion(funcion) {
  const cliente = await obtenerPool().connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await funcion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
