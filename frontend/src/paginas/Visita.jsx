import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  agregarNotaVisita,
  anularMedicacion,
  anularVisita,
  obtenerVisita,
} from '../api/visitas.js';
import { FormularioAnular } from '../componentes/FormularioAnular.jsx';
import { FormularioControl } from '../componentes/FormularioControl.jsx';
import { FormularioMedicacion } from '../componentes/FormularioMedicacion.jsx';
import { FormularioVisita } from '../componentes/FormularioVisita.jsx';
import { ListaAdjuntos } from '../componentes/ListaAdjuntos.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezado } from '../componentes/tonos.js';
import { SubirAdjunto } from '../componentes/SubirAdjunto.jsx';
import { useSesion } from '../hooks/useSesion.js';
import { ETIQUETAS_ESTADO_VISITA, etiqueta } from '../utils/etiquetasClinicas.js';
import { formatearFecha, formatearHora } from '../utils/formato.js';

const claseBoton =
  'rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50';

const claseBotonPrincipal =
  'rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60';

function Dato({ etiqueta: nombre, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{nombre}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function EstadoVisita({ visita }) {
  if (visita.anulado) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Anulada
      </span>
    );
  }

  const clase =
    visita.estado === 'borrador'
      ? 'bg-amber-50 text-amber-800'
      : visita.estado === 'corregida'
        ? 'bg-sky-50 text-sky-800'
        : 'bg-emerald-50 text-emerald-700';

  return (
    <span className={['rounded-full px-2 py-0.5 text-xs font-medium', clase].join(' ')}>
      {etiqueta(ETIQUETAS_ESTADO_VISITA, visita.estado)}
    </span>
  );
}

