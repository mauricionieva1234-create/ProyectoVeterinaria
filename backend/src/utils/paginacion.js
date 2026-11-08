// Helpers de paginación compartidos por los listados.
export function calcularDesplazamiento(pagina, limite) {
  return (pagina - 1) * limite;
}

export function armarPaginacion({ pagina, limite, total }) {
  return {
    pagina,
    limite,
    total,
    totalPaginas: total === 0 ? 0 : Math.ceil(total / limite),
  };
}
