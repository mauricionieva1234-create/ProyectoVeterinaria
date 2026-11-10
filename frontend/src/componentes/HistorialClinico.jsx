import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { anularRegistro, listarRegistros } from '../api/registros.js';
import { listarVisitas } from '../api/visitas.js';
import { listarControles } from '../api/controles.js';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_ESTADO_CONTROL,
  ETIQUETAS_ESTADO_REGISTRO,
  ETIQUETAS_ESTADO_VISITA,
  ETIQUETAS_FRANJA,
  ETIQUETAS_RESULTADO_AVISO,
  ETIQUETAS_TIPO_ANTIPARASITARIO,
  ETIQUETAS_TIPO_REGISTRO,
  etiqueta,
} from '../utils/etiquetasClinicas.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';
import { FormularioAnular } from './FormularioAnular.jsx';
import { FormularioRegistro } from './FormularioRegistro.jsx';
import { ListaAdjuntos } from './ListaAdjuntos.jsx';
import { Modal } from './Modal.jsx';
import { SubirAdjunto } from './SubirAdjunto.jsx';

const claseBoton =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

const claseTab = (activo) =>
  [
    'rounded-t border-b-2 px-3 py-2 text-sm',
    activo
      ? 'border-indigo-600 bg-white/60 font-medium text-indigo-800'
      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
  ].join(' ');

const CLAVES_REGISTRO = {
  vacuna: 'vacunas',
  antiparasitario: 'antiparasitarios',
  estudio: 'estudios',
  cirugia: 'cirugias',
};

function Vacio({ children }) {
  return <p className="px-3 py-6 text-center text-sm text-slate-500">{children}</p>;
}

function EstadoVisita({ estado, anulado }) {
  if (anulado) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Anulada
      </span>
    );
  }

  const clase =
    estado === 'borrador'
      ? 'bg-amber-50 text-amber-800'
      : estado === 'corregida'
        ? 'bg-sky-50 text-sky-800'
        : 'bg-emerald-50 text-emerald-700';

  return (
    <span className={['rounded-full px-2 py-0.5 text-xs font-medium', clase].join(' ')}>
      {etiqueta(ETIQUETAS_ESTADO_VISITA, estado)}
    </span>
  );
}