export function Visita() {
  const { id } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puedeEditar = permisos.includes('visitas.editar');
  const puedeAnular = permisos.includes('visitas.anular');

  const [modalMedicacion, setModalMedicacion] = useState(false);
  const [medicacionEnEdicion, setMedicacionEnEdicion] = useState(null);
  const [medicacionParaAnular, setMedicacionParaAnular] = useState(null);
  const [modalControl, setModalControl] = useState(false);
  const [modalAnular, setModalAnular] = useState(false);
  const [nota, setNota] = useState('');

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['visita', id],
    queryFn: () => obtenerVisita(id),
  });

  const anularMed = useMutation({
    mutationFn: ({ medicacionId, motivo }) => anularMedicacion(id, medicacionId, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visita', id] });
      setMedicacionParaAnular(null);
    },
  });

  const anular = useMutation({
    mutationFn: (motivo) => anularVisita(id, { motivo }),
    onSuccess: (datos) => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      navegar(`/pacientes/${datos.visita.pacienteId}`);
    },
  });

  const agregarNota = useMutation({
    mutationFn: (texto) => agregarNotaVisita(id, { texto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visita', id] });
      setNota('');
    },
  });

  if (isPending) {
    return (
      <p className="text-slate-600" role="status">
        Cargando visita...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
          No se pudo cargar la visita: {error.message}
        </p>
        <Link to="/visitas" className="text-sm text-teal-800 hover:underline">
          Volver a visitas
        </Link>
      </div>
    );
  }

  const visita = data.visita;
  const medicacion = visita.medicacion ?? [];
  const notas = visita.notas ?? [];
  const versiones = visita.versiones ?? [];
  const cerrada = visita.estado !== 'borrador';

  function abrirNuevaMedicacion() {
    setMedicacionEnEdicion(null);
    setModalMedicacion(true);
  }

  function abrirEdicionMedicacion(item) {
    setMedicacionEnEdicion(item);
    setModalMedicacion(true);
  }

  function cerrarMedicacion() {
    setModalMedicacion(false);
    setMedicacionEnEdicion(null);
  }

  function alAgregarNota(evento) {
    evento.preventDefault();
    if (nota.trim().length === 0) return;
    agregarNota.mutate(nota.trim());
  }

  return (
    <section className="space-y-5">
      <Link
        to={`/pacientes/${visita.paciente.id}`}
        className="text-sm font-medium text-indigo-800 hover:underline"
      >
        ← Volver a la ficha del paciente
      </Link>
      <EncabezadoPagina
        tono="indigo"
        titulo={`Visita de ${visita.paciente.nombre}`}
        descripcion={
          <>
            <span className="font-mono text-xs">{visita.paciente.codigoInterno}</span>
            <span className="ml-2 inline-block align-middle">
              <EstadoVisita visita={visita} />
            </span>
          </>
        }
      >
        {puedeAnular && !visita.anulado && (
          <button
            type="button"
            className={claseBotonEncabezado}
            onClick={() => setModalAnular(true)}
          >
            Anular visita
          </button>
        )}
      </EncabezadoPagina>

      <Panel tono="indigo" cuerpoClassName="p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Dueño">
            <Link to={`/clientes/${visita.cliente.id}`} className="text-teal-800 hover:underline">
              {visita.cliente.nombreCompleto}
            </Link>
          </Dato>
          <Dato etiqueta="Teléfono">{visita.cliente.telefonoPrincipal ?? '—'}</Dato>
          <Dato etiqueta="Veterinario">{visita.veterinarioNombre ?? '—'}</Dato>
          <Dato etiqueta="Ingreso">
            {visita.ingreso
              ? `Nº ${visita.ingreso.numeroOrden} · ${formatearFecha(visita.ingreso.fechaDia)}`
              : 'Sin ingreso asociado'}
          </Dato>
          <Dato etiqueta="Inicio">
            {formatearFecha(visita.inicioEn)} {formatearHora(visita.inicioEn)}
          </Dato>
          <Dato etiqueta="Cierre">
            {visita.cierreEn
              ? `${formatearFecha(visita.cierreEn)} ${formatearHora(visita.cierreEn)}`
              : 'Sin cerrar'}
          </Dato>
          <Dato etiqueta="Última edición">
            {formatearFecha(visita.actualizadoEn)} {formatearHora(visita.actualizadoEn)}
          </Dato>
          {visita.anulado && (
            <Dato etiqueta="Motivo de anulación">{visita.motivoAnulacion ?? '—'}</Dato>
          )}
        </dl>
      </Panel>

      {visita.ingreso?.estado === 'esperando_cobro' && !visita.anulado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <p className="font-medium">Pendiente de cobro</p>
          <p className="mt-1">
            La visita está cerrada y el ingreso espera el cobro en caja. Cuando el cobro queda
            pagado, el ingreso pasa a atendido.
          </p>
          {permisos.includes('caja.ver') && (
            <Link to="/caja" className="mt-2 inline-block font-medium text-amber-900 underline">
              Ir a caja
            </Link>
          )}
        </div>
      )}

      {visita.anulado ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          La visita está anulada y no admite cambios.
        </p>
      ) : (
        <>
          {puedeEditar && (
            <Panel tono="violet" titulo="Datos clínicos de la visita">
              <FormularioVisita
                key={visita.actualizadoEn ?? visita.id}
                visita={visita}
                paciente={visita.paciente}
                onGuardada={() => queryClient.invalidateQueries({ queryKey: ['visita', id] })}
              />
            </Panel>
          )}

          <Panel
            tono="emerald"
            titulo="Medicación"
            acciones={
              puedeEditar && (
                <button
                  type="button"
                  className={claseBotonPrincipal}
                  onClick={abrirNuevaMedicacion}
                >
                  Agregar medicación
                </button>
              )
            }
          >
            {medicacion.length === 0 ? (
              <p className="text-sm text-slate-500">No se indicó medicación.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-emerald-100/70 text-left text-xs uppercase tracking-wide text-emerald-900">
                    <tr>
                      <th className="px-3 py-2">Medicamento</th>
                      <th className="px-3 py-2">Dosis</th>
                      <th className="px-3 py-2">Vía</th>
                      <th className="px-3 py-2">Frecuencia</th>
                      <th className="px-3 py-2">Duración</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicacion.map((item) => (
                      <tr key={item.id} className={item.anulado ? 'opacity-60' : ''}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-800">{item.medicamento}</span>
                          {item.indicaciones && (
                            <p className="text-xs text-slate-500">{item.indicaciones}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.dosis ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.via ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{item.frecuencia ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.duracionDias != null ? `${item.duracionDias} días` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.anulado ? (
                            <span className="text-xs text-red-700">Anulada</span>
                          ) : (
                            <div className="flex justify-end gap-1">
                              {puedeEditar && (
                                <button
                                  type="button"
                                  className={claseBoton}
                                  onClick={() => abrirEdicionMedicacion(item)}
                                >
                                  Editar
                                </button>
                              )}
                              {puedeAnular && (
                                <button
                                  type="button"
                                  className={claseBoton}
                                  onClick={() => setMedicacionParaAnular(item)}
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
          </Panel>

          {cerrada && (
            <Panel tono="amber" titulo="Notas posteriores">
              {notas.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay notas agregadas.</p>
              ) : (
                <ul className="mb-4 space-y-2">
                  {notas.map((notaVisita) => (
                    <li
                      key={notaVisita.id}
                      className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <p className="whitespace-pre-line text-slate-800">{notaVisita.texto}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {notaVisita.autorNombre ?? '—'} · {formatearFecha(notaVisita.creadoEn)}{' '}
                        {formatearHora(notaVisita.creadoEn)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {puedeEditar && (
                <form className="space-y-2" onSubmit={alAgregarNota}>
                  <label htmlFor="nota-visita" className="block text-sm font-medium text-slate-700">
                    Agregar nota
                  </label>
                  <textarea
                    id="nota-visita"
                    rows={3}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={nota}
                    onChange={(evento) => setNota(evento.target.value)}
                  />
                  {agregarNota.isError && (
                    <p className="text-sm text-red-700" role="alert">
                      {agregarNota.error.message}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className={claseBotonPrincipal}
                      disabled={agregarNota.isPending || nota.trim().length === 0}
                    >
                      {agregarNota.isPending ? 'Guardando...' : 'Agregar nota'}
                    </button>
                  </div>
                </form>
              )}
            </Panel>
          )}

          <Panel
            tono="sky"
            titulo="Control posterior"
            acciones={
              permisos.includes('controles.crear') && (
                <button
                  type="button"
                  className={claseBotonPrincipal}
                  onClick={() => setModalControl(true)}
                >
                  Crear control
                </button>
              )
            }
          >
            <p className="text-sm text-slate-600">
              Los controles de este paciente se ven en la pestaña «Controles» de su ficha y en la
              pantalla general de controles.
            </p>
          </Panel>

          <Panel tono="cyan" titulo="Adjuntos de la visita">
            {permisos.includes('adjuntos.crear') && (
              <div className="mb-3">
                <SubirAdjunto pacienteId={visita.paciente.id} visitaId={visita.id} />
              </div>
            )}
            <ListaAdjuntos pacienteId={visita.paciente.id} visitaId={visita.id} />
          </Panel>

          {versiones.length > 0 && (
            <Panel tono="slate" titulo="Historial de versiones">
              <ul className="space-y-2">
                {versiones.map((version) => (
                  <li key={version.id} className="rounded border border-slate-200">
                    <details className="px-3 py-2">
                      <summary className="cursor-pointer text-sm text-slate-800">
                        Versión {version.numero} · {version.motivoCambio}
                        <span className="ml-2 text-xs text-slate-500">
                          {version.modificadoPorNombre ?? '—'} ·{' '}
                          {formatearFecha(version.modificadoEn)}{' '}
                          {formatearHora(version.modificadoEn)}
                        </span>
                      </summary>
                      <dl className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-slate-700">Motivo de consulta</dt>
                          <dd>{version.contenido?.visita?.motivoConsulta ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Diagnóstico</dt>
                          <dd>{version.contenido?.visita?.diagnostico ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-700">Medicación vigente</dt>
                          <dd>
                            {(version.contenido?.medicacion ?? [])
                              .map((item) => item.medicamento)
                              .join(', ') || 'Sin medicación'}
                          </dd>
                        </div>
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <Modal
        abierto={modalMedicacion}
        titulo={medicacionEnEdicion ? 'Editar medicación' : 'Agregar medicación'}
        onCerrar={cerrarMedicacion}
      >
        <FormularioMedicacion
          visita={visita}
          medicacion={medicacionEnEdicion}
          onGuardada={cerrarMedicacion}
          onCancelar={cerrarMedicacion}
        />
      </Modal>

      <Modal
        abierto={Boolean(medicacionParaAnular)}
        titulo="Anular medicación"
        onCerrar={() => setMedicacionParaAnular(null)}
      >
        <FormularioAnular
          entidad="medicación"
          onAnular={(motivo) => anularMed.mutate({ medicacionId: medicacionParaAnular.id, motivo })}
          onCancelar={() => setMedicacionParaAnular(null)}
          pendiente={anularMed.isPending}
          error={anularMed.error}
        />
      </Modal>

      <Modal abierto={modalControl} titulo="Crear control" onCerrar={() => setModalControl(false)}>
        <FormularioControl
          visita={visita}
          onGuardado={() => setModalControl(false)}
          onCancelar={() => setModalControl(false)}
        />
      </Modal>

      <Modal abierto={modalAnular} titulo="Anular visita" onCerrar={() => setModalAnular(false)}>
        <FormularioAnular
          entidad="visita"
          onAnular={(motivo) => anular.mutate(motivo)}
          onCancelar={() => setModalAnular(false)}
          pendiente={anular.isPending}
          error={anular.error}
        />
      </Modal>
    </section>
  );
}
