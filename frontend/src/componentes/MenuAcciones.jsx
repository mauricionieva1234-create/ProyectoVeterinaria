import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ANCHO_MENU = 208;
const MARGEN = 8;

const CLASES_TONO = {
  normal: 'text-slate-700 hover:bg-slate-50',
  urgencia: 'text-amber-800 hover:bg-amber-50',
  exito: 'text-emerald-700 hover:bg-emerald-50',
  peligro: 'text-rose-700 hover:bg-rose-50',
};

// Menú flotante para las acciones secundarias de una tabla. Se dibuja en un
// portal con posición fija para que no lo recorte el scroll horizontal.
export function MenuAcciones({ etiqueta = 'Más acciones', acciones }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const botonRef = useRef(null);
  const menuRef = useRef(null);
  const rectBotonRef = useRef(null);

  function abrirMenu() {
    const rect = botonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const izquierda = Math.min(
      Math.max(MARGEN, rect.right - ANCHO_MENU),
      window.innerWidth - ANCHO_MENU - MARGEN,
    );

    rectBotonRef.current = rect;
    setPosicion({ top: rect.bottom + 6, left: izquierda });
    setAbierto(true);
  }

  // Si no hay lugar debajo del botón, el menú se abre hacia arriba.
  useLayoutEffect(() => {
    if (!abierto) return;

    const rect = rectBotonRef.current;
    const menu = menuRef.current;
    if (!rect || !menu) return;

    const alto = menu.offsetHeight;
    const espacioAbajo = window.innerHeight - rect.bottom - 6;
    const top =
      espacioAbajo >= alto + MARGEN
        ? rect.bottom + 6
        : Math.max(MARGEN, Math.min(rect.top - alto - 6, window.innerHeight - alto - MARGEN));

    setPosicion((actual) => (actual && actual.top === top ? actual : { ...actual, top }));
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;

    function alTocarFuera(evento) {
      if (botonRef.current?.contains(evento.target)) return;
      if (menuRef.current?.contains(evento.target)) return;
      setAbierto(false);
    }

    function alPresionarTecla(evento) {
      if (evento.key !== 'Escape') return;
      setAbierto(false);
      botonRef.current?.focus();
    }

    function alDesplazar() {
      setAbierto(false);
    }

    document.addEventListener('mousedown', alTocarFuera);
    document.addEventListener('keydown', alPresionarTecla);
    window.addEventListener('scroll', alDesplazar, true);
    window.addEventListener('resize', alDesplazar);

    return () => {
      document.removeEventListener('mousedown', alTocarFuera);
      document.removeEventListener('keydown', alPresionarTecla);
      window.removeEventListener('scroll', alDesplazar, true);
      window.removeEventListener('resize', alDesplazar);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    menuRef.current?.querySelector('button:not(:disabled)')?.focus();
  }, [abierto]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={etiqueta}
        onClick={() => (abierto ? setAbierto(false) : abrirMenu())}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill="currentColor"
          focusable="false"
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {abierto &&
        posicion &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={etiqueta}
            style={{ top: posicion.top, left: posicion.left }}
            className="fixed z-50 max-h-[calc(100vh-16px)] w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
          >
            {acciones.map((accion, indice) =>
              accion.separador ? (
                <div
                  key={`separador-${indice}`}
                  role="separator"
                  className="my-1 h-px bg-slate-100"
                />
              ) : (
                <button
                  key={accion.etiqueta}
                  type="button"
                  role="menuitem"
                  disabled={accion.deshabilitado}
                  onClick={() => {
                    setAbierto(false);
                    accion.onClick();
                  }}
                  className={[
                    'block w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-50',
                    CLASES_TONO[accion.tono] ?? CLASES_TONO.normal,
                  ].join(' ')}
                >
                  {accion.etiqueta}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
