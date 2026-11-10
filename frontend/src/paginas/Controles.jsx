import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  anularControl,
  cambiarEstadoControl,
  listarAvisos,
  listarControles,
  listarRecordatorios,
} from '../api/controles.js';
import { FormularioAnular } from '../componentes/FormularioAnular.jsx';
import { FormularioAviso } from '../componentes/FormularioAviso.jsx';
import { FormularioControl } from '../componentes/FormularioControl.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_CANAL_AVISO,
  ETIQUETAS_ESTADO_CONTROL,
  ETIQUETAS_FRANJA,
  ETIQUETAS_RESULTADO_AVISO,
  etiqueta,
} from '../utils/etiquetasClinicas.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const claseBoton =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

function ETabla({ controles, vacio, puedeGestionar, onAvisos, onReprogramar, onCerrar, onAnular }) {
  if (controles.length === 0) {
    return <p className="px-3 py-4 text-sm text-slate-500">{vacio}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Franja</th>
            <th className="px-3 py-2">Paciente</th>
            <th className="px-3 py-2">Dueño y teléfono</th>
            <th className="px-3 py-2">Motivo</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Último aviso</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {controles.map((control) => (
            <tr key={control.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                {formatearFecha(control.fechaControl)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {etiqueta(ETIQUETAS_FRANJA, control.franja)}
              </td>
              <td className="px-3 py-2">
                <Link
                  to={`/pacientes/${control.paciente.id}`}
                  className="font-medium text-teal-800 hover:underline"
                >
                  {control.paciente.nombre}
                </Link>
                <p className="text-xs text-slate-500">
                  {control.paciente.codigoInterno} · {control.paciente.especieNombre}
                </p>
              </td>
              <td className="px-3 py-2 text-slate-700">
                {control.cliente.nombreCompleto}
                <p className="text-xs text-slate-500">
                  {control.cliente.telefonoPrincipal ?? 'Sin teléfono'}
                </p>
              </td>
              <td className="px-3 py-2 text-slate-600">{control.motivo ?? '—'}</td>
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
              <td className="px-3 py-2 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <button type="button" className={claseBoton} onClick={() => onAvisos(control)}>
                    Avisos
                  </button>

                  {puedeGestionar && ['pendiente', 'ausente'].includes(control.estado) && (
                    <>
                      <button
                        type="button"
                        className={claseBoton}
                        onClick={() => onReprogramar(control)}
                      >
                        Reprogramar
                      </button>
                      <button
                        type="button"
                        className={claseBoton}
                        onClick={() => onCerrar(control, 'realizado')}
                      >
                        Realizado
                      </button>
                      <button
                        type="button"
                        className={claseBoton}
                        onClick={() => onCerrar(control, 'cancelado')}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className={claseBoton}
                        onClick={() => onAnular(control)}
                      >
                        Anular
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AvisosDeControl({ control }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['avisos', control.id],
    queryFn: () => listarAvisos(control.id),
  });

  if (isPending) return <p className="text-sm text-slate-600">Cargando avisos...</p>;
  if (isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        No se pudieron cargar los avisos: {error.message}
      </p>
    );
  }

  const avisos = data?.avisos ?? [];

  if (avisos.length === 0) {
    return <p className="text-sm text-slate-500">Todavía no hay avisos registrados.</p>;
  }

  return (
    <ul className="space-y-2">
      {avisos.map((aviso) => (
        <li
          key={aviso.id}
          className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        >
          <p className="text-slate-800">
            {etiqueta(ETIQUETAS_CANAL_AVISO, aviso.canal)} ·{' '}
            {etiqueta(ETIQUETAS_RESULTADO_AVISO, aviso.resultado)}
          </p>
          {aviso.nota && <p className="text-slate-600">{aviso.nota}</p>}
          <p className="mt-1 text-xs text-slate-500">
            {aviso.realizadoPorNombre ?? '—'} · {formatearFecha(aviso.realizadoEn)}{' '}
            {formatearHora(aviso.realizadoEn)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Controles() {
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puedeAvisos = permisos.includes('avisos.crear');
  const puedeGestionar = permisos.includes('controles.editar');

  const [controlAviso, setControlAviso] = useState(null);
  const [controlReprogramar, setControlReprogramar] = useState(null);
  const [controlParaAnular, setControlParaAnular] = useState(null);
  const [errorLocal, setErrorLocal] = useState(null);

  const recordatorios = useQuery({
    queryKey: ['controles', 'recordar'],
    queryFn: listarRecordatorios,
  });

  const vencidos = useQuery({
    queryKey: ['controles', 'ausentes'],
    queryFn: () => listarControles({ estado: 'ausente', limite: 50 }),
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['controles'] });
  }

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) => cambiarEstadoControl(id, { estado }),
    onSuccess: invalidar,
    onError: (error) => setErrorLocal(error.message),
  });

  const anular = useMutation({
    mutationFn: ({ id, motivo }) => anularControl(id, { motivo }),
    onSuccess: () => {
      invalidar();
      setControlParaAnular(null);
    },
  });

  function cerrarControl(control, estado) {
    setErrorLocal(null);
    cambiarEstado.mutate({ id: control.id, estado });
  }

  const hoy = recordatorios.data?.hoy ?? [];
  const manana = recordatorios.data?.manana ?? [];
  const atrasados = vencidos.data?.datos ?? [];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Controles</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Recordatorios de hoy y de mañana, y controles vencidos para volver a contactar.
        </p>
      </div>

      {errorLocal && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorLocal}
        </p>
      )}

      {recordatorios.isPending && <p className="text-sm text-slate-600">Cargando controles...</p>}

      {recordatorios.isError && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          No se pudieron cargar los recordatorios: {recordatorios.error.message}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Hoy</h2>
        </div>
        <ETabla
          controles={hoy}
          vacio="No hay controles agendados para hoy."
          puedeGestionar={puedeGestionar}
          onAvisos={setControlAviso}
          onReprogramar={setControlReprogramar}
          onCerrar={cerrarControl}
          onAnular={setControlParaAnular}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Mañana</h2>
        </div>
        <ETabla
          controles={manana}
          vacio="No hay controles agendados para mañana."
          puedeGestionar={puedeGestionar}
          onAvisos={setControlAviso}
          onReprogramar={setControlReprogramar}
          onCerrar={cerrarControl}
          onAnular={setControlParaAnular}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Vencidos para contactar</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Controles pendientes de días anteriores que quedaron como ausentes.
          </p>
        </div>
        {vencidos.isPending && <p className="px-3 py-4 text-sm text-slate-600">Cargando...</p>}
        {vencidos.isError && (
          <p className="px-3 py-4 text-sm text-red-700" role="alert">
            No se pudieron cargar los vencidos: {vencidos.error.message}
          </p>
        )}
        {!vencidos.isPending && !vencidos.isError && (
          <ETabla
            controles={atrasados}
            vacio="No hay controles vencidos."
            puedeGestionar={puedeGestionar}
            onAvisos={setControlAviso}
            onReprogramar={setControlReprogramar}
            onCerrar={cerrarControl}
            onAnular={setControlParaAnular}
          />
        )}
      </div>

      <Modal
        abierto={Boolean(controlAviso)}
        titulo="Avisos del control"
        onCerrar={() => setControlAviso(null)}
      >
        {controlAviso && (
          <div className="space-y-4">
            <AvisosDeControl control={controlAviso} />
            {puedeAvisos && (
              <FormularioAviso
                control={controlAviso}
                onGuardado={() => setControlAviso(null)}
                onCancelar={() => setControlAviso(null)}
              />
            )}
          </div>
        )}
      </Modal>

      <Modal
        abierto={Boolean(controlReprogramar)}
        titulo="Reprogramar control"
        onCerrar={() => setControlReprogramar(null)}
      >
        {controlReprogramar && (
          <FormularioControl
            control={controlReprogramar}
            onGuardado={() => setControlReprogramar(null)}
            onCancelar={() => setControlReprogramar(null)}
          />
        )}
      </Modal>

      <Modal
        abierto={Boolean(controlParaAnular)}
        titulo="Anular control"
        onCerrar={() => setControlParaAnular(null)}
      >
        <FormularioAnular
          entidad="control"
          onAnular={(motivo) => anular.mutate({ id: controlParaAnular.id, motivo })}
          onCancelar={() => setControlParaAnular(null)}
          pendiente={anular.isPending}
          error={anular.error}
        />
      </Modal>
    </section>
  );
}
