import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { quitarFotoPaciente, urlDescargaAdjunto } from '../api/adjuntos.js';
import { obtenerPaciente } from '../api/pacientes.js';
import { FormularioPaciente } from '../componentes/FormularioPaciente.jsx';
import { FormularioVisita } from '../componentes/FormularioVisita.jsx';
import { HistorialClinico } from '../componentes/HistorialClinico.jsx';
import { Modal } from '../componentes/Modal.jsx';
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/clientes/${paciente.clienteId}`}
            className="text-sm text-teal-800 hover:underline"
          >
            ← Volver a la ficha del cliente
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{paciente.nombre}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-mono text-xs">{paciente.codigoInterno}</span>
            <span>
              {paciente.especieNombre}
              {paciente.razaNombre ? ` · ${paciente.razaNombre}` : ''}
            </span>
            {paciente.provisorio && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Provisorio
              </span>
            )}
            {paciente.fichaIncompleta && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Ficha incompleta
              </span>
            )}
            {paciente.fechaDeceso && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                Fallecido
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {puedeCrearVisita && !paciente.fechaDeceso && (
            <button
              type="button"
              className="rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => setModalVisita(true)}
            >
              Nueva visita
            </button>
          )}
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => setModalEditar(true)}
          >
            Editar paciente
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Datos del paciente</h2>
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
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="space-y-2 border-b border-slate-200 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">Foto</h2>
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

          <h2 className="text-sm font-semibold text-slate-800">Dueño actual</h2>
          {paciente.cliente ? (
            <>
              <Link
                to={`/clientes/${paciente.cliente.id}`}
                className="font-medium text-teal-800 hover:underline"
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
        </div>
      </div>

      {paciente.comentario && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Comentario</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{paciente.comentario}</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial de dueños</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
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
      </div>

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
