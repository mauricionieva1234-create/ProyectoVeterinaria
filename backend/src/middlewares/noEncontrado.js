export function noEncontrado(req, res) {
  res.status(404).json({
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `No existe la ruta ${req.method} ${req.originalUrl}`,
      detalles: [],
    },
  });
}
