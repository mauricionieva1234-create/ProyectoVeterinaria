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
import { MenuAcciones } from '../componentes/MenuAcciones.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezado, claseBotonEncabezadoSolido } from '../componentes/tonos.js';
import { useSesion } from '../hooks/useSesion.js';
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_SERVICIO,
  ETIQUETAS_URGENCIA,
  etiqueta,
} from '../utils/etiquetasCola.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

// La celda de acciones muestra una sola acción principal; el resto vive en el
// menú «⋯» para que la tabla quede liviana.
const baseBotonAccion =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50';

const claseBotonPrimario = `${baseBotonAccion} bg-teal-700 text-white shadow-sm hover:bg-teal-800`;

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

    const puedeIniciarVisita = puede('visitas.crear');
    const puedeConsultorio = puede('cola.editar') && ingreso.estado === 'esperando';

    // Si el usuario puede iniciar la visita, esa es la acción principal; si no,
    // el pase al consultorio ocupa ese lugar. El resto se va al menú.
    const primario = puedeIniciarVisita
      ? { etiqueta: 'Iniciar visita', onClick: () => setIngresoParaVisita(ingreso) }
      : puedeConsultorio
        ? {
            etiqueta: 'Al consultorio',
            onClick: () => alConsultorio.mutate(ingreso.id),
            deshabilitado: alConsultorio.isPending,
          }
        : null;

    const urgencia = [];

    if (
      puede('cola.marcar_urgencia') &&
      ingreso.estado === 'esperando' &&
      ['sin_marca', 'descartada'].includes(ingreso.urgenciaEstado)
    ) {
      urgencia.push({
        etiqueta: 'Marcar urgencia',
        tono: 'urgencia',
        onClick: () => marcarPosible.mutate(ingreso.id),
        deshabilitado: marcarPosible.isPending,
      });
    }

    if (
      puede('cola.confirmar_urgencia') &&
      ['posible', 'sin_marca'].includes(ingreso.urgenciaEstado)
    ) {
      urgencia.push({
        etiqueta: 'Confirmar urgencia',
        tono: 'peligro',
        onClick: () => decidir.mutate({ id: ingreso.id, decision: 'confirmada' }),
        deshabilitado: decidir.isPending,
      });
    }

    if (puede('cola.confirmar_urgencia') && ingreso.urgenciaEstado === 'posible') {
      urgencia.push({
        etiqueta: 'Descartar urgencia',
        onClick: () => decidir.mutate({ id: ingreso.id, decision: 'descartada' }),
        deshabilitado: decidir.isPending,
      });
    }

    const atencion = [];

    if (puedeConsultorio && primario?.etiqueta !== 'Al consultorio') {
      atencion.push({
        etiqueta: 'Al consultorio',
        onClick: () => alConsultorio.mutate(ingreso.id),
        deshabilitado: alConsultorio.isPending,
      });
    }

    const cierre = [];

    if (puede('cola.editar')) {
      cierre.push(
        {
          etiqueta: 'Atendido',
          tono: 'exito',
          onClick: () => cambiarEstado.mutate({ id: ingreso.id, estado: 'atendido' }),
          deshabilitado: cambiarEstado.isPending,
        },
        {
          etiqueta: 'Se retiró',
          onClick: () => cambiarEstado.mutate({ id: ingreso.id, estado: 'se_retiro' }),
          deshabilitado: cambiarEstado.isPending,
        },
        {
          etiqueta: 'Cancelar',
          tono: 'peligro',
          onClick: () => cambiarEstado.mutate({ id: ingreso.id, estado: 'cancelado' }),
          deshabilitado: cambiarEstado.isPending,
        },
      );
    }

    const grupos = [urgencia, atencion, cierre].filter((grupo) => grupo.length > 0);
    const acciones = grupos.flatMap((grupo, indice) =>
      indice === 0 ? grupo : [{ separador: true }, ...grupo],
    );

    return (
      <div className="flex items-center justify-end gap-1.5">
        {primario && (
          <button
            type="button"
            className={claseBotonPrimario}
            onClick={primario.onClick}
            disabled={primario.deshabilitado}
          >
            {primario.etiqueta}
          </button>
        )}

        {acciones.length > 0 && <MenuAcciones acciones={acciones} />}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <EncabezadoPagina
        tono="amber"
        titulo="Cola del día"
        descripcion={
          <>
            {data?.fecha ? formatearFecha(data.fecha) : 'Cargando fecha...'} · {ingresos.length}{' '}
            ingreso{ingresos.length === 1 ? '' : 's'}
          </>
        }
      >
        <Link to="/cola/sin-cerrar" className={claseBotonEncabezado}>
          Ingresos sin cerrar
        </Link>

        {puede('cola.crear') && (
          <button
            type="button"
            className={claseBotonEncabezado}
            onClick={() => setModalIngreso(true)}
          >
            Agregar paciente
          </button>
        )}

        {puede('pacientes.alta_rapida') && puede('cola.crear') && (
          <button
            type="button"
            className={claseBotonEncabezadoSolido}
            onClick={() => setModalAlta(true)}
          >
            Alta rápida
          </button>
        )}
      </EncabezadoPagina>

      {errorAccion && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {errorAccion.message}
        </p>
      )}

      <Panel tono="amber" titulo="Ingresos del día" cuerpoClassName="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-amber-100/70 text-left text-xs uppercase tracking-wide text-amber-900">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Nº</th>
                <th className="px-3 py-3">Paciente</th>
                <th className="px-3 py-3">Dueño</th>
                <th className="hidden px-3 py-3 whitespace-nowrap lg:table-cell">Especie</th>
                <th className="hidden px-3 py-3 whitespace-nowrap lg:table-cell">Servicio</th>
                <th className="px-3 py-3 whitespace-nowrap">Urgencia</th>
                <th className="px-3 py-3 whitespace-nowrap">Estado</th>
                <th className="px-3 py-3 whitespace-nowrap">Llegada</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Acciones</th>
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
                  <td className="hidden px-3 py-3 text-slate-600 lg:table-cell">
                    {ingreso.paciente.especieNombre}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-600 lg:table-cell">
                    {etiqueta(ETIQUETAS_SERVICIO, ingreso.servicio)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        claseUrgencia(ingreso.urgenciaEstado),
                      ].join(' ')}
                    >
                      {etiqueta(ETIQUETAS_URGENCIA, ingreso.urgenciaEstado)}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        claseEstado(ingreso.estado),
                      ].join(' ')}
                    >
                      {etiqueta(ETIQUETAS_ESTADO, ingreso.estado)}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                    {formatearHora(ingreso.horaLlegada)}
                  </td>
                  <td className="px-3 py-3 text-right">{accionesDe(ingreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

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
