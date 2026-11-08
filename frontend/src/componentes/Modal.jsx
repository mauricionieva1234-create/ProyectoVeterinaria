import { useEffect } from 'react';

export function Modal({ abierto, titulo, onCerrar, children }) {
  useEffect(() => {
    if (!abierto) return undefined;

    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') {
        onCerrar();
      }
    }

    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="titulo-modal" className="text-lg font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
