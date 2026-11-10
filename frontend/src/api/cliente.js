const BASE = '/api';

export class ErrorApi extends Error {
  constructor(mensaje, { codigo = 'ERROR_API', estado = 0, detalles = [] } = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.estado = estado;
    this.detalles = detalles;
  }
}

// Lee la respuesta del backend y convierte los errores uniformes en ErrorApi.
async function procesarRespuesta(respuesta) {
  const tipoContenido = respuesta.headers.get('content-type') ?? '';
  let datos = null;

  if (tipoContenido.includes('application/json')) {
    datos = await respuesta.json().catch(() => null);
  }

  if (!respuesta.ok) {
    const error = datos?.error;

    throw new ErrorApi(error?.mensaje ?? `Error ${respuesta.status}`, {
      codigo: error?.codigo ?? 'ERROR_API',
      estado: respuesta.status,
      detalles: error?.detalles ?? [],
    });
  }

  return datos;
}

// Cliente HTTP centralizado. Usa rutas relativas porque Vite hace proxy de
// /api al backend en desarrollo, y credentials para enviar la cookie de sesión.
export async function pedir(ruta, { metodo = 'GET', cuerpo, senal } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    credentials: 'include',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: senal,
  });

  return procesarRespuesta(respuesta);
}

// Variante para multipart/form-data. No se fija Content-Type: el navegador
// agrega el boundary que necesita multer.
export async function enviarFormulario(ruta, formulario, { senal } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: 'POST',
    credentials: 'include',
    body: formulario,
    signal: senal,
  });

  return procesarRespuesta(respuesta);
}
