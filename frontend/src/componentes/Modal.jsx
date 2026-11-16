import { useEffect, useId, useRef } from 'react';

const SELECTOR_ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal con foco atrapado: al abrir enfoca el primer control, Tab y Shift+Tab
// circulan solo por el diálogo, Escape cierra y al cerrar se devuelve el foco
// al elemento que lo tenía antes.
export function Modal({ abierto, titulo, onCerrar, children }) {
  const idTitulo = useId();
  const contenedor = useRef(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;

    const enfocadoAntes = document.activeElement;
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function enfocables() {
      if (!contenedor.current) return [];
      return [...contenedor.current.querySelectorAll(SELECTOR_ENFOCABLES)];
    }

    // Se enfoca el primer control después del montaje del contenido.
    const primerControl = enfocables()[0];
    (primerControl ?? contenedor.current)?.focus();

    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') {
        onCerrarRef.current();
        return;
      }

      if (evento.key !== 'Tab') return;

      const controles = enfocables();

      if (controles.length === 0) {
        evento.preventDefault();
        contenedor.current?.focus();
        return;
      }

      const primero = controles[0];
      const ultimo = controles[controles.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.style.overflow = desbordeAnterior;

      if (enfocadoAntes instanceof HTMLElement && enfocadoAntes.isConnected) {
        enfocadoAntes.focus();
      }
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div
        ref={contenedor}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between bg-linear-to-r from-teal-600 to-emerald-500 px-5 py-3 text-white">
          <h2 id={idTitulo} className="text-lg font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-2xl leading-none text-white/80 hover:bg-white/20 hover:text-white"
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
