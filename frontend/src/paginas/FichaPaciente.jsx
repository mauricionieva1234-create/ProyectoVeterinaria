import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quitarFotoPaciente, urlDescargaAdjunto } from '../api/adjuntos.js';
import { obtenerPaciente } from '../api/pacientes.js';
import { FormularioPaciente } from '../componentes/FormularioPaciente.jsx';
import { FormularioVisita } from '../componentes/FormularioVisita.jsx';
import { HistorialClinico } from '../componentes/HistorialClinico.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { EncabezadoPagina, Panel } from '../componentes/Panel.jsx';
import { claseBotonEncabezado, claseBotonEncabezadoSolido } from '../componentes/tonos.js';
import { SubirAdjunto } from '../componentes/SubirAdjunto.jsx';
import { useSesion } from '../hooks/useSesion.js';
import { calcularEdad, formatearFecha } from '../utils/formato.js';

const ETIQUETAS_SEXO = {
  macho: 'Macho',
  hembra: 'Hembra',
  desconocido: 'Desconocido',
};

const ETIQUETAS_ORIGEN = {
  criado: 'Criado en casa',
  adoptado: 'Adoptado',
  rescatado: 'Rescatado',
  otro: 'Otro',
};

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export function FichaPaciente() {
  const { id } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { data: sesion } = useSesion();
  const permisos = sesion?.permisos ?? [];
  const puedeEditarPaciente = permisos.includes('pacientes.editar');
  const puedeSubirAdjuntos = permisos.includes('adjuntos.crear');
  const puedeCrearVisita = permisos.includes('visitas.crear');
  const puedeVerHistoria = permisos.includes('historia.ver');
  const [modalEditar, setModalEditar] = useState(false);
  const [modalVisita, setModalVisita] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => obtenerPaciente(id),
  });

  const quitarFoto = useMutation({
    mutationFn: () => quitarFotoPaciente(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paciente', id] }),
  });

  if (isPending) {
    return (
      <p className="text-slate-600" role="status">
        Cargando ficha del paciente...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
          No se pudo cargar la ficha: {error.message}
        </p>
        <Link to="/clientes" className="text-sm text-teal-800 hover:underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  const paciente = data.paciente;
  const historial = paciente.historial ?? [];

  function alGuardado() {
    setModalEditar(false);
    queryClient.invalidateQueries({ queryKey: ['paciente', id] });
  }

  function alGuardarVisita(visita) {
    setModalVisita(false);
    queryClient.invalidateQueries({ queryKey: ['paciente', id] });
    navegar(`/visitas/${visita.id}`);
  }

  return (
    <section className="space-y-5">
      <Link
        to={`/clientes/${paciente.clienteId}`}
        className="text-sm font-medium text-violet-800 hover:underline"
      >
        ← Volver a la ficha del cliente
      </Link>
      <EncabezadoPagina
        tono="violet"
        titulo={paciente.nombre}
        descripcion={
          <>
            <span className="font-mono text-xs">{paciente.codigoInterno}</span>
            <span className="ml-2">
              {paciente.especieNombre}
              {paciente.razaNombre ? ` · ${paciente.razaNombre}` : ''}
            </span>
            {paciente.provisorio && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                Provisorio
              </span>
            )}
            {paciente.fichaIncompleta && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                Ficha incompleta
              </span>
            )}
            {paciente.fechaDeceso && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                Fallecido
              </span>
            )}
          </>
        }
      >
        {puedeVerHistoria && (
          <Link to={`/pacientes/${paciente.id}/historia-clinica`} className={claseBotonEncabezado}>
            Historia clínica
          </Link>
        )}
        {puedeCrearVisita && !paciente.fechaDeceso && (
          <button
            type="button"
            className={claseBotonEncabezadoSolido}
            onClick={() => setModalVisita(true)}
          >
            Nueva visita
          </button>
        )}
        <button type="button" className={claseBotonEncabezado} onClick={() => setModalEditar(true)}>
          Editar paciente
        </button>
      </EncabezadoPagina>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          tono="violet"
          titulo="Datos del paciente"
          className="lg:col-span-2"
          cuerpoClassName="space-y-4"
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Sexo">{ETIQUETAS_SEXO[paciente.sexo] ?? paciente.sexo}</Dato>
            <Dato etiqueta="Castrado">
              {paciente.castrado ? 'Sí' : 'No'}
              {paciente.fechaCastracion ? ` — ${formatearFecha(paciente.fechaCastracion)}` : ''}
            </Dato>
            <Dato etiqueta="Reproductor">{paciente.esReproductor ? 'Sí' : 'No'}</Dato>
            <Dato etiqueta="Fecha de nacimiento">
              {paciente.fechaNacimiento ? formatearFecha(paciente.fechaNacimiento) : '—'}
              {paciente.nacimientoAproximado ? ' (aproximada)' : ''}
            </Dato>
            <Dato etiqueta="Edad">
              {paciente.fechaNacimiento ? calcularEdad(paciente.fechaNacimiento) || '—' : '—'}
            </Dato>
            <Dato etiqueta="Fecha de deceso">
              {paciente.fechaDeceso ? formatearFecha(paciente.fechaDeceso) : '—'}
            </Dato>
            <Dato etiqueta="Origen">
              {paciente.origen ? (ETIQUETAS_ORIGEN[paciente.origen] ?? paciente.origen) : '—'}
            </Dato>
            <Dato etiqueta="Color">{paciente.color ?? '—'}</Dato>
            <Dato etiqueta="Código de chip">{paciente.chipCodigo ?? '—'}</Dato>
            <Dato etiqueta="Última edición">{formatearFecha(paciente.actualizadoEn)}</Dato>
          </dl>
        </Panel>

        <Panel tono="violet" cuerpoClassName="space-y-3">
          <h2 className="text-sm font-semibold text-violet-950">Foto</h2>
          <div className="space-y-2 border-b border-violet-200 pb-3">
            {paciente.fotoAdjuntoId ? (
              <img
                src={urlDescargaAdjunto(paciente.fotoAdjuntoId)}
                alt={`Foto de ${paciente.nombre}`}
                className="h-40 w-full rounded object-cover"
              />
            ) : (
              <p className="text-sm text-slate-500">Sin foto cargada.</p>
            )}

            {puedeEditarPaciente && puedeSubirAdjuntos && (
              <SubirAdjunto pacienteId={paciente.id} fotoPaciente />
            )}

            {paciente.fotoAdjuntoId && puedeEditarPaciente && (
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                onClick={() => quitarFoto.mutate()}
                disabled={quitarFoto.isPending}
              >
                {quitarFoto.isPending ? 'Quitando...' : 'Quitar foto'}
              </button>
            )}

            {quitarFoto.isError && (
              <p className="text-sm text-red-700" role="alert">
                {quitarFoto.error.message}
              </p>
            )}
          </div>

          <h2 className="border-t border-violet-200 pt-3 text-sm font-semibold text-violet-950">
            Dueño actual
          </h2>
          {paciente.cliente ? (
            <>
              <Link
                to={`/clientes/${paciente.cliente.id}`}
                className="font-medium text-violet-800 hover:underline"
              >
                {paciente.cliente.nombreCompleto}
              </Link>
              <p className="text-sm text-slate-600">
                {paciente.cliente.telefonoPrincipal ?? 'Sin teléfono principal'}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Sin dueño registrado.</p>
          )}
        </Panel>
      </div>

      {paciente.comentario && (
        <Panel tono="violet" titulo="Comentario">
          <p className="whitespace-pre-line text-sm text-slate-700">{paciente.comentario}</p>
        </Panel>
      )}

      <Panel tono="violet" titulo="Historial de dueños" cuerpoClassName="p-0">
        <div className="overflow-x-auto rounded-b-2xl bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-violet-100/70 text-left text-xs uppercase tracking-wide text-violet-900">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Desde</th>
                <th className="px-4 py-3">Hasta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((tramo) => (
                <tr key={tramo.id}>
                  <td className="px-4 py-3">
                    <Link
                      to={`/clientes/${tramo.clienteId}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {tramo.nombreCompleto}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(tramo.desde)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {tramo.hasta ? formatearFecha(tramo.hasta) : 'Actual'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <HistorialClinico pacienteId={paciente.id} />

      <Modal abierto={modalEditar} titulo="Editar paciente" onCerrar={() => setModalEditar(false)}>
        <FormularioPaciente
          paciente={paciente}
          cliente={{
            id: paciente.clienteId,
            nombreCompleto: paciente.cliente?.nombreCompleto ?? '',
          }}
          permitirCambioDueno
          onGuardado={alGuardado}
          onCancelar={() => setModalEditar(false)}
        />
      </Modal>

      <Modal abierto={modalVisita} titulo="Nueva visita" onCerrar={() => setModalVisita(false)}>
        <FormularioVisita
          paciente={paciente}
          onGuardada={alGuardarVisita}
          onCancelar={() => setModalVisita(false)}
        />
      </Modal>
    </section>
  );
}
