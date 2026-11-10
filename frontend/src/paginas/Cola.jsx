import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  cambiarEstadoIngreso,
  decidirUrgencia,
  listarCola,
  marcarUrgenciaPosible,
  pasarAlConsultorio,
} from '../api/cola.js';
import { FormularioAltaRapida } from '../componentes/FormularioAltaRapida.jsx';
import { FormularioIngreso } from '../componentes/FormularioIngreso.jsx';
import { FormularioVisita } from '../componentes/FormularioVisita.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_SERVICIO,
  ETIQUETAS_URGENCIA,
  etiqueta,
} from '../utils/etiquetasCola.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const claseBotonAccion =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

function claseUrgencia(estado) {
  if (estado === 'confirmada') return 'bg-red-50 text-red-700';
  if (estado === 'posible') return 'bg-amber-50 text-amber-800';
  if (estado === 'descartada') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-500';
}

function claseEstado(estado) {
  if (estado === 'en_consulta') return 'bg-teal-50 text-teal-800';
  if (estado === 'esperando') return 'bg-sky-50 text-sky-800';
  if (estado === 'atendido') return 'bg-emerald-50 text-emerald-700';
  if (estado === 'sin_cerrar') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

export function Cola() {
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puede = (accion) => permisos.includes(accion);

  const [modalIngreso, setModalIngreso] = useState(false);
  const [modalAlta, setModalAlta] = useState(false);
  const [ingresoParaVisita, setIngresoParaVisita] = useState(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['cola'],
    queryFn: listarCola,
    refetchInterval: 30 * 1000,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['cola'] });
    queryClient.invalidateQueries({ queryKey: ['cola-sin-cerrar'] });
  }

  const marcarPosible = useMutation({ mutationFn: marcarUrgenciaPosible, onSuccess: invalidar });
  const decidir = useMutation({
    mutationFn: ({ id, decision }) => decidirUrgencia(id, decision),
    onSuccess: invalidar,
  });
  const alConsultorio = useMutation({ mutationFn: pasarAlConsultorio, onSuccess: invalidar });
  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }) => cambiarEstadoIngreso(id, estado),
    onSuccess: invalidar,
  });

  const ingresos = data?.ingresos ?? [];
  const errorAccion = [marcarPosible, decidir, alConsultorio, cambiarEstado].find(
    (mutacion) => mutacion.isError,
  )?.error;

  function accionesDe(ingreso) {
    const abierto = ['esperando', 'en_consulta'].includes(ingreso.estado);

    if (!abierto) {
      return <span className="text-slate-400">—</span>;
    }

    return (
      <div className="flex flex-wrap justify-end gap-1">
        {puede('visitas.crear') && (
          <button
            type="button"
            className={claseBotonAccion}
            onClick={() => setIngresoParaVisita(ingreso)}
          >
            Iniciar visita
          </button>
        )}

        {puede('cola.marcar_urgencia') &&
          ingreso.estado === 'esperando' &&
          ['sin_marca', 'descartada'].includes(ingreso.urgenciaEstado) && (
            <button
              type="button"
              className={claseBotonAccion}
              onClick={() => marcarPosible.mutate(ingreso.id)}
              disabled={marcarPosible.isPending}
            >
              Marcar urgencia
            </button>
          )}

        {puede('cola.confirmar_urgencia') &&
          ['posible', 'sin_marca'].includes(ingreso.urgenciaEstado) && (
            <button
              type="button"
              className={claseBotonAccion}
              onClick={() => decidir.mutate({ id: ingreso.id, decision: 'confirmada' })}
              disabled={decidir.isPending}
            >
              Confirmar urgencia
            </button>
          )}

        {puede('cola.confirmar_urgencia') && ingreso.urgenciaEstado === 'posible' && (
          <button
            type="button"
            className={claseBotonAccion}
            onClick={() => decidir.mutate({ id: ingreso.id, decision: 'descartada' })}
            disabled={decidir.isPending}
          >
            Descartar urgencia
          </button>
        )}

        {puede('cola.editar') && ingreso.estado === 'esperando' && (
          <button
            type="button"
            className={claseBotonAccion}
            onClick={() => alConsultorio.mutate(ingreso.id)}
            disabled={alConsultorio.isPending}
          >
            Al consultorio
          </button>
        )}

        {puede('cola.editar') && (
          <>
            <button
              type="button"
              className={claseBotonAccion}
              onClick={() => cambiarEstado.mutate({ id: ingreso.id, estado: 'atendido' })}
              disabled={cambiarEstado.isPending}
            >
              Atendido
            </button>
            <button
              type="button"
              className={claseBotonAccion}
              onClick={() => cambiarEstado.mutate({ id: ingreso.id, estado: 'se_retiro' })}
              disabled={cambiarEstado.isPending}
            >
              Se retiró
            </button>
            <button
              type="button"
              className={claseBotonAccion}
              onClick={() => cambiarEstado.mutate({ id: ingreso.id, estado: 'cancelado' })}
              disabled={cambiarEstado.isPending}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cola del día</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data?.fecha ? formatearFecha(data.fecha) : 'Cargando fecha...'} · {ingresos.length}{' '}
            ingreso{ingresos.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/cola/sin-cerrar"
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Ingresos sin cerrar
          </Link>

          {puede('cola.crear') && (
            <button
              type="button"
              className="rounded border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50"
              onClick={() => setModalIngreso(true)}
            >
              Agregar paciente
            </button>
          )}

          {puede('pacientes.alta_rapida') && puede('cola.crear') && (
            <button
              type="button"
              className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => setModalAlta(true)}
            >
              Alta rápida
            </button>
          )}
        </div>
      </div>

      {errorAccion && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorAccion.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Nº</th>
              <th className="px-3 py-3">Paciente</th>
              <th className="px-3 py-3">Dueño</th>
              <th className="px-3 py-3">Especie</th>
              <th className="px-3 py-3">Servicio</th>
              <th className="px-3 py-3">Urgencia</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Llegada</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isPending && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Cargando la cola...
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-red-700" role="alert">
                  No se pudo cargar la cola: {error.message}
                </td>
              </tr>
            )}

            {!isPending && !isError && ingresos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  Todavía no hay ingresos en la cola de hoy.
                </td>
              </tr>
            )}

            {ingresos.map((ingreso) => (
              <tr key={ingreso.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium text-slate-700">{ingreso.numeroOrden}</td>
                <td className="px-3 py-3">
                  <Link
                    to={`/pacientes/${ingreso.paciente.id}`}
                    className="font-medium text-teal-800 hover:underline"
                  >
                    {ingreso.paciente.nombre}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {ingreso.paciente.codigoInterno}
                    {ingreso.paciente.provisorio && (
                      <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">
                        provisorio
                      </span>
                    )}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Link
                    to={`/clientes/${ingreso.cliente.id}`}
                    className="text-slate-800 hover:underline"
                  >
                    {ingreso.cliente.nombreCompleto}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {ingreso.cliente.telefonoPrincipal ?? 'Sin teléfono'}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-600">{ingreso.paciente.especieNombre}</td>
                <td className="px-3 py-3 text-slate-600">
                  {etiqueta(ETIQUETAS_SERVICIO, ingreso.servicio)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      claseUrgencia(ingreso.urgenciaEstado),
                    ].join(' ')}
                  >
                    {etiqueta(ETIQUETAS_URGENCIA, ingreso.urgenciaEstado)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      claseEstado(ingreso.estado),
                    ].join(' ')}
                  >
                    {etiqueta(ETIQUETAS_ESTADO, ingreso.estado)}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatearHora(ingreso.horaLlegada)}</td>
                <td className="px-3 py-3 text-right">{accionesDe(ingreso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={modalIngreso}
        titulo="Agregar paciente a la cola"
        onCerrar={() => setModalIngreso(false)}
      >
        <FormularioIngreso
          onCreado={() => {
            setModalIngreso(false);
            invalidar();
          }}
          onCancelar={() => setModalIngreso(false)}
        />
      </Modal>

      <Modal
        abierto={modalAlta}
        titulo="Alta rápida de urgencia"
        onCerrar={() => setModalAlta(false)}
      >
        <FormularioAltaRapida
          puedeConfirmar={puede('cola.confirmar_urgencia')}
          onCreado={() => {
            setModalAlta(false);
            invalidar();
          }}
          onCancelar={() => setModalAlta(false)}
        />
      </Modal>

      <Modal
        abierto={Boolean(ingresoParaVisita)}
        titulo="Iniciar visita"
        onCerrar={() => setIngresoParaVisita(null)}
      >
        {ingresoParaVisita && (
          <FormularioVisita
            paciente={ingresoParaVisita.paciente}
            ingresoId={ingresoParaVisita.id}
            onGuardada={(visita) => {
              setIngresoParaVisita(null);
              invalidar();
              queryClient.invalidateQueries({
                queryKey: ['paciente', ingresoParaVisita.paciente.id],
              });
              navegar(`/visitas/${visita.id}`);
            }}
            onCancelar={() => setIngresoParaVisita(null)}
          />
        )}
      </Modal>
    </section>
  );
}
