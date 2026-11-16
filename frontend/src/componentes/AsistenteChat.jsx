import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { consultarAsistente } from '../api/asistente.js';

const SUGERENCIAS = [
  { etiqueta: 'Controles de hoy', mensaje: 'controles de hoy' },
  { etiqueta: 'Controles de mañana', mensaje: 'controles de mañana' },
  { etiqueta: 'Controles pendientes', mensaje: 'controles pendientes' },
];

const BIENVENIDA = {
  tipo: 'ayuda',
  titulo: 'Consultas rápidas',
  resumen:
    'Busco datos exactos del sistema por mascota, titular, documento o teléfono. Trabajo solo con tu sesión y en modo lectura.',
  secciones: [
    {
      titulo: 'Ejemplos',
      items: [
        { etiqueta: 'Mascota', valor: '“vacunas de Firulais” o “resumen de PAC-000001”' },
        { etiqueta: 'Titular', valor: '“documento 93000101” o “teléfono 3815550111”' },
        { etiqueta: 'Controles', valor: '“controles pendientes”' },
      ],
    },
  ],
  opciones: SUGERENCIAS,
  enlaces: [],
};

function IconoChat() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.8 8.8 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </svg>
  );
}

function IconoCerrar() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

// Color del borde según el tipo de respuesta. No cambia el contenido: es solo
// una pista visual para distinguir un listado de un aviso o de una negativa.
function bordePorTipo(tipo) {
  if (tipo === 'sin_datos') return 'border-amber-300';
  if (tipo === 'sin_permiso') return 'border-red-300';
  if (tipo === 'opciones') return 'border-sky-300';
  return 'border-teal-300';
}

function BloqueRespuesta({ respuesta, alElegir, alNavegar }) {
  return (
    <article
      className={`rounded-lg rounded-tl-none border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${bordePorTipo(
        respuesta.tipo,
      )}`}
    >
      <h3 className="text-sm font-semibold text-slate-800">{respuesta.titulo}</h3>
      {respuesta.resumen && <p className="mt-1 text-xs text-slate-600">{respuesta.resumen}</p>}

      {respuesta.secciones?.map((seccion) => (
        <section key={seccion.titulo} className="mt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {seccion.titulo}
          </h4>

          {seccion.items?.length > 0 && (
            <ul className="mt-1 space-y-1.5">
              {seccion.items.map((item, indice) => (
                <li key={`${item.etiqueta}-${indice}`} className="text-xs leading-snug">
                  <span className="font-medium text-slate-800">{item.etiqueta}: </span>
                  <span className="text-slate-700">{item.valor}</span>
                  {item.nota && <span className="mt-0.5 block text-slate-500">{item.nota}</span>}
                </li>
              ))}
            </ul>
          )}

          {seccion.nota && <p className="mt-1 text-xs text-slate-500">{seccion.nota}</p>}
        </section>
      ))}

      {respuesta.opciones?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {respuesta.opciones.map((opcion) => (
            <button
              key={opcion.mensaje}
              type="button"
              className="rounded-full border border-teal-300 bg-teal-50 px-2.5 py-1 text-left text-xs font-medium text-teal-900 hover:bg-teal-100"
              onClick={() => alElegir(opcion.mensaje)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}

      {respuesta.enlaces?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {respuesta.enlaces.map((enlace) => (
            <Link
              key={enlace.href}
              to={enlace.href}
              onClick={alNavegar}
              className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              {enlace.texto}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

// Chat flotante del asistente. La conversación vive solo en memoria del
// componente: al recargar o cerrar sesión no queda nada guardado.
export function AsistenteChat() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [mensajes, setMensajes] = useState([{ id: 0, autor: 'asistente', respuesta: BIENVENIDA }]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const siguienteId = useRef(1);
  const finDeLista = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;

    function alTeclear(evento) {
      if (evento.key === 'Escape') setAbierto(false);
    }

    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  useEffect(() => {
    finDeLista.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, cargando]);

  async function enviar(consulta) {
    const limpia = consulta.trim();
    if (limpia.length < 2 || cargando) return;

    setMensajes((previos) => [
      ...previos,
      { id: siguienteId.current++, autor: 'usuario', texto: limpia },
    ]);
    setTexto('');
    setError('');
    setCargando(true);

    try {
      const datos = await consultarAsistente(limpia);
      setMensajes((previos) => [
        ...previos,
        { id: siguienteId.current++, autor: 'asistente', respuesta: datos.respuesta },
      ]);
    } catch (fallo) {
      setError(fallo?.message ?? 'No se pudo consultar al asistente.');
    } finally {
      setCargando(false);
    }
  }

  function alEnviar(evento) {
    evento.preventDefault();
    enviar(texto);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-teal-900/20 transition-colors hover:bg-teal-800 print:hidden"
        onClick={() => setAbierto(true)}
        aria-label="Abrir asistente"
      >
        <IconoChat />
        Asistente
      </button>
    );
  }

  return (
    <section
      className="fixed bottom-6 right-6 z-50 flex max-h-[calc(100vh-3rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl print:hidden"
      aria-label="Asistente de consultas"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Asistente</h2>
          <p className="text-[11px] text-slate-500">Solo lectura · datos del sistema</p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar asistente"
        >
          <IconoCerrar />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {mensajes.map((mensaje) =>
          mensaje.autor === 'usuario' ? (
            <p
              key={mensaje.id}
              className="ml-auto w-fit max-w-[85%] rounded-lg rounded-tr-none bg-teal-700 px-3 py-2 text-xs text-white"
            >
              {mensaje.texto}
            </p>
          ) : (
            <BloqueRespuesta
              key={mensaje.id}
              respuesta={mensaje.respuesta}
              alElegir={enviar}
              alNavegar={() => setAbierto(false)}
            />
          ),
        )}

        {cargando && (
          <p role="status" className="text-xs text-slate-500">
            Consultando...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {error}
          </p>
        )}

        <div ref={finDeLista} />
      </div>

      <form onSubmit={alEnviar} className="border-t border-slate-200 bg-white p-3">
        <label htmlFor="consulta-asistente" className="sr-only">
          Consulta para el asistente
        </label>
        <div className="flex gap-2">
          <input
            id="consulta-asistente"
            autoFocus
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            placeholder="Ej.: vacunas de Firulais"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={cargando || texto.trim().length < 2}
          >
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
