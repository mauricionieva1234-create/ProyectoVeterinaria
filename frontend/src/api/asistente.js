import { pedir } from './cliente.js';

// Única llamada del asistente. Es de solo lectura: el backend no expone
// endpoints para crear, editar ni anular desde acá.
export function consultarAsistente(mensaje) {
  return pedir('/asistente/consulta', {
    metodo: 'POST',
    cuerpo: { mensaje },
  });
}
