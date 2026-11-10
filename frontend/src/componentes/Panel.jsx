import { resolverTono } from './tonos.js';

// Encabezado de página: un cuadro de color con título, descripción y acciones.
export function EncabezadoPagina({ tono = 'teal', titulo, descripcion, children }) {
  const t = resolverTono(tono);

  return (
    <header
      className={`relative overflow-hidden rounded-2xl bg-linear-to-r ${t.cabecera} px-5 py-5 text-white shadow-lg shadow-slate-900/10`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-24 size-40 rounded-full bg-white/5"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight drop-shadow-sm">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-2xl text-sm text-white/85">{descripcion}</p>}
        </div>

        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  );
}

// Panel de contenido con tono propio. El encabezado es opcional.
export function Panel({
  tono = 'teal',
  titulo,
  descripcion,
  acciones,
  children,
  className = '',
  cuerpoClassName = '',
}) {
  const t = resolverTono(tono);
  const tieneCabecera = Boolean(titulo || descripcion || acciones);

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${t.borde} ${t.fondo} shadow-sm ${className}`}
    >
      {tieneCabecera && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-b ${t.borde} bg-white/70 px-4 py-3 backdrop-blur-sm`}
        >
          <div>
            {titulo && (
              <h2 className={`flex items-center gap-2 text-sm font-semibold ${t.titulo}`}>
                <span
                  aria-hidden="true"
                  className={`inline-block h-3 w-1.5 rounded-full ${t.acento}`}
                />
                {titulo}
              </h2>
            )}
            {descripcion && <p className={`mt-0.5 text-xs ${t.texto}`}>{descripcion}</p>}
          </div>

          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}

      <div className={`p-4 ${cuerpoClassName}`}>{children}</div>
    </section>
  );
}