function PanelVisitas({ pacienteId }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['visitas', 'paciente', pacienteId],
    queryFn: () => listarVisitas({ pacienteId, limite: 20 }),
  });

  if (isPending) return <Vacio>Cargando visitas...</Vacio>;
  if (isError) {
    return (
      <p className="px-3 py-4 text-sm text-red-700" role="alert">
        No se pudieron cargar las visitas: {error.message}
      </p>
    );
  }

  const visitas = data?.datos ?? [];

  if (visitas.length === 0) return <Vacio>Todavía no hay visitas registradas.</Vacio>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Motivo</th>
            <th className="px-3 py-2">Veterinario</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visitas.map((visita) => (
            <tr key={visita.id}>
              <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                {formatearFecha(visita.inicioEn)} {formatearHora(visita.inicioEn)}
              </td>
              <td className="px-3 py-2 text-slate-800">{visita.motivoConsulta ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600">{visita.veterinarioNombre ?? '—'}</td>
              <td className="px-3 py-2">
                <EstadoVisita estado={visita.estado} anulado={visita.anulado} />
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  to={`/visitas/${visita.id}`}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function celdasRegistro(tipo, registro) {
  if (tipo === 'vacuna') {
    return [
      registro.vacuna,
      registro.lote ?? '—',
      formatearFecha(registro.fechaAplicacion),
      registro.fechaProximaDosis ? formatearFecha(registro.fechaProximaDosis) : '—',
      registro.aplicadaPorNombre ?? '—',
    ];
  }

  if (tipo === 'antiparasitario') {
    return [
      registro.producto,
      etiqueta(ETIQUETAS_TIPO_ANTIPARASITARIO, registro.tipoProducto),
      registro.dosis ?? '—',
      formatearFecha(registro.fechaAplicacion),
      registro.fechaProxima ? formatearFecha(registro.fechaProxima) : '—',
      registro.aplicadoPorNombre ?? '—',
    ];
  }

  if (tipo === 'estudio') {
    return [
      registro.tipoEstudio,
      formatearFecha(registro.fechaPedido),
      etiqueta(ETIQUETAS_ESTADO_REGISTRO, registro.estado),
      registro.fechaResultado ? formatearFecha(registro.fechaResultado) : '—',
      registro.resultadoResumen ?? '—',
    ];
  }

  return [
    registro.tipoCirugia,
    registro.fechaProgramada ? formatearFecha(registro.fechaProgramada) : '—',
    etiqueta(ETIQUETAS_ESTADO_REGISTRO, registro.estado),
    registro.cirujanoNombre ?? '—',
    registro.notasPostoperatorio ?? '—',
  ];
}

function encabezadosRegistro(tipo) {
  if (tipo === 'vacuna') {
    return ['Vacuna', 'Lote', 'Aplicada', 'Próxima dosis', 'Aplicada por'];
  }

  if (tipo === 'antiparasitario') {
    return ['Producto', 'Tipo', 'Dosis', 'Aplicado', 'Próxima', 'Aplicado por'];
  }

  if (tipo === 'estudio') {
    return ['Estudio', 'Pedido', 'Estado', 'Resultado', 'Resumen'];
  }

  return ['Cirugía', 'Fecha', 'Estado', 'Cirujano', 'Notas'];
}

function PanelRegistros({ pacienteId, tipo }) {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puedeCrear = permisos.includes('registros.crear');
  const puedeEditar = permisos.includes('registros.editar');
  const puedeAnular = permisos.includes('registros.anular');

  const [modalFormulario, setModalFormulario] = useState(false);
  const [registroEnEdicion, setRegistroEnEdicion] = useState(null);
  const [paraAnular, setParaAnular] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['registros', pacienteId],
    queryFn: () => listarRegistros(pacienteId),
  });

  const anular = useMutation({
    mutationFn: ({ id, motivo }) => anularRegistro(tipo, id, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros', pacienteId] });
      setParaAnular(null);
    },
  });

  const registros = data?.[CLAVES_REGISTRO[tipo]] ?? [];
  const columnas = encabezadosRegistro(tipo);

  function abrirAlta() {
    setRegistroEnEdicion(null);
    setModalFormulario(true);
  }

  function abrirEdicion(registro) {
    setRegistroEnEdicion(registro);
    setModalFormulario(true);
  }

  function cerrarFormulario() {
    setModalFormulario(false);
    setRegistroEnEdicion(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {registros.length} registro{registros.length === 1 ? '' : 's'} de{' '}
          {etiqueta(ETIQUETAS_TIPO_REGISTRO, tipo).toLowerCase()}.
        </p>
        {puedeCrear && (
          <button
            type="button"
            className="rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            onClick={abrirAlta}
          >
            Nuevo registro
          </button>
        )}
      </div>

      {isPending && <Vacio>Cargando registros...</Vacio>}

      {isError && (
        <p className="px-3 py-4 text-sm text-red-700" role="alert">
          No se pudieron cargar los registros: {error.message}
        </p>
      )}

      {!isPending && !isError && registros.length === 0 && (
        <Vacio>No hay registros de este tipo.</Vacio>
      )}

      {!isPending && !isError && registros.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columnas.map((columna) => (
                  <th key={columna} className="px-3 py-2">
                    {columna}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((registro) => (
                <tr key={registro.id} className={registro.anulado ? 'opacity-60' : ''}>
                  {celdasRegistro(tipo, registro).map((celda, indice) => (
                    <td key={indice} className="px-3 py-2 text-slate-700">
                      {celda}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {registro.anulado ? (
                      <span className="text-xs text-red-700">Anulado</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        {puedeEditar && (
                          <button
                            type="button"
                            className={claseBoton}
                            onClick={() => abrirEdicion(registro)}
                          >
                            Editar
                          </button>
                        )}
                        {puedeAnular && (
                          <button
                            type="button"
                            className={claseBoton}
                            onClick={() => setParaAnular(registro)}
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        abierto={modalFormulario}
        titulo={registroEnEdicion ? 'Editar registro' : 'Nuevo registro'}
        onCerrar={cerrarFormulario}
      >
        <FormularioRegistro
          tipo={tipo}
          registro={registroEnEdicion}
          pacienteId={pacienteId}
          onGuardado={cerrarFormulario}
          onCancelar={cerrarFormulario}
        />
      </Modal>

      <Modal
        abierto={Boolean(paraAnular)}
        titulo="Anular registro"
        onCerrar={() => setParaAnular(null)}
      >
        <FormularioAnular
          entidad="registro"
          onAnular={(motivo) => anular.mutate({ id: paraAnular.id, motivo })}
          onCancelar={() => setParaAnular(null)}
          pendiente={anular.isPending}
          error={anular.error}
        />
      </Modal>
    </div>
  );
}

function PanelControles({ pacienteId }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['controles', 'paciente', pacienteId],
    queryFn: () => listarControles({ pacienteId, limite: 20 }),
  });

  if (isPending) return <Vacio>Cargando controles...</Vacio>;
  if (isError) {
    return (
      <p className="px-3 py-4 text-sm text-red-700" role="alert">
        No se pudieron cargar los controles: {error.message}
      </p>
    );
  }

  const controles = data?.datos ?? [];

  if (controles.length === 0) return <Vacio>No hay controles agendados.</Vacio>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Franja</th>
            <th className="px-3 py-2">Motivo</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Último aviso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {controles.map((control) => (
            <tr key={control.id}>
              <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                {formatearFecha(control.fechaControl)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {etiqueta(ETIQUETAS_FRANJA, control.franja)}
              </td>
              <td className="px-3 py-2 text-slate-700">{control.motivo ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600">
                {etiqueta(ETIQUETAS_ESTADO_CONTROL, control.estado)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {control.ultimoAviso
                  ? `${formatearFecha(control.ultimoAviso.realizadoEn)} · ${etiqueta(
                      ETIQUETAS_RESULTADO_AVISO,
                      control.ultimoAviso.resultado,
                    )}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelAdjuntos({ pacienteId }) {
  const { data: sesion } = useSesion();
  const puedeCrear = (sesion?.permisos ?? []).includes('adjuntos.crear');

  return (
    <div className="space-y-3">
      {puedeCrear && <SubirAdjunto pacienteId={pacienteId} />}
      <ListaAdjuntos pacienteId={pacienteId} />
    </div>
  );
}

// Historial clínico con pestañas. Recepción solo ve controles y adjuntos;
// veterinario y admin ven además visitas y los cuatro tipos de registro.
export function HistorialClinico({ pacienteId }) {
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];

  const tabs = [
    { id: 'visitas', etiqueta: 'Visitas', visible: permisos.includes('visitas.ver') },
    ...['vacuna', 'antiparasitario', 'estudio', 'cirugia'].map((tipo) => ({
      id: tipo,
      etiqueta: ETIQUETAS_TIPO_REGISTRO[tipo],
      visible: permisos.includes('registros.ver'),
    })),
    { id: 'controles', etiqueta: 'Controles', visible: permisos.includes('controles.ver') },
    { id: 'adjuntos', etiqueta: 'Adjuntos', visible: permisos.includes('adjuntos.ver') },
  ].filter((tab) => tab.visible);

  const [tabElegida, setTabElegida] = useState('visitas');
  const activa = tabs.some((tab) => tab.id === tabElegida) ? tabElegida : tabs[0]?.id;

  if (tabs.length === 0) {
    return (
      <p className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-6 text-sm text-slate-500">
        No tenés acceso al historial clínico de este paciente.
      </p>
    );
  }

  return (
    <section className="space-y-3 overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/70 shadow-sm">
      <div className="border-b border-indigo-200 bg-white/70 px-4 pt-2 backdrop-blur-sm">
        <h2 className="pt-2 text-lg font-semibold tracking-tight text-indigo-950">
          Historial clínico
        </h2>
        <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Historial clínico">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activa === tab.id}
              className={claseTab(activa === tab.id)}
              onClick={() => setTabElegida(tab.id)}
            >
              {tab.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="p-2" role="tabpanel">
        {activa === 'visitas' && <PanelVisitas pacienteId={pacienteId} />}
        {['vacuna', 'antiparasitario', 'estudio', 'cirugia'].includes(activa) && (
          <PanelRegistros pacienteId={pacienteId} tipo={activa} />
        )}
        {activa === 'controles' && <PanelControles pacienteId={pacienteId} />}
        {activa === 'adjuntos' && <PanelAdjuntos pacienteId={pacienteId} />}
      </div>
    </section>
  );
}
