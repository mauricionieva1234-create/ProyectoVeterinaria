// Valida el body con un esquema de Zod y reemplaza los datos por los ya
// normalizados (por ejemplo, email en minúsculas). Los errores de Zod los
// traduce el middleware general de errores.
export function validar(esquema) {
  return (req, res, next) => {
    req.body = esquema.parse(req.body);
    next();
  };
}

// En Express 5 req.query es de solo lectura, así que el resultado se guarda
// en req.consulta para que lo use el controlador.
export function validarConsulta(esquema) {
  return (req, res, next) => {
    req.consulta = esquema.parse(req.query);
    next();
  };
}
